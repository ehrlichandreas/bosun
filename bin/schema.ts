#!/usr/bin/env node
/**
 * Load and check against the versioned schemas in schemas/.
 *
 * Every schema version stays in the repository forever, so a single checkout
 * can validate and walk forward an entry written under any older version. That
 * is the same rule the log itself follows: nothing is replaced, things are put
 * beside each other and point forward.
 *
 * Deliberately a small subset of JSON Schema: type, required, properties,
 * items, enum, additionalProperties. Anything more would mean a dependency,
 * and this validates twenty fields.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SCRIPT_ROOT } from "./paths.ts";

// Schemas belong to the tool, not to the log being written, so they always
// come from the bosun installation and never from the adopter's project.
const SCHEMA_DIR = join(SCRIPT_ROOT, "schemas");

type Schema = {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  enum?: unknown[];
  additionalProperties?: boolean;
};

/** Every schema version present in schemas/, ascending. */
export function versions(): number[] {
  return readdirSync(SCHEMA_DIR)
    .map((name) => /^v(\d+)\.json$/.exec(name)?.[1])
    .filter((digits): digits is string => digits !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
}

/** The newest schema this checkout knows. */
export const LATEST = versions().at(-1) ?? 1;

const cache = new Map<number, Schema>();

export function loadSchema(version: number): Schema {
  const cached = cache.get(version);
  if (cached) return cached;
  const path = join(SCHEMA_DIR, `v${version}.json`);
  // A version nothing ever shipped - 0, 6.5, a hand-edit - surfaced as a raw
  // ENOENT naming an internal path instead of the claim that caused it.
  if (!existsSync(path)) {
    throw new Error(
      `schema v${version} does not exist in this checkout (it has v${versions().join(", v")})`,
    );
  }
  const schema = JSON.parse(readFileSync(path, "utf8")) as Schema;
  cache.set(version, schema);
  return schema;
}

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function typeMatches(value: unknown, expected: string): boolean {
  const actual = typeOf(value);
  if (expected === "number") return actual === "integer" || actual === "number";
  return actual === expected;
}

/**
 * Two kinds, and they are treated differently everywhere.
 *
 * "required" means a field a complete entry needs is still empty. That is a
 * gap, not a defect: the falsifier often arrives a turn after the decision, and
 * forcing it up front produces invented falsifiers rather than true ones.
 *
 * "invalid" means the data is wrong: bad type, unknown field, value outside the
 * enum. Nothing downstream can render that, so it is refused.
 */
export type Problem = { path: string; field: string; kind: "required" | "invalid"; message: string };

function check(value: unknown, schema: Schema, path: string, field: string): Problem[] {
  const problems: Problem[] = [];
  const invalid = (message: string): Problem =>
    ({ path, field, kind: "invalid", message });

  if (schema.type) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!expected.some((one) => typeMatches(value, one))) {
      return [invalid(`expected ${expected.join(" or ")}, got ${typeOf(value)}`)];
    }
  }

  if (schema.enum && !schema.enum.includes(value as never)) {
    problems.push(
      invalid(
        `${JSON.stringify(value)} is not one of ` +
          schema.enum.map((one) => JSON.stringify(one)).join(", "),
      ),
    );
  }

  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      problems.push(...check(item, schema.items!, `${path}[${index}]`, field));
    });
  }

  if (value !== null && typeOf(value) === "object") {
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      const held = record[key];
      if (held === undefined || held === null || held === "") {
        problems.push({
          path: `${path}.${key}`,
          field: key,
          kind: "required",
          message: "missing",
        });
      }
    }
    for (const [key, item] of Object.entries(record)) {
      const sub = schema.properties?.[key];
      if (!sub) {
        if (schema.additionalProperties === false) {
          problems.push({
            path: `${path}.${key}`,
            field: key,
            kind: "invalid",
            message: "not allowed by schema",
          });
        }
        continue;
      }
      problems.push(...check(item, sub, `${path}.${key}`, key));
    }
  }

  return problems;
}

/** Empty array means complete and valid. */
export function validate(entry: unknown, version: number): Problem[] {
  // The version gate comes first, and alone: checking a newer document field
  // by field against an older schema produced refusals naming fields the
  // newer schema may well allow - and following such a message deletes the
  // field, which is the damage "refused rather than damaged" exists to
  // prevent. save and upgrade refuse newer documents by name; render arrived
  // here without that gate and rendered them as if they were old.
  const held = (entry as { schema?: unknown })?.schema;
  if (typeof held === "number" && held > version) {
    return [{
      path: "entry.schema",
      field: "schema",
      kind: "invalid",
      message: `is v${held}, this checkout knows up to v${version}`,
    }];
  }
  return check(entry, loadSchema(version), "entry", "entry");
}

/** Field names a complete entry still needs. */
export function missingFields(entry: unknown, version: number): string[] {
  return validate(entry, version)
    .filter((problem) => problem.kind === "required")
    .map((problem) => problem.field);
}
