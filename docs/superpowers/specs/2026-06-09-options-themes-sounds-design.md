# Options menu: themes, metronome sounds, volume, accent

Date: 2026-06-09
Status: implemented (user request: "make the sound less abrasive… add an
options menu. Include dark/light mode themes, a couple of options for
metronome sounds, and other reasonable options")

## Decisions

**Sound first.** The old click was a 950 Hz square wave at fixed gain —
abrasive by construction. All presets are now synthesized sine/triangle
bursts with attack/decay envelopes (no raw square waves, no audio assets):

- **Click** (new default) — soft sine tick, ~1300 Hz, 60 ms decay
- **Wood** — triangle knock, ~640 Hz, 80 ms decay (woodblock-ish)
- **Beep** — gentle sine beep, 880 Hz, ~90 ms

**Theming** via a `data-theme="light|dark"` attribute on `<html>` with token
overrides in `_tokens.scss`. Chosen over duplicate stylesheets (maintenance)
and `prefers-color-scheme` alone (no user control). The existing light
palette is untouched; dark mode swaps surfaces/text/lines/status/shadows and
keeps the violet accent and the dark folder rail. Theme choice: Light /
Dark / System (System tracks `prefers-color-scheme` live).

**Settings storage**: `SettingsService` (signals) persisted to localStorage
under one key. These are device preferences; a Supabase table would be
overkill (YAGNI).

**Options included** (the "reasonable options" judgment call):
- Theme: Light / Dark / System
- Metronome sound: Click / Wood / Beep (changing it plays a preview)
- Metronome volume: 0–100 slider (plays a preview on release)
- Accent: accent the first beat of every 2/3/4/6 beats, or Off (default).
  Accented beats are slightly higher-pitched and louder.

Rejected for now: count-in, subdivisions, per-part time signatures (schema),
font size.

## Components

- `core/settings.service.ts` — signals `theme`, `sound`, `volume`,
  `beatsPerBar`; persists on change; applies resolved theme to
  `document.documentElement`; listens to the system scheme when on System.
- `core/metronome.service.ts` — reads settings for synthesis; tracks beat
  index for accents; gains `preview()` for the options panel.
- `app.component` — gear button next to Log out opens a small options
  panel (token-styled card, fixed top-right). Close via × or the gear.
- `_tokens.scss` — `:root[data-theme="dark"]` overrides + `color-scheme`.
- Login card restyled with tokens (it had hardcoded dark-on-dark colors,
  same defect class as the old logout button) so it themes correctly.

## Testing

Extend `frontend/e2e-functional.mjs`: open options, switch to Dark and
assert `data-theme` + canvas background change, pick Wood and assert
persistence across reload, move volume slider, set accent. Existing Karma
tests stay green.

## Addendum (same day): pickable accent colors + dark-mode contrast fixes

- **Accent colors** (user: something other than "vibe code purple"): six
  palettes — Violet (default), Blue, Teal, Green, Amber, Rose — picked from
  round swatches in Options. Applied via `data-accent` on `<html>`; each
  accent defines only `--accent` and `--accent-hover`, tints derive via
  `color-mix`. Persisted with the other settings.
- **Dark-mode fixes**: "Start metronome" paired `--text-strong` background
  with `--text-on-dark` text, which both resolve near-white in dark mode →
  new `--btn-solid-*` tokens that invert with the theme. The parts list's
  hardcoded `rgba(255,255,255,0.4)` veil became `--bg-inset` (subtle in
  both themes). The song-pane progress gradient's hardcoded violet endpoint
  now derives from the accent.
