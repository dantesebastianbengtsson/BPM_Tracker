# De-boxify: collapsing library, flowing workspace, motion

Date: 2026-06-09
Status: implemented (user: "+ New part under the parts… far too boxy… hide or
at least shrink the songs list but show the current one… fun animation when
shrinking, expanding upon hovering… everything is too horizontal, categories
upon categories, feels robotic")

## Changes

**Collapsing library.** Once a song is selected, the songs column shrinks to
a 64 px strip showing a music icon and the current song's title written
vertically. Hovering the strip springs it back to full width (overshoot
easing, `cubic-bezier(0.34, 1.56, 0.64, 1)`) with the list fading back in;
moving the mouse away collapses it again. No selection → stays expanded
(it's the only navigation). Disabled ≤1024 px where the workspace is hidden
and the list is the primary surface. Implementation: `collapsed` host class
from a computed on the store + pure CSS `:host(.collapsed:not(:hover))`
width/opacity transitions; the shell grid's middle column becomes `auto`.

**De-boxed workspace.** The three cards (Progress / Tempo / Details) are
gone. The hero is now one centered vertical flow on the bare canvas: big
bars counter with round ± buttons → progress track → quick actions, a soft
fading divider, then the tempo block (BPM stepper, metronome/tap, goal
line), then a quiet "Edit part · Delete part" text-action row (the Details
card was redundant — title, bars and state are all visible elsewhere). The
edit form renders inline in the same spot. Sections stagger-rise on part
selection (~50 ms apart).

**New part placement.** The header button is gone; a dashed "New part" row
sits at the bottom of the parts list — where the eye lands after scanning
parts. The inline create form opens in its place. Part cards get a small
hover nudge to the right.

Also tokenized the two remaining hardcoded violets (bars-track gradient,
round-button glow) so they follow the accent.

## Testing

E2e selectors updated (`.add-part`); library interactions hover the strip
first via an `openLibrary()` helper. Full suite + Karma must stay green.
