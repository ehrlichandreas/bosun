#!/bin/sh
# Presence, not detection.
#
# Fires on every message with the same text, so it sits in the prompt cache and
# costs practically nothing. It deliberately detects nothing: the agent reads
# the message anyway, in any language. Detection inside the hook would only
# introduce a language dependency and save nothing.
#
# It carries the trigger and the common case, and nothing else. Everything a
# writer needs only while actually recording - the full field list, superseding,
# folding, rebuilding - lives in the bosun skill, so it is loaded when it is
# used rather than riding along on every message.
#
# The one thing interpolated is the install path, resolved from this script's
# own location. It is constant for a given install, so the output stays
# byte-identical from message to message and remains cacheable.
#
# Reasoning: DECISIONS.md, E13 and E14.

BOSUN=$(cd "$(dirname "$0")/.." && pwd)

# The path is printed into agent-facing text and into commands an agent will
# run. A newline in it would inject a line into every message; a $(...) or
# backtick would be evaluated the moment an agent runs the printed command.
# Such a path gets a placeholder instead of trust. A plain space is none of
# that - it used to split the printed command into pieces - so the commands
# quote the path, and the case below keeps the quote character itself out.
NL='
'
case "$BOSUN" in
  *"$NL"* | *'$'* | *'`'* | *'"'* | *"'"* | *';'* | *'|'* | *'&'* | *'<'* | *'>'* | *'('* | *')'* | *'\'* )
    BOSUN='<path to your bosun checkout>'
    echo "[bosun] note: the install path contains characters unsafe to print; commands below use a placeholder. Move the checkout to a plain path."
    ;;
esac

cat <<EOF

[bosun]
If this message settles something without giving a reason, do not start working
yet. Ask first, in one question with two halves: why this way, and what would
one observe to know it was wrong. The question has to carry your own stake -
"why?" on its own is not enough. "Gut feeling" is a valid answer: record it
with --reason-type gut-feeling.

Once you have an answer, record it, even half of it:

  node "$BOSUN/dist/save.mjs" --statement "..." --decision "..." --why "..." \\
    --falsifier "..." --author-role human

Save returns the id and names anything still missing. Never invent a falsifier
to make an entry complete - save without it, ask, then fill it in: --id takes
any unique part of the entry's filename.

Whenever this replaces an earlier decision, say so, and prefer
--supersedes-part "part-of-its-name :: what exactly was replaced" over
--supersedes, because compression retires a rule only on a whole link. Any
unique part of the earlier entry's filename names it.

Everything else - the full field list, folding the compressed layer, rebuilding
it, migrating - is in the bosun skill and in "$BOSUN/skill/SKILL.md". Read it
when you need it, not before.

No fork, no entry: if the work could not have gone another way, nothing is
owed.
EOF
