# bosun

**A colleague with a memory for your coding agent.** It asks why, before the
work starts, and it keeps the answer. Not a documentation tool, not a retrieval
index, not a wiki.

A bosun is the oldest hand aboard: knows every rope, has sailed longer than the
captain, keeps the ship working, and never commands.

> Not affiliated with Bosun, the archived time series alerting system by Stack
> Exchange.

## The idea

In every company there is one person everybody asks. They were there when it was
designed. They say "we tried that in 2019, and here is what happened". They ask
back when somebody orders something without giving a reason. They can be wrong,
you can argue with them, and they get better over the years.

That person is the single largest accelerator in the building. They do not
scale, they can quit, and they can be wrong.

bosun is an attempt at the same thing in a form that scales, does not quit,
and can be argued with.

## How it works

One rule, one file, one hook.

**The record is not a by-product of the work. It is the record of a
disagreement.** Nobody writes anything up afterwards. When you settle something
without saying why, the agent asks - in one question with two halves: why this
way, and what would one observe to know it was wrong. Your answer, and the
alternative that was rejected, become the entry.

Two things make it different from a decision-record folder:

- **The trigger is not somebody deciding to write a document.** It is an
  assertion made without a reason, from anyone: you, an agent, a document. What
  is mechanical is the reminder, not the noticing: the hook fires on every
  message and always says the same thing, and the agent already reading the
  message is what recognises the assertion, in any language. That also answers the hardest question of every such process - was
  this even a decision? It was one if the work could have gone another way and
  somebody settled it. Disagreement is the commonest sign of that and the one a
  trigger can catch; a finding or a measurement counts just as much.
- **Every entry names its own falsifier.** What would you have to observe to
  know this was wrong. Without that sentence a log is an archive. With it, the
  system has something to wait for. `waiting` lists every standing falsifier
  for whoever has context to read it against the world; a firing is recorded
  as its own entry, superseding in part the claim it refuted, and the refuted
  page carries the banner from then on. Judging the prose stays with the
  reader - the tool only makes sure the wires are in front of somebody.

A reason is typed as what it is: `--reason-type measured` or `argued` for
the ordinary case, and just as officially `gut-feeling`, `time-pressure`,
`imposed`, `forgotten` or `knowingly-unclean`. A
project where you can see which parts were built under deadline is worth far
more than one where every decision claims a principle.

## Install

Requires [Claude Code](https://claude.com/claude-code) and any Node 18 or
newer. No `package.json`, no dependencies, nothing to build: `dist/` ships the
scripts with their types stripped, so the Node you already have runs them. The
`.ts` in `bin/` is the source and needs a Node with the type stripper, which
only matters if you are changing bosun rather than using it.

```sh
git clone --branch v0.3.0 https://github.com/ehrlichandreas/bosun
```

**Clone a tag, not `main`.** The hook runs on your machine on every message,
so a pull is not a document update, it is new code you are about to execute.
A tag is a fixed thing you can read once and trust until you decide to move;
`main` changes under you. Upgrade deliberately: read the diff, then check out
the next tag.

Clone it once, anywhere, then point the installer at each project whose
decisions you want to keep:

```sh
node /path/to/bosun/dist/install.mjs ~/work/some-project          # what it would do
node /path/to/bosun/dist/install.mjs ~/work/some-project --write  # do it
```

It creates `decisions/`, registers the hook, and copies the skill to
`.claude/skills/bosun/SKILL.md` inside that project, merging into
an existing `settings.json` rather than replacing it, and refusing rather than
guessing when it finds something it does not understand.

When the bosun checkout sits **inside** the project - a submodule, a vendored
copy, a working directory that is itself the project - the registered hook is
written relative to it, as `sh "$CLAUDE_PROJECT_DIR/path/to/bosun/hook/presence.sh"`.
A `settings.json` is committed and cloned, and an absolute path in it names a
machine rather than a project. Outside the project there is nothing to be
relative to, and the absolute path stays.

**Other tools** get the same rule the hook prints, as a file they read:
`--agent codex` splices it into `AGENTS.md`, `--agent cursor` into
`.cursorrules`, between bosun markers so the rest of the file is untouched:

```sh
node /path/to/bosun/dist/install.mjs ~/work/some-project --agent codex --write
node /path/to/bosun/dist/install.mjs ~/work/some-project --agent cursor --write
node /path/to/bosun/dist/install.mjs ~/work/some-project --agent print
```

`--agent print` writes nothing; it prints the rule so you can paste it wherever
your tool reads standing instructions. The project argument is required but
only checked, never touched.

That binding is **weaker** and it is worth knowing why: a hook fires on every
message and cannot be summarised away, while a file is read once at the start
of a session and drifts out of context in a long conversation.

By hand, if you prefer, it is a `decisions/` directory and this in the
project's `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "sh /path/to/bosun/hook/presence.sh"
          }
        ]
      }
    ]
  }
}
```

The hook prints its own install path, so the agent knows where the scripts are.
The scripts write into **the project you are standing in**, found by walking up
from the working directory to the nearest `decisions/` or `DECISIONS.md`, and
they stamp each entry with that project as its origin. A `DECISIONS.md` that
bosun did not write is never overwritten.

**One log per repository.** The walk stops at the checkout it started in -
the nearest directory holding a `.git`, as a directory or as the file a
worktree leaves - so
several projects under one working directory keep separate logs even when a
`decisions/` sits above them all - and a log above the checkout is reported,
not used. The first decision in a repository that has no log yet opens one at
the repository root rather than being refused: a decision is made once, in the
minute somebody asks why, and that minute does not survive "run the installer
first". That first save creates `decisions/`, the entry, the rendered
Markdown beside it and the `DECISIONS.md` index; `WHAT-HOLDS.md` and `OPEN.md` are written by whoever works
there, when there is something to compress or something undecided. Outside any
repository, with no marker above you, the tools still refuse rather than
guess, so nothing is ever written into the bosun clone.

**Logs stack, they never merge.** Writing stops at the repository boundary,
reading does not. Where a project sits inside a wider one that keeps its own
log, read that log's `WHAT-HOLDS.md` too: what is nearer applies, and what is
above holds in a more general form. Nothing is ever copied between them - a
copy would fork the entry, and no link has to cross a log; a decision
belonging to the wider project is written there instead. How high a statement belongs is
decided by its falsifier - only as high as what would show it wrong can be
observed.

**`--log <directory>` names the project explicitly**, for when you are not
standing in it: the walk starts there, as if you stood in that directory.
Relative paths are resolved against your working directory, so
`--log ../other-project` is the sibling checkout and `--log .` is here:

```sh
node /path/to/bosun/dist/save.mjs --log ../other-project --statement "..."
node /path/to/bosun/dist/render.mjs --log ./packages/api --check
```

Then work as usual. The first time you settle something without giving a
reason, you will be asked.

Beyond those three writes, nothing lands anywhere: no package manager, no
build step. The hook emits a constant block of text; your agent does the rest.

A mistyped flag is refused by name, never ignored, and `save` refuses a field
the schema does not know - a typo cannot silently write a malformed entry or
run a check that checked nothing. Re-running the installer is safe and is how
the skill copy is refreshed: it settles its own hook registration to one and
never duplicates it. Every rendered entry page shows its origin, author role
and reason type on its last line.

## What is in this repository

| File | What it is |
|---|---|
| [`schemas/v*.json`](schemas) | every schema version ever released, kept forever |
| [`hook/presence.sh`](hook/presence.sh) | the hook. The trigger, and nothing else |
| [`skill/SKILL.md`](skill/SKILL.md) | the procedure, loaded when it is used |
| [`bin/install.ts`](bin/install.ts) | sets a project up in one command |
| [`bin/selftest.ts`](bin/selftest.ts) | one runnable check, `node:assert`, no framework |

## What a project using it keeps

| File | What it is |
|---|---|
| `WHAT-HOLDS.md` | what holds. The state, compressed, no numbers |
| `DECISIONS.md` | the index. One line per decision, generated |
| `decisions/*.json` | the source of truth. One decision per file |
| `decisions/*.md` | the readable form, generated. Never edit these |
| `OPEN.md` | what is not decided yet |
| `fold-state.json` | which entries the compressed layer contains, and how |

```sh
# Run these standing in your own project, not in the bosun checkout. B is the
# path you cloned bosun to; the hook prints it on every message.
node $B/dist/save.mjs --statement "..." --decision "..."  # statement: what holds,
                                                          # one sentence; decision:
                                                          # the full form. Writes,
                                                          # re-renders, returns the id
node $B/dist/save.mjs --id sqlite-over --falsifier "..." # fill a gap: any unique
                                                          # part of its filename or id
                                                          # (old E-numbers still work)
node $B/dist/save.mjs --log ../other-project ...          # any of these, elsewhere
node $B/dist/render.mjs                                   # regenerate the Markdown
node $B/dist/render.mjs --check                           # fail if it drifted
node $B/dist/fold.mjs                                     # what WHAT-HOLDS.md is missing
node $B/dist/fold.mjs --done                              # record the fold once written
node $B/dist/fold.mjs --check                             # fail if the layer is behind
node $B/dist/fold.mjs --rebuild                           # print every entry, to write
                                                          # the layer again by hand
node $B/dist/fold.mjs --checked-by "who read it back"     # records who read it back
                                                          # - recorded, not verified
node $B/dist/waiting.mjs                                  # every standing falsifier,
                                                          # for whoever has context
node $B/dist/upgrade.mjs                                  # walk old entries forward
node $B/dist/selftest.mjs                                 # one runnable check
```

The full procedure - every field, superseding, folding, rebuilding - lives in
[`skill/SKILL.md`](skill/SKILL.md), which the installer copies into the
project. The hook deliberately carries only the trigger and the common case.

If you are working on bosun itself, run `bin/build.ts` after changing
`bin/` - `dist/` is what everyone else runs, so it falling behind `bin/`
matters here more than in most projects - then `dist/render.mjs --check`,
`dist/fold.mjs --check` and `dist/build.mjs --check` before you commit: the
first is the only thing that notices a hand edit to a generated file, the
second notices the compressed layer falling behind the log, the third the
drift just named. Run `dist/selftest.mjs` after any change to the schema or
the migrations.

`WHAT-HOLDS.md` is never generated. Whoever is working folds each new entry
into it by hand; `fold.ts` only lists what is missing and records what was
folded, in `fold-state.json` beside it. That record names every entry and says
whether it was folded on purpose or swept in when the record was introduced,
so a sweep can never pass for a fold. Reasoning: E38 to E41.

**A decision made in another project** is brought across by copying its file
into `decisions/` - nothing else, since ids never collide. It keeps its id,
its date and its origin: those say it was decided elsewhere and when, which is
the whole of what it carries. Only a file from an old log that still carries
an E-number can clash with a local one; `render` refuses while two entries
answer to one name and says which `"alias"` to remove - the arriving entry
sets its number down, since no entry needs one here, and a number this log
never issued would be a citation nothing ever made.

`save` writes what it has and names what a complete entry is still missing. The
falsifier is the second half of the question and usually arrives a turn later;
refusing the entry until then produces invented falsifiers, not true ones. The
gap stays visible in the index until somebody fills it.

`DECISIONS.md` is not decoration. Expect entries that are superseded a day
after they were written, and reasons that are nothing but a hunch: the log
records what happened, not what reads well.

**Coming back after a year?** Read `WHAT-HOLDS.md` for what holds, then
`OPEN.md` for where you stopped.

## Status

Early. The hook and the log tooling work, the fold included. The asking is
done by your agent under the hook's rule - the stake it carries is the agent's
own reading, which is as good as that agent is. What has not been built is the
rest of the colleague: remembering across projects and mediating between
voices.

## License

MIT. See [LICENSE](LICENSE).
