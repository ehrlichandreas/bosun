#!/usr/bin/env node
/**
 * Two roots, and confusing them is what stopped bosun from working anywhere
 * but in its own checkout.
 *
 * SCRIPT_ROOT is where bosun is installed. The schemas live there, because
 * they are part of the tool.
 *
 * logRoot() is where the log being written lives, which is the project the
 * command was run from. An adopter clones bosun once and keeps their decisions
 * in their own repository; nothing may be written into the bosun clone.
 */

import { existsSync, statSync, realpathSync, readFileSync } from "node:fs";
import { join, dirname, basename, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SCRIPT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** A directory holds a log if it has decisions/ or a DECISIONS.md. */
function holdsLog(dir: string): boolean {
  const decisions = join(dir, "decisions");
  if (existsSync(decisions) && statSync(decisions).isDirectory()) return true;
  return existsSync(join(dir, "DECISIONS.md"));
}

/**
 * A repository boundary: .git, as a directory or as the file a worktree and a
 * submodule leave instead.
 */
function holdsRepo(dir: string): boolean {
  return existsSync(join(dir, ".git"));
}

/**
 * The repository the given directory belongs to, or null outside one.
 *
 * This is the unit a log belongs to. Checkouts sit side by side under one
 * working directory, and a checkout is the thing that gets cloned, moved and
 * handed to somebody else - a log kept above it would not travel with it.
 */
export function repoRoot(from: string = process.cwd()): string | null {
  let dir = from;
  const { root } = parse(dir);
  for (;;) {
    if (holdsRepo(dir)) return dir;
    if (dir === root) return null;
    dir = dirname(dir);
  }
}

/**
 * Walk up from `from` until a log is found, or null if there is none.
 *
 * There is deliberately no fallback to the install: falling back wrote an
 * adopter's decision into the bosun clone, quietly, while the README promised
 * the opposite. Standing inside bosun still finds bosun's own decisions/ by the
 * ordinary walk, so nothing is lost.
 *
 * The walk stops at the repository the directory belongs to. Without that stop
 * it left the checkout: several repositories under one working directory, one
 * decisions/ anywhere above them, and every one of them wrote into that single
 * log while claiming its own project as the origin. Each repository keeps its
 * own log; a log above the checkout is reported by alsoAbove, not used.
 */
export function logRoot(from: string = process.cwd()): string | null {
  let dir = from;
  const { root } = parse(dir);
  for (;;) {
    if (holdsLog(dir)) return dir;
    if (holdsRepo(dir)) return null;
    if (dir === root) return null;
    dir = dirname(dir);
  }
}

/**
 * Take `--log <dir>` off an argument list, and say where to start the walk.
 *
 * The directory is where you would otherwise have stood, not the log root
 * itself, so a path into a subdirectory of the project finds the same log a cd
 * there would. Relative is resolved against the working directory, because
 * that is what a person types and what a sibling checkout looks like from
 * here: --log ../other-project.
 *
 * It is removed from the argument list rather than ignored: save turns every
 * remaining --flag into a field, so a --log left in would be saved as one and
 * refused as an unknown field, and fold reads bare words after --checked-by as
 * entry ids, where a stray directory would pass as a name.
 */
export function takeLog(
  argv: string[],
  cwd: string = process.cwd(),
): { rest: string[]; from: string } {
  const rest: string[] = [];
  let given: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--log") {
      const next = argv[i + 1];
      // Swallowing the next flag is the same silent corruption save refuses.
      if (next === undefined || next.startsWith("--")) {
        throw new Error("--log needs a directory");
      }
      given = next;
      i += 1;
    } else if (token.startsWith("--log=")) {
      given = token.slice("--log=".length);
    } else {
      rest.push(token);
    }
  }
  if (given === null) return { rest, from: cwd };
  if (!given) throw new Error("--log needs a directory");
  const named = resolve(cwd, given);
  if (!existsSync(named) || !statSync(named).isDirectory()) {
    throw new Error(`--log ${given} is not a directory (${named})`);
  }
  // Canonicalised, because the origin of every entry is the basename of this
  // root. The working directory this replaces is always canonical, so a
  // resolved-but-not-canonical path was a difference nobody could see: through
  // a deploy-style `current` symlink, or /tmp on macOS, entries were stamped
  // with the link's name instead of the project's - and an entry, once
  // written, is not rewritten.
  return { rest, from: realpathSync(named) };
}

/**
 * The first flag this tool does not know, or null.
 *
 * Every flag was matched with includes(), so "--chekc" was ignored and the
 * command ran as if nothing had been asked: a check that reported nothing
 * checked, from a tool whose one promise is that silence never means fine.
 * save is not routed through this - its unknown flags become fields and the
 * schema already refuses those by name.
 */
export function unknownFlag(argv: string[], known: string[]): string | null {
  const set = new Set(known);
  for (const token of argv) {
    if (!token.startsWith("--")) continue;
    if (!set.has(token.split("=", 1)[0])) return token;
  }
  return null;
}

/**
 * A sibling script, in the layer this one is running from.
 *
 * bin/save.ts spawning bin/render.ts is right; dist/save.mjs spawning
 * bin/render.ts is what the hardcoded path did, and it needs the very type
 * stripper dist exists to do without - so on the plain Node the README
 * promises, every save rendered nothing and reported the failure of a file the
 * adopter was never told about.
 */
export function sibling(metaUrl: string, name: string): string {
  const here = fileURLToPath(metaUrl);
  return join(dirname(here), `${name}${here.endsWith(".mjs") ? ".mjs" : ".ts"}`);
}

/**
 * Any further log above the one that was chosen.
 *
 * In a large repository a package can carry its own decisions/ while the
 * repository root carries another. The walk stops at the first, which is
 * usually right and occasionally not, so the others are named rather than
 * hidden: landing in the wrong log is silent otherwise.
 */
export function alsoAbove(chosen: string): string[] {
  const found: string[] = [];
  const { root } = parse(chosen);
  let dir = chosen;
  while (dir !== root) {
    dir = dirname(dir);
    if (holdsLog(dir)) found.push(dir);
  }
  return found;
}

/** The message every entry point prints when there is no log to read. */
export function noLogRoot(from: string = process.cwd()): string {
  const repo = repoRoot(from);
  return `no decisions/ or DECISIONS.md at or above ${from}` +
    (repo ? ` within ${repo}` : "") + `. ` +
    `Create a decisions/ directory in the project whose log this is, ` +
    `or point at one with --log <directory>.`;
}

/**
 * Where an entry came from, per E8. Derived from the log root rather than
 * hardcoded, otherwise every adopter's entries claim to originate in bosun.
 */
export function originOf(root: string): string {
  return basename(root);
}

export function decisionsDir(root: string): string {
  return join(root, "decisions");
}

/**
 * Was this file run directly, rather than imported?
 *
 * Node canonicalises `import.meta.url` through symlinks but leaves
 * `process.argv[1]` exactly as it was typed. Comparing them raw meant that
 * reaching a script through any symlinked path made it skip its own main and
 * exit 0 without a word - for a record-keeping tool, silently doing nothing
 * while reporting success.
 */
export function isDirectRun(metaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const real = (path: string): string => {
    try {
      return realpathSync(path);
    } catch {
      return path;
    }
  };
  return real(entry) === real(fileURLToPath(metaUrl));
}

/**
 * Read one entry file, or fail with a message that names it.
 *
 * A raw JSON.parse was used at four call sites and none of them caught it, so
 * one merge-conflicted or mistyped file killed every command with an internal
 * stack trace - including a save creating an unrelated entry, because save
 * reads the whole directory to pick the next alias. The clean refusal already
 * existed in install.ts. It was written once and forgotten where it mattered.
 */
export function readEntryFile(path: string): Record<string, unknown> {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    throw new Error(`${basename(path)} cannot be read: ${(error as Error).message}`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `${basename(path)} is not valid JSON (${(error as Error).message}). ` +
        `Fix or move it, then run again.`,
    );
  }
}
