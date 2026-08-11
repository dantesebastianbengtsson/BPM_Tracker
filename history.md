# BPM Tracker — Session Handoff

_Last updated: 2026-05-30_

## Where we left off

The app was **migrated from a local Spring Boot + H2 backend to a Supabase-backed
static Angular SPA** with email/password accounts and per-user private data. All
implementation tasks are done and verified. We are at the **final "finish the
branch" decision** — the only thing left is choosing what to do with the `dev`
branch:

1. Merge `dev` → `main` locally
2. Push + open a PR (blocked: no GitHub credentials in this environment)
3. Keep `dev` as-is
4. Discard

**Resume here:** pick one of the above. Work is on branch `dev` (normal repo, no
worktree), ahead of `main`.

## What was built (architecture)

- **Frontend:** Angular 17 SPA talks **directly to Supabase** via `@supabase/supabase-js`.
  No backend server.
- **Auth:** Supabase email/password, **email confirmation disabled** (instant login).
- **Data:** Supabase Postgres, tables `folders` / `songs` / `parts`, **Row-Level
  Security** scopes every row to `auth.uid()` (each user sees only their own data).
- **Business logic** (learnt-state, bar clamping, counts, positions) ported to pure,
  unit-tested TS helpers in `frontend/src/app/core/derive.ts` + `mappers.ts`.
- The Java `backend/` is **retired** (kept in repo for reference, removed from build).

## Supabase project

- Project name: `bpm-tracker`, ref **`dfzghyeimxbmmoigjhum`**, region `eu-central-1`.
- URL + anon key are in `frontend/src/environments/environment.ts` (anon key is
  public by design; RLS is the security boundary).
- Provisioned via the **Management API** using the user's `SUPABASE_ACCESS_TOKEN`
  (the hosted Supabase MCP OAuth failed with "redirect_uri must be a valid absolute
  URL"; the PAT + Management API was the working path). The temp token file was
  deleted. The PAT can be revoked in the Supabase dashboard if no longer needed.

## How to run / verify

```bash
cd frontend
npm install
npm start            # http://localhost:4200  -> login screen
# build: npm run build  (output dist/frontend/browser)
# unit tests: npx ng test --watch=false   (uses karma.conf.js + puppeteer Chromium, no-sandbox)
```

Verification already done:
- `ng test` → **13/13** unit tests pass.
- Live Supabase E2E (node script) → **12/12**: signup (no confirm), CRUD, adjustBars
  clamp, learnt-state, folder-delete-unfiles-songs, song-delete-cascades-parts, and
  **RLS isolation** (second user sees 0 of first user's data). Test users cleaned up.
- Headless browser smoke test → login screen renders (BPM Tracker heading, Sign in,
  email+password inputs).

## Open items / notes

- **Pre-existing bug (not introduced here):** `frontend/src/app/panes/workspace.component.ts:45`
  has an `effect()` that writes to the metronome service, throwing Angular **NG0600**
  ("signal write in reactive context"). Unrelated to storage; the metronome BPM sync
  may not work. Fix later by adding `{ allowSignalWrites: true }` to that effect.
- **Benign warning:** supabase-js logs a `Navigator LockManager` lock message in
  headless Chrome — non-fatal, auth works fine.
- **GitHub:** the repo is local-only by choice. `backend/` + `frontend/` were committed
  on `dev` but **not pushed** (no GitHub creds available). Earlier in the session the
  original local H2 database (`backend/data/`) was accidentally deleted during testing;
  user opted to start fresh (no migration).

## Docs

- Spec: `docs/superpowers/specs/2026-05-30-supabase-cloud-storage-design.md`
- Plan: `docs/superpowers/plans/2026-05-30-supabase-cloud-storage.md`
- Deploy: `DEPLOY.md` (static SPA + Supabase; host dist on any static host)

## Commit log (dev, newest first)

```
3e349c4 fix: actually gate app behind auth (app.component changes lost in 5086cc3)
a8b3fde chore: retire Spring Boot backend, switch to static SPA + Supabase
5086cc3 feat: add auth (signals), login/signup UI, gate app + load-on-login
b9a2407 feat: rewrite ApiService on Supabase (folders, songs, parts, adjustBars)
c7fd19c feat: add supabase-js client and environment config
cb6b875 feat: add DB row types and row-to-model mappers
ea8877e feat: add pure domain helpers for learnt-state, clamp, counts
97fec36 chore: configure headless Chrome (puppeteer + no-sandbox karma) for tests
488541f Add implementation plan: Supabase cloud storage with accounts
b8348e5 Add design spec: cloud storage on Supabase with accounts
47ce5ec Add Angular frontend + Spring Boot backend with deploy config
```
