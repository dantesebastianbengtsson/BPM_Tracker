# Three quick features: tap tempo, song search, mark learnt

Date: 2026-06-09
Status: implemented (user delegated autonomously: "research three new obvious
features, implement them, test them, report back")

## Why these three

Surveyed standard features of practice/metronome apps (Modacity, Soundbrenner,
Tempo, Metronome Beats) against what BPM Tracker already has (scheduled
metronome, working-BPM stepper with persistence, goal-BPM delta, bars
progress, folders/songs/parts, cloud sync). Missing and obvious:

1. **Tap tempo** — present in every metronome app. Players find a tempo by
   feel, not by typing numbers.
2. **Song search** — the library pane has no way to find a song once the
   list grows.
3. **Mark learnt / Reset** — completing a 16-bar part takes 16 clicks of
   `+`. One click should do it; resetting to re-drill a part likewise.

Considered and rejected (for now): drag-drop reordering (heavy UI work),
practice-session log (schema change), dark mode (design-system overhaul),
export/import (low value now that data lives in Supabase accounts).

## Design

### Tap tempo
- `Tap` button in the workspace metronome card, next to the BPM stepper.
- Component-local logic: collect tap timestamps; a gap > 2 s resets the
  series; BPM = 60000 / mean of the last ≤ 5 intervals, rounded and clamped
  to 20–260.
- From the second tap onward, persist through the existing `setBpmInput`
  path (updates the part row; the workspace effect syncs the metronome).
- No schema or service changes.

### Song search
- `songQuery` signal on the Store; `visibleSongs` additionally filters by
  case-insensitive substring on the title.
- Search input at the top of the song list with a clear (×) affordance;
  empty-state text says "No songs match" when a query is active.

### Mark learnt / Reset
- New `setLearntBars(id, bars)` on ApiService (read `total_bars`, clamp
  0..total, update `learnt_bars`) and on the Store (replace part in list,
  refresh song counts).
- In the Progress card foot: `Mark all learnt` when learnt < total,
  `Reset` when learnt > 0.

## Testing
- Extend the Playwright suite (`frontend/e2e-functional.mjs`): tap tempo sets
  working BPM near the tapped rate; search narrows and clears; mark-all
  flips the part to Learnt (n/n) and Reset returns it to 0/n.
- Existing Karma unit tests must stay green.
