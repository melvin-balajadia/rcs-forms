# Merge Guide: refactor and feature branches → `dev` → `main`

Step-by-step instructions for merging the backend security refactor
(Phases 0–6), `feat/report-area-comparison` and `feat/dashboard-analytics`
into `dev`, then to production. What each phase changes is described in
[security-refactor.md](security-refactor.md).

**Written:** 2026-10-02.

## How the branches relate

Each phase was branched from the previous one, so they form a chain. The
dashboard branch contains everything:

```
dev ── Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 ──┐
                                          ├──► feat/dashboard-analytics
dev ── feat/report-area-comparison ───────┘
```

| # | Branch | Tip when written | What it is |
|---|---|---|---|
| 1 | `fix/auth-critical-hotfix` | `9412dfe` | Phase 0 — critical hotfix |
| 2 | `refactor/server-authz-middleware` | `0d0b59c` | Phase 1 — role checks, tests, session ending |
| 3 | `refactor/approval-workflow-integrity` | `00bc170` | Phase 2 — workflow status rules |
| 4 | `refactor/object-level-access` | `c8a769d` | Phase 3 — visibility, archive instead of delete |
| 5 | `refactor/auth-hardening` | `3426c8f` | Phase 4 — lockout, hashed refresh tokens, helmet |
| 6 | `refactor/input-validation-errors` | `b2058cb` | Phase 5 — validation, limits, no leaked errors |
| 7 | `refactor/server-service-layer` | `7478818` | Phase 6 — service layer |
| 8 | `feat/report-area-comparison` | `49773ea` | Main vs Annex report comparison, loading states |
| 9 | `feat/dashboard-analytics` | *(in progress)* | Form filter + interactive dashboard (includes 1–8) |

If a branch gets new commits after this was written (review fixes), its tip
changes. That's fine; just merge the latest.

## Rules that keep this conflict-free

1. **Merge in the order of the table above.** Each PR then shows only its own
   changes, because everything before it is already in `dev`.
2. **Use "Create a merge commit" on every PR. Never "Squash and merge" or
   "Rebase and merge".** Squash and rebase give the commits new ids. Git then
   no longer recognizes them in the later branches, so every later PR shows the
   earlier phases again and can conflict with itself. (Your previous PRs, #1–#8,
   already used merge commits.)
3. **Don't merge `feat/dashboard-analytics` early.** It contains all the other
   branches, so merging it first would bring everything in at once and skip
   their separate reviews.
4. **A fix on one branch after review** (say Phase 3) needs to reach the
   branches after it. Merge it forward: `git checkout <next branch>`,
   `git merge --no-edit <fixed branch>`, push, and repeat down the chain (or at
   least into `feat/dashboard-analytics`).

## Before you start

- [ ] Check `dev` is up to date: `git checkout dev`, `git pull --no-edit`.
- [ ] Plan for the test deployment: **every push to `dev` deploys the test
      environment** (`deploy-test.yml`), so each merged PR redeploys test.
      That's a good thing: check the test site after each one (see
      "After each merge").
- [ ] Tell users there will be **one forced logout**. Phase 4 changes how
      refresh tokens are stored, and the secret rotation below logs everyone
      out once.

## Step 1 — Open and merge the PRs, in order

For each branch in the table, in order:

1. On GitHub, open a pull request: **base `dev` ← compare `<branch>`**.
2. Check that the "Files changed" tab only shows that branch's own changes.
   If it shows earlier phases too, the earlier PR isn't merged yet; stop and
   merge that one first.
3. Review, then **Merge pull request → "Create a merge commit"**.
4. Wait for the "Deploy (test)" workflow to finish, and run the checks in
   "After each merge".

Or from the command line (equivalent to steps 1–3, without the review):

```powershell
git checkout dev
git pull --no-edit
git merge --no-ff --no-edit origin/<branch>
git push
```

### After each merge (test site)

- [ ] The test API is up: `GET /health` → `{"status":"ok"}`.
- [ ] Log in, open the Form Entry list and the dashboard.
- [ ] Spot-check what that branch changed. The manual tests are listed per
      phase in `security-refactor.md`.
- [ ] Optional, on your machine: `cd server`, `npm ci`, `npm test`. Everything
      should pass.

## Step 2 — Operations on the test environment

Do this **once, after Phase 4 (row 5) is deployed to test** (doing it after
the last merge is fine too). If Phase 0 will sit deployed for days before
Phase 4 follows, also clear the tokens (item 1) right after Phase 0, so leaked
tokens don't stay usable in the meantime.

1. **Clear stored refresh tokens** on each test database (Marilao, Taytay):
   ```sql
   UPDATE users SET user_refreshtoken = NULL;
   ```
   Before Phase 0, refresh tokens could be read through the API, so treat
   every token issued before then as leaked.
2. **Rotate the JWT secrets** in the test server `.env`: new
   `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`, then restart the server.
   Generate each value with:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
3. Log in again and confirm everything works.

No other configuration changes are needed. The phases add no new environment
variables, and the new packages (`helmet`, `zod`) are installed by the Docker
build. The new database columns from `feat/report-area-comparison`
(`compare_area`, `area_label`) are created automatically on startup by
`sequelize.sync({ alter: true })`.

## Step 3 — Release to production (`dev` → `main`)

When the test site has been checked:

1. Open a PR **base `main` ← compare `dev`**, and merge it with **"Create a
   merge commit"**, as before. Pushing to `main` runs "Deploy (prod)".
2. Repeat **Step 2** on each **production** database and server `.env`
   (Marilao and Taytay).
3. Check each production site: `/health`, log in, open the Form Entry list
   and the dashboard.

## Step 4 — After everything is merged

This work was waiting for `feat/report-area-comparison` to be merged. Plans
are in `security-refactor.md`:

- **Migrations:** replace `sequelize.sync({ alter: true })` with Sequelize
  migrations (section "Migrations").
- **Reports at scale:** count in the database, send filters instead of id
  lists, and add a composite index on `form_question_values` (Phase 6, "Still
  to do").
- **Reports and saved reports:** move them to the service layer.

## If something goes wrong

- **A merge conflict while merging into `dev`:** a branch got merged out of
  order, or squash/rebase was used. Stop, check the order above, and ask
  before resolving: resolving it by hand can silently drop a security fix.
- **The test site breaks after a merge:** revert that PR on GitHub ("Revert"
  button on the merged PR). That creates a new commit on `dev`, which
  redeploys test without the change.
- **Everyone is logged out:** expected once (Phase 4 + Step 2). If it keeps
  happening, check that both JWT secrets are set in the server `.env` and that
  the server was restarted after changing them.
