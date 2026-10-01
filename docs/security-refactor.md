# Backend Security Refactor

A running log of the security refactor of the `server/` API. Each phase lists
what changed, why, and how it was verified. Updated at the end of every phase.

- **Scope:** backend only (`server/`). Client files are touched only when a
  backend fix would otherwise break a page. Docker, nginx, CI, backups and other
  infrastructure are out of scope for now (see [Deferred](#deferred)).
- **Branching:** one branch per phase, each created from the previous phase's
  branch. Branches are **not merged yet**; when merging is allowed, merge them
  in order (Phase 0 → 1 → 2 …).
- **Started:** 2026-10-01

## Status

| Phase | Branch | Status |
|---|---|---|
| 0 — Critical hotfix | `fix/auth-critical-hotfix` | ✅ Done, pushed |
| 1 — Authorization foundation | `refactor/server-authz-middleware` | ✅ Done |
| 2 — Approval workflow integrity | `refactor/approval-workflow-integrity` | Planned |
| 3 — Object-level access | `refactor/object-level-access` | Planned |
| 4 — Auth hardening | `refactor/auth-hardening` | Planned |
| 5 — Input validation and errors | `refactor/input-validation-errors` | Planned |
| 6 — Service layer | `refactor/server-service-layer` | Planned |

## Pending operations

> **After Phase 0 is deployed**, for each environment and site database
> (Marilao and Taytay, test and prod):
>
> 1. **Required:** `UPDATE users SET user_refreshtoken = NULL;` — refresh tokens
>    could be read through the API before Phase 0, so treat old ones as leaked.
>    Everyone logs in once more.
> 2. **Recommended:** rotate `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` in
>    the server `.env`, then restart. Generate each value with
>    `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

## Decisions

| Topic | Decision |
|---|---|
| Admins approving their own entries | Allowed. |
| One person approving several levels of the same entry | Allowed, as today. Only the forged-identity hole is closed. |
| Who resets or sets other users' passwords | `all_access` only. |
| Who uses User Management (create, view, edit users) | `all_access` only. `qfd_admin` may also *list* users, because the Forms edit page uses the list to pick approvers. |
| Standalone EAV endpoints (`/questions`, `/questions-value`, `/questions-sub-value`, `/form-section`) | Kept (part of the EAV design), restricted to `all_access` and `qfd_admin`. The UI writes these tables through the builder endpoints. Removal can be revisited in Phase 6. |
| Automated tests in CI | Not yet. Tests run locally with `npm test`; adding `- run: npm test` to `.github/workflows/ci.yml` is a later decision. |

---

## Phase 0 — Critical hotfix

**Branch:** `fix/auth-critical-hotfix` (from `dev`)

### Problems fixed

1. **Anyone could reset any user's password without logging in.**
   `POST /api/auth/reset-password` took a `userId` from the request body with no
   authentication. User ids are sequential, so every account, admins included,
   could be taken over.
2. **Password hashes and refresh tokens were sent to the browser.** `Users` was
   included in form-entry and user responses with no attribute list. A stolen
   refresh token could be exchanged for an access token as that user.
3. **Several routes required no login at all:** the questions, question-values,
   question-sub-values and form-section routes, and `GET /api/clients/all`.
   Anyone could change answers on approved entries.
4. **Any logged-in user could manage users and reset passwords.**

### Changes

- **Reset tokens** (`controllers/userAuth.js`). When a user must reset their
  password, login returns a `resetToken` instead of `userId`. The token:
  - expires after 15 minutes;
  - is signed with a key derived from `ACCESS_TOKEN_SECRET`, so it can never be
    used as an API token, and no new env variable is needed;
  - embeds a fingerprint of the current password hash, so it stops working once
    the password changes (single use).

  The reset endpoint also refuses accounts that aren't flagged for reset. The
  login and reset-password pages were updated to pass the token
  (`client/src/pages/login/`).
- **`Users` default scope** (`Models/Users.js`) excludes `user_password` and
  `user_refreshtoken` from every query and include. A `withSecrets` scope is
  used only by login and reset, which must read the hash.
- **`requireRole` middleware** (`middleware/requireRole.js`, new). User routes:
  list for `all_access` and `qfd_admin`; create, view, edit and reset-password
  for `all_access` only.
- **Login required** on the routes listed in problem 3.

### Verification

- Generated SQL checked for form entries, approvers and user lookups: none
  select the secret columns.
- Reset flow run end to end against a fake user. A forged token, the old
  `userId` body and a reused token are all rejected, and a reset token is
  refused as an API token.
- Role checks exercised over HTTP for every role.
- Manual browser testing by the team.

---

## Phase 1 — Authorization foundation

**Branch:** `refactor/server-authz-middleware` (from `fix/auth-critical-hotfix`)

### Problems fixed

1. **No role checks on most routes.** Any logged-in user could build or delete
   forms (deleting a form also deletes its entries), view reports, manage
   clients and rooms, and rewrite approver assignments.
2. **The server trusted identity sent by the browser.** `user_id`,
   `approver_id` and `returner_id` came from the request body. For example, an
   unassigned approver could approve an entry by sending an admin's id as
   `approver_id`, and an entry could be created in another user's name.
3. **Transactions were left open on early returns.** Handlers that opened a
   transaction and then returned a 400/403/404 never rolled it back. On MySQL
   each one leaks a pooled connection; the default pool holds 5, so a handful of
   failed requests could hang the whole API. Found by the new tests and fixed
   here instead of Phase 2.
4. **Archived users kept working.** A token issued before archiving stayed
   valid, and archived users could still log in.

### Changes

- **`verifyJWT`** (`middleware/verifyJWT.js`) now loads the caller once into
  `req.user` and rejects tokens for users that were deleted or archived (401).
  The name is unchanged, so route imports didn't change.
- **`requireRole`** now reads `req.user` (no second lookup) and exports the role
  groups `ADMINS` (`all_access`, `qfd_admin`) and `APPROVERS` (`approver` +
  admins), plus a `hasRole` helper.
- **Role rules applied to every route** (below).
- **Identity from the token.** In `controllers/formEntriesController.js`,
  create-builder, update-builder, submit-approval, approve and return use
  `req.user.id`. The client can keep sending the old fields; they're ignored.
  Existing rules are unchanged: admins can submit others' entries and approve
  without an assignment, requestors can only submit their own, and everyone can
  only edit their own.
- **Transactions.** The 6 handlers that open one (4 in form entries, 2 in forms)
  now roll back any still-open transaction in a `finally` block. The `catch`
  rollback is guarded so it can't throw on an already-committed transaction.
- **Archived accounts** are refused at login (same message as an unknown
  account) and at token refresh.
- **App split for testing.** `app.js` builds the Express app; `index.js` only
  connects to the database and listens. Startup behavior is unchanged.

### Role rules

| Routes | Allowed roles |
|---|---|
| `/api/auth/*` | public |
| `/api/dashboard/*` | all roles |
| `GET /api/forms/*` | all roles |
| `POST`/`PUT`/`DELETE /api/forms/*` | `all_access`, `qfd_admin` |
| `/api/form-entries/*` (get, pagination, entry, approval-history, create-builder, update-builder, submit-approval) | all roles |
| `POST /api/form-entries/approve`, `/return` | `approver`, `all_access`, `qfd_admin` |
| `GET /api/form-entries/all`, `DELETE /api/form-entries/:id` | `all_access`, `qfd_admin` (not used by the UI) |
| `GET /api/form-approvers/user/:userId`, `/can-approve/:entryId/:userId` | the user themselves, or `all_access`/`qfd_admin` |
| `PUT /api/form-approvers/user/:userId` | `all_access` |
| `/api/form-approvers/form/:formId` | `all_access`, `qfd_admin` |
| `/api/reports/*`, `/api/saved-reports/*` | `all_access`, `qfd_admin` |
| `/api/clients/*`, `/api/rooms/*` | `all_access`, `qfd_admin` |
| `GET /api/users/pagination` | `all_access`, `qfd_admin` |
| other `/api/users/*` | `all_access` |
| `/api/questions*`, `/api/form-section/*` | `all_access`, `qfd_admin` |

These mirror `client/src/config/routePermissions.ts` and what each page actually
calls, so legitimate use isn't blocked.

### Tests

Automated tests now exist: `vitest` and `supertest`, using an in-memory SQLite
database, so no MySQL is needed. The packages are dev-only, so the production
image is unaffected. Run them with:

```sh
cd server
npm test
```

| File | Covers |
|---|---|
| `tests/route-roles.test.js` | Every route × every role, plus no token and archived users |
| `tests/identity.test.js` | Spoofed `user_id` / `approver_id` / `returner_id` are ignored; existing approval rules still hold |
| `tests/transactions.test.js` | Early returns don't leak transactions (fails if the `finally` blocks are removed) |
| `tests/auth.test.js` | Login, refresh, archived accounts, the Phase 0 reset flow, and no secrets in responses |
| `tests/smoke.test.js` | Harness sanity checks |

Result: **411 tests passing**.

### Carried forward

- Saved reports still take `user_id` from the body. Moved to Phase 3, because
  `controllers/savedReports.js` is also changed on `feat/report-area-comparison`,
  so all overlap with that branch stays in one phase.
- An invalid or expired access token returns 403, which the client doesn't treat
  as "refresh and retry" (it only retries on 401). That's harmless with today's
  5-hour tokens, but must change in Phase 4 before access tokens are shortened.

---

## Phase 2 — Approval workflow integrity *(planned)*

- One explicit table of allowed status changes per role. Create only accepts
  `draft`/`pending`; updates only while `draft`/`pending`/`returned`, using the
  entry's stored `form_id`.
- Convert the remaining manual transactions to managed ones
  (`sequelize.transaction(async (t) => …)`).
- Per the decisions above, admins may approve their own entries and one person
  may approve several levels.

## Phase 3 — Object-level access *(planned)*

- Apply `getFormEntryVisibility` to entry reads, answers (`/entry/:id`,
  `/raw-answers`), approval history and reports.
- Saved reports: owner from the token, and filtered to that owner.
- Soft delete for forms and entries, and remove the cascade from forms to entries.
- An empty approver payload must not delete every approver on a form.
- Form builder: tie section and question ids to the form being edited.
- ⚠️ Overlaps `reportController.js` and `savedReports.js` with
  `feat/report-area-comparison`.

## Phase 4 — Auth hardening *(planned)*

- `helmet`, plus rate limiting on login, reset and refresh.
- Store only a hash of the refresh token, and rotate it on every refresh.
- Shorter access tokens, with expired tokens returning 401 (see Phase 1).
- One generic login error message; password policy enforced on create and edit
  user; remove the duplicate `bcryptjs` package.

## Phase 5 — Input validation and errors *(planned)*

- Validate request bodies and queries with `zod`; cap `pageSize`, dashboard
  `limit` and report `entry_ids`.
- One error handler returning a generic message, with details logged on the
  server only.
- Replace `sequelize.sync({ alter: true })` with migrations.
- Fix the rooms search crash (`Op` is never imported).

## Phase 6 — Service layer *(planned)*

- Split the large controllers (`formEntriesController.js` ~1,400 lines,
  `reportController.js` ~840) into services; shared pagination and response
  helpers.
- Leads into the feature refactor.

---

## Deferred

Out of scope for this refactor, recorded so they aren't lost:

- **`server/certificates/` is copied into the Docker image.** `COPY . .` with no
  `.dockerignore` entry puts the TLS private key in every image layer. Fixing it
  is a one-line `.dockerignore` change, plus rebuilding and deleting old images.
- Node 18 (server image and CI) is past end of life; MySQL 8.0 in the test
  environment too.
- nginx: no security headers, loose TLS cipher list; the API port is published
  directly, so nginx can't rate-limit it.
- Backups are unencrypted, and the backup folder has loose permissions.
- `dev` deploys through a self-hosted runner that also hosts prod.
- Client: `RoleProtectedRoute` lets users through when `user` is null; Axios
  errors (including the bearer token) are logged to the console; `xlsx@0.18.5`
  has known CVEs.
