#!/usr/bin/env node
/**
 * Walk decisions/*.json forward to the newest schema, then re-render.
 *
 *   node bin/upgrade.ts             migrate and re-render
 *   node bin/upgrade.ts --dry-run   report only
 *
 * Every schema version lives in schemas/ forever, and every step is checked
 * against the schema it claims to produce. One checkout therefore carries the
 * whole history of the format: an entry written under v1 walks to v7 one step
 * at a time, and each step is verified rather than assumed.
 *
 * Add a migration for every bump. The key is the version it migrates *from*.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { LATEST, validate, versions } from "./schema.ts";
import {
  logRoot,
  takeLog,
  unknownFlag,
  sibling,
  noLogRoot,
  decisionsDir,
  readEntryFile,
} from "./paths.ts";
import { isDirectRun } from "./paths.ts";

type Entry = Record<string, unknown>;
type Migration = (entry: Entry) => Entry;

/**
 * The key is the version a migration reads. Each one ships in the same commit
 * as the schema it produces.
 *
 * 1 -> 2 changes no data. v2 widens three types and changes the id format for
 * *new* entries only; existing entries keep their slug ids, because inventing a
 * timestamp for a decision whose time nobody recorded would put a made-up fact
 * into a log whose whole value is that it is not made up.
 */
export const MIGRATIONS: Record<number, Migration> = {
  1: (entry) => entry,

  // 2 -> 3 rewrites ISO ids such as 2026-08-28T17:10:03Z into the hyphen-only
  // form. That is the same instant written differently, so nothing is invented;
  // contrast E28, where backfilling unknown times was refused. Slug ids from v1
  // are left alone: they are not timestamps and there is nothing to normalise.
  2: (entry) => {
    const id = entry.id as string;
    const iso = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(id);
    if (!iso) return entry;
    const [, date, hh, mm, ss] = iso;
    return { ...entry, id: `${date}-${hh}-${mm}-${ss}` };
  },

  // 3 -> 4 widens second-resolution ids to milliseconds. Two entries written in
  // the same second collided, so the digits are padded to keep every id the
  // same shape. Ordering within that second is not known and is not invented:
  // duplicates are broken apart by bin/upgrade.ts, which numbers them by alias.
  3: (entry) => {
    const id = entry.id as string;
    if (!/^\d{4}(-\d{2}){5}$/.test(id)) return entry;
    return { ...entry, id: `${id}-000` };
  },

  // 4 -> 5 appends -utc so the id states its own zone. The instant is
  // unchanged; only the string now carries the fact that the schema used to
  // carry alone. This is the third id rewrite, and the last one that costs
  // nothing: after the first reference from outside this repository, renaming
  // an id breaks a link.
  4: (entry) => {
    const id = entry.id as string;
    if (!/^\d{4}(-\d{2}){5}-\d{3}$/.test(id)) return entry;
    return { ...entry, id: `${id}-utc` };
  },

  // 5 -> 6 gives every supersedes link an extent. Existing links are recorded
  // as "whole", which is what they meant when written; the four that actually
  // replaced only part of an earlier entry are corrected by hand afterwards,
  // visibly, rather than guessed at here.
  5: (entry) => {
    const links = (entry.supersedes as unknown[]) ?? [];
    return {
      ...entry,
      supersedes: links.map((one) =>
        typeof one === "string" ? { id: one, extent: "whole", detail: null } : one,
      ),
    };
  },

  // 6 -> 7 removes superseded_by. It was derived from the supersedes links on
  // later entries, held one successor where an entry may have several, and
  // writing a second one silently overwrote the first - losing information
  // from the file this project calls its source of truth.
  6: (entry) => {
    const { superseded_by: _dropped, ...rest } = entry;
    return rest;
  },
};

/**
 * Ids must be unique. Second-resolution ids from v3 can collide, so after the
 * migrations run, any duplicate is separated by ascending alias: the first
 * keeps -000, the next becomes -001. This renames identifiers, it does not
 * claim a time that was never recorded.
 */
export function deduplicate(entries: { name: string; entry: Entry }[]): string[] {
  const byId = new Map<string, { name: string; entry: Entry }[]>();
  for (const item of entries) {
    const id = item.entry.id as string;
    byId.set(id, [...(byId.get(id) ?? []), item]);
  }

  const renamed: string[] = [];
  // Every id in the log, kept current as renames land: a rename that stepped
  // onto an id already taken manufactured the very duplicate it exists to
  // remove, in the source of truth, unrepairably.
  const taken = new Set(
    entries.map((one) => one.entry.id as string | undefined)
      .filter((one): one is string => one !== undefined),
  );
  for (const [id, group] of byId) {
    // Entries without an id are a gap, not a collision: nothing answers to
    // the missing id, and a gap never blocks a migration. They used to crash
    // this loop with an unnamed TypeError.
    if (id === undefined || group.length < 2) continue;
    // An id no rename pattern can step off is refused by name, not "renamed"
    // to itself: String.replace with a non-matching pattern returns its input,
    // and the claimed fix left the collision in place on every run.
    if (!/-\d{3}(-utc)?$/.test(id)) {
      throw new Error(
        `${group.map((one) => one.name).join(" and ")} share the id ${id}, ` +
          `which has no numeric tail to renumber. Give one of them its own ` +
          `id by hand, then run again.`,
      );
    }
    const ordered = [...group].sort((a, b) => {
      const digits = (one: typeof a) =>
        Number(/^E(\d+)$/.exec((one.entry.alias as string) ?? "")?.[1] ?? 0);
      return digits(a) - digits(b);
    });
    ordered.forEach((item, index) => {
      if (index === 0) return;
      // The next free number, asked of every id in the log, not merely this
      // group: stepping onto a genuine sibling's id handed two entries one id.
      let step = index;
      let candidate: string;
      do {
        const suffix = String(step).padStart(3, "0");
        candidate = /-\d{3}-utc$/.test(id)
          ? id.replace(/-\d{3}-utc$/, `-${suffix}-utc`)
          : id.replace(/-\d{3}$/, `-${suffix}`);
        step += 1;
      } while (taken.has(candidate));
      item.entry.id = candidate;
      taken.add(candidate);
      renamed.push(`${item.entry.alias ?? item.name}: ${id} -> ${item.entry.id}`);
    });
  }
  return renamed;
}

/** Returns the migrated entry and every step taken, or throws with the reason. */
export function walk(entry: Entry, name: string): [Entry, number[]] {
  let version = (entry.schema as number) ?? 1;
  let current = entry;
  const steps: number[] = [];

  // Only defects block a migration. A missing required field is a gap the
  // product deliberately allows, and refusing it here let one unfinished entry
  // block the migration of every other entry in the log.
  const before = validate(current, version).filter((p) => p.kind === "invalid");
  if (before.length) {
    throw new Error(
      `${name} does not match schema v${version}: ` +
        `${before[0].path} ${before[0].message}`,
    );
  }

  while (version < LATEST) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`${name}: no migration from schema v${version}`);
    current = { ...step(current), schema: version + 1 };
    version += 1;
    steps.push(version);
    const after = validate(current, version).filter((p) => p.kind === "invalid");
    if (after.length) {
      throw new Error(
        `${name}: migration to v${version} produced ` +
          `${after[0].path} ${after[0].message}`,
      );
    }
  }

  return [current, steps];
}

function main(passed: string[]): number {
  const { rest: argv, from } = takeLog(passed);
  const unknown = unknownFlag(argv, ["--dry-run"]);
  if (unknown) {
    console.error(`refused: unknown flag ${unknown}`);
    return 1;
  }
  const dryRun = argv.includes("--dry-run");
  const root = logRoot(from);
  if (!root) {
    console.error(noLogRoot(from));
    return 1;
  }
  const DECISIONS = decisionsDir(root);
  const names = readdirSync(DECISIONS).filter((n) => n.endsWith(".json"));
  if (names.length === 0) {
    console.error("no decisions/*.json found");
    return 1;
  }

  const changed: string[] = [];
  const refused: string[] = [];
  const all: { name: string; entry: Entry }[] = [];

  for (const name of names) {
    const path = join(DECISIONS, name);
    let entry: Entry;
    try {
      entry = readEntryFile(path) as Entry;
    } catch (error) {
      refused.push((error as Error).message);
      continue;
    }
    const before = (entry.schema as number) ?? 1;

    if (before > LATEST) {
      refused.push(
        `${name} is schema v${before}, this checkout knows up to v${LATEST}`,
      );
      continue;
    }

    try {
      const [migrated, steps] = walk(entry, name);
      all.push({ name, entry: migrated });
      if (steps.length === 0) continue;
      changed.push(`${name}: v${before} -> v${LATEST}`);
    } catch (error) {
      refused.push((error as Error).message);
    }
  }

  for (const line of deduplicate(all)) {
    console.log("  de-duplicated", line);
    changed.push(line);
  }

  // Nothing is written when any entry was refused: a half-upgraded log plus
  // stale Markdown is worse than an untouched one.
  if (!dryRun && refused.length === 0) {
    for (const { name, entry } of all) {
      writeFileSync(
        join(DECISIONS, name),
        JSON.stringify(entry, null, 2) + "\n",
        "utf8",
      );
    }
  }

  console.log(
    `schemas in this checkout: ${versions().map((v) => `v${v}`).join(", ")}`,
  );
  for (const line of changed) console.log("  migrated", line);
  for (const line of refused) console.error("  refused:", line);
  console.log(
    `${names.length} entries, ${changed.length} migrated, ` +
      `${refused.length} refused${dryRun ? " (dry run)" : ""}`,
  );

  if (refused.length) return 1;
  if (dryRun || changed.length === 0) return 0;

  const rendered = spawnSync(
    process.execPath,
    [sibling(import.meta.url, "render"), "--log", root],
    { stdio: "inherit" },
  );
  return rendered.status ?? 1;
}

// Only when run directly. Importing this file must not execute it,
// otherwise no test and no other script can load it.
// realpathSync on both sides: Node canonicalises import.meta.url through
// symlinks but leaves process.argv[1] as typed, so reaching a script through
// a symlinked path (/tmp on macOS, a dotfile manager, a network home) made
// every one of these silently do nothing and exit 0. A save that reports
// success and records nothing is worse than one that crashes.
if (isDirectRun(import.meta.url)) {
  // A bad file is named and refused, never a crash: the last net for
  // anything a shape check below main did not already turn into a clean
  // refusal. save.ts wraps its main the same way.
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error("refused:", (error as Error).message);
    process.exitCode = 1;
  }
}
