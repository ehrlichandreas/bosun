---
name: bosun
description: Record a decision, complete one, fold the compressed layer, or rebuild it. Use when a decision has been settled and needs recording, when an earlier decision is being replaced, when WHAT-HOLDS.md has fallen behind the log, or when asked how the decision log works.
---

# Recording a decision

The hook already carries the one rule that must never be optional: when
something is settled without a reason, ask before working. This is everything
else - the part you only need once you are actually writing.

How an entry is named, once and for all of this file: an entry is one JSON
file in `decisions/`. Its filename is the date plus a slug derived from the
statement - `2026-03-04-we-use-sqlite-over-postgres` - and its `id`, minted
from the clock, is a UTC timestamp like `2026-03-04-17-10-03-456-utc`. The id
is the identity and the only thing a stored link ever holds. Wherever you
refer to an entry - `--id`, `--supersedes`, the left half of
`--supersedes-part`, the selections after `--checked-by` - any unique part of
the filename or the id names it; an ambiguous part is refused with every
match named, an empty one is refused outright. An `E` plus a number is a
legacy handle from before ids stood alone: it exists only in files from old
logs, keeps resolving forever, and is never minted or accepted for a new
entry.

Run the scripts from the project whose decision it is. `<bosun>` below
stands for the bosun checkout; the hook prints the real path on every message. They write into the log
found by walking up from the working directory to the nearest `decisions/` or
`DECISIONS.md`, stopping at the repository you are in: every checkout keeps its own log, and a
`decisions/` above the checkout is reported, never written to. A repository
with no log yet gets one at its root on the first save.

**Writing stops at that boundary; reading does not.** Where the save names a
log above the one it wrote into, that upper log belongs to a wider project this
one sits inside. Read its `WHAT-HOLDS.md` as well: what is nearer applies, and
what is above holds in a more general form, for what several projects need of
each other. Never copy an entry between the two. A decision that belongs to the
wider project is written there instead, with `--log`.

When you are not standing in the project, name it with `--log`, on any of these
commands. Relative is resolved against the working directory:

```sh
node <bosun>/dist/save.mjs --log ../other-project --statement "..."
```

## Save what you have, now

```sh
node <bosun>/dist/save.mjs --statement "..." --decision "..." --author-role human
```

`--statement` is a statement, not a topic: "The id is a UTC timestamp", not
"About ids". Everything else can follow. Save returns the id and names what a
complete entry still lacks, with the command to fill it in:

```sh
node <bosun>/dist/save.mjs --id part-of-its-name --why "..." --falsifier "..."
```

`--id` takes any unique part of the entry's filename or id; two matches are
refused with both named. E-numbers from older logs keep resolving.

**Never invent a falsifier to make an entry complete.** The falsifier is the
second half of the question and usually arrives a turn later. An entry saved
with a gap is honest; an entry with a made-up falsifier is theatre.

## The fields

| flag | what belongs there |
|---|---|
| `--statement` | what now holds, as a sentence |
| `--decision` | the full form: what was settled, spelled out so this entry alone carries it |
| `--why` | the reasoning |
| `--falsifier` | what one would observe to know this was wrong |
| `--rejected` | `"option :: because"`, repeatable - the alternatives that lost |
| `--supersedes` | a reference to the entry this one retires outright, repeatable |
| `--supersedes-part` | `"reference :: what exactly was replaced"`, repeatable |
| `--quote` | the triggering sentence verbatim, with `--quote-lang` |
| `--trigger` | what gave rise to it, when nobody said a sentence |
| `--implementation` | where it lives in the code |
| `--consequence` | what follows, and what breaks if reversed |
| `--author-role` | `human`, `agent` or `system` - the role, never the person |
| `--reason-type` | `measured`, `argued`, `gut-feeling`, `time-pressure`, `imposed`, `forgotten`, `knowingly-unclean` |

The unglamorous reason types are first-class. `gut-feeling` and `time-pressure`
are normal answers, and a log in which they never occur is a log nobody trusts.

## When a falsifier fires

```sh
node <bosun>/dist/waiting.mjs     # every standing claim beside what would fire it
```

Read them against what you can see; the tool cannot judge prose. A firing is
an observation worth its own entry - record what was observed and link it:

```sh
node <bosun>/dist/save.mjs --statement "what was observed" ... \
  --supersedes-part "the-refuted-entry :: the claim that fired"
```

The refuted page carries the banner from then on. Never widen the link past
what actually fired: the rest of the entry still holds.

## Replacing an earlier decision

```sh
--supersedes the-old-entry            # nothing of the old entry still holds
--supersedes-part "the-old-entry :: the id, which stopped being a slug"
```

Either flag takes the same reference as everything else: any unique part of
the earlier entry's filename or id.

**Prefer `--supersedes-part`.** A later decision usually replaces one aspect
and leaves the rest in force. Compression retires a rule only on a whole
link - a bare `--supersedes` - so typing it where a part was meant silently
deletes a rule that still applies. The detail
names exactly what was replaced; everything it does not name still holds.

## Keeping the compressed layer current

`WHAT-HOLDS.md` is what a stranger reads first. It is written by hand, never
generated.

```sh
node <bosun>/dist/fold.mjs            # what the layer does not yet contain
node <bosun>/dist/fold.mjs --done     # record the fold, once it is written
node <bosun>/dist/fold.mjs --check    # non-zero if the layer is behind
```

Folding means compressing, never copying: what binds, not what happened. No
numbers, nothing that can be wrong tomorrow.

**Write it for a small working memory.** One thought per sentence. No sentence
that assumes something the reader had to carry from another part of the file -
a term used before it is introduced, an "it" whose antecedent is a paragraph
away, a war story compressed until only the moral is left. No comma joining
rules that belong to different topics. This file is read on every turn and
again by somebody after a year; both readers have their hands full already.

Do **not** take the rest of that style. No leading with a next action, no
numbered steps, no capping a list at five, no times in units. Those belong to a
document that says what to do, and this one says what holds - and two of them
would break its own rules. Reasoning: E81.

**A fold is not done when its writer says so.** Someone who did not write it
must answer, from `WHAT-HOLDS.md` alone, the question each folded entry
answers.

Run it like this, because the isolation is the whole check:

1. Copy `WHAT-HOLDS.md` somewhere on its own and point the reader at the copy.
2. Draw one question per folded entry **from the entry**, phrased so it does
   not carry its own answer. "What stops two writers getting the same id,
   and what is given up for it?" - not "why is the handle claimed atomically?"
3. Tell the reader to open nothing else, and that wanting more context is a
   finding to write down rather than satisfy.
4. Ask for a confidence and a quote per answer, and for anything that reads as
   though it lost a neighbour when it was shortened.

```sh
node <bosun>/dist/fold.mjs --checked-by "who read it back"
node <bosun>/dist/fold.mjs --checked-by "who read it back" sqlite-over ttl-cache
```

Name the entries when the reader answered for some and got stuck on others.
Naming none means all of them. **Never stamp what they could not answer** - the
whole point is that the gap stays visible. Stamping without naming a reader
records `unchecked`, which is honest. Working alone is allowed; claiming a fold
was verified is not.

## Rebuilding, migrating, checking

```sh
node <bosun>/dist/fold.mjs --rebuild        # print every entry, to write the
                                            # layer again by hand
node <bosun>/dist/render.mjs --check        # non-zero if generated files drifted
node <bosun>/dist/upgrade.mjs               # walk old entries to the new schema
node <bosun>/dist/selftest.mjs              # after any schema or migration change
```

A rebuild reads every entry, which is the cost the fold exists to avoid. Do it
when the layer has drifted, when a reader found something missing, or to clear
entries that were only swept in - never as routine. Compare against the
previous version in git and account for every rule that disappeared.

## Bringing an entry from another project

Copy the file into `decisions/` - ids never collide, so that is the whole
move. Only a file from an old log still carrying an E-number can clash with a
local one; render then refuses and names the `"alias"` to remove - the
arriving entry sets its number down, it does not take a new one:

```sh
cp ../other-project/decisions/2026-03-04-....json decisions/
node <bosun>/dist/render.mjs
```

**Keep its id, its date and its origin.** They are what say the decision was
made somewhere else and when, which is the whole of what it carries. An entry
rewritten to a local date and origin is indistinguishable from one made here
today.

`render` refuses while two entries answer to one name and prints both files
with their origins. Only files from logs of the numbered era can collide -
every such log counted from `E1` - and new entries carry no number at all.

## What never happens

- Never edit a generated file. Edit the JSON and re-render.
- Never renumber. A superseded entry stays and points forward.
- Never remove an entry because it is embarrassing. That is what the log is for.
- Never change what an entry decided by annotating it. A changed rule needs a
  new entry that supersedes.
