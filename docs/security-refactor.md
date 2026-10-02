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
| 2 — Approval workflow integrity | `refactor/approval-workflow-integrity` | ✅ Done |
| 3 — Object-level access | `refactor/object-level-access` | ✅ Done |
| 4 — Auth hardening | `refactor/auth-hardening` | ✅ Done |
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
| Password reset or role change by an admin | Ends that user's sessions; they log in again. |
| Deleting forms, entries, clients, rooms, saved reports | Never deletes data. "Delete" means **archive**: the archive status is set to 1 and the record disappears from forms, form entries, reports, clients and rooms. Only `qfd_admin` and `all_access` can archive. |
| Saved reports | Shared: every admin sees every saved report. Only the creator can edit or refresh one; any admin can archive one. |
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
| `tests/sessions.test.js` | Sessions end on admin password reset and role change, but not on other edits (follow-up below) |
| `tests/smoke.test.js` | Harness sanity checks |

Result: **411 tests passing**.

### Follow-up: sessions end on password reset and role change

Found during manual testing: after an admin reset a user's password, the user
stayed logged in. Their refresh cookie (1 day) and access token (5 hours) kept
working, so the reset only took effect whenever that session ended on its own.
That also matters for security: resetting a possibly compromised account didn't
cut off the existing session. Role changes didn't end sessions either, so an
open tab kept showing the old role's menus until a reload.

Changes:

- **Admin password reset** (`PUT /api/users/reset-password/:id`, or a password
  set through `PUT /api/users/edit/:id`) clears the user's stored refresh token.
- **Role change** (`user_groups` actually changed in `PUT /api/users/edit/:id`)
  clears the stored refresh token. Editing other details keeps the user logged in.
- **Access tokens carry a roles fingerprint** (`grp` claim,
  `utilities/session.js`). `verifyJWT` rejects a token whose roles no longer
  match (401). Tokens issued before this change have no `grp` claim and stay
  valid until they expire, so deploying doesn't log everyone out.
- **`verifyJWT` and the refresh endpoint refuse accounts with a pending
  password reset**, so an open tab is logged out on its next request.
- **Client** (`client/src/services/api.ts`): when the automatic refresh fails,
  the app goes to `/login`. Before, the screen stayed "logged in" with every
  request failing.

Result: the user's next click takes them to login. After a password reset,
logging in takes them to the reset page; after a role change, they log in with
the new role. Covered by `tests/sessions.test.js`; **416 tests passing**.

### Carried forward

- Saved reports still take `user_id` from the body. Moved to Phase 3, because
  `controllers/savedReports.js` is also changed on `feat/report-area-comparison`,
  so all overlap with that branch stays in one phase.
- An invalid or expired access token returns 403, which the client doesn't treat
  as "refresh and retry" (it only retries on 401). That's harmless with today's
  5-hour tokens, but must change in Phase 4 before access tokens are shortened.
  *(Done in Phase 4: expired tokens now return 401.)*

---

## Phase 2 — Approval workflow integrity

**Branch:** `refactor/approval-workflow-integrity` (from `refactor/server-authz-middleware`)

### Problems fixed

1. **Entries could skip the approval workflow.** `create-builder` accepted any
   status from the request body, including `completed`, so a requestor could
   create an entry that was already completed. `update-builder` let the owner
   set any status at any time: a draft could be saved straight as `completed`,
   and an entry in an approval stage could be moved back to `draft`.
2. **Answers on approved or completed entries could be rewritten**, because
   `update-builder` didn't check the entry's current status.
3. **`update-builder` trusted the body for which entry and form to use.** It
   used `form_entry_id` from the body instead of the `:entryId` in the URL, and
   checked questions against the body's `form_id`, so a request could attach
   another form's questions to an entry.

### The workflow

```
draft ⇄ pending ──submit──► submitted_first ──approve──► approved_first ──approve──► approved_second ──approve──► completed
                                  │                          │                          │
                                  └──────── return ──────────┴──────────────────────────┴──► returned ──edit──► pending (resubmit)
                                  └──────── reject ──────────┴──────────────────────────┴──► rejected
```

`completed` and `rejected` are final. The rules for the requestor-side
endpoints live in one place, `utilities/entryStatus.js`:

| Endpoint | Entry's current status | May be saved as |
|---|---|---|
| `create-builder` | (new) | `draft`, `pending` |
| `update-builder` (owner only) | `draft` | `draft`, `pending` |
| | `pending` | `draft`, `pending` |
| | `returned` | `returned`, `pending` |
| | anything else | locked (400) |

Approval-side changes (submit, approve, reject, return) keep their existing
checks. Per the decisions above, admins may approve their own entries and one
person may approve several levels.

### Changes

- `create-builder` only accepts `CREATE_STATUSES`.
- `update-builder` checks the change with `canEditTo(current, next)`, uses the
  entry id from the URL, and validates and saves answers against the entry's
  stored `form_id`. The client already sends matching values, so no client
  change was needed.
- Every button on the create and edit entry pages maps to an allowed change
  (save draft, submit, save a returned entry, resubmit).

### Plan change

The plan included converting the manual transactions to managed ones. That's
dropped from this phase: Phase 1's `finally` rollback already fixes the actual
connection leak, and the conversion would rewrite large blocks with no change in
behavior. It fits better with the Phase 6 controller split.

### Tests

`tests/workflow.test.js`:

- Every (current status → requested status) pair for `update-builder` (100
  cases), allowed exactly when the table says so.
- Create refuses every status except `draft`/`pending`, admins included.
- Answers on a completed entry can't be rewritten.
- The URL entry id wins over the body; questions from another form are refused.
- End to end: create → submit → approve ×3 → completed, and return → edit →
  resubmit → approve.

Before the fix, the new tests showed `draft → completed` succeeding. Result:
**532 tests passing**.

## Phase 3 — Object-level access

**Branch:** `refactor/object-level-access` (from `refactor/approval-workflow-integrity`)

### Problems fixed

1. **Any logged-in user could open any entry by id.** The entry *list* was
   scoped to the user, but `GET /form-entries/get/:id`, its answers
   (`/form-entries/entry/:id`) and its approval history weren't, so changing the
   id in the URL showed anyone's entry, answers, remarks and approver emails.
2. **Deletes were permanent.** `DELETE /forms/:id` hard-deleted the form and,
   through the database cascade, every entry on it. `DELETE /form-entries/:id`
   hard-deleted the entry.
3. **Requestors could archive their own entries** by sending
   `form_entry_archivestatus: 1` to create or update.
4. **The form builder could edit other forms.** Section, question and
   sub-question ids in a request weren't checked against the form being edited,
   so one form's save could rename or archive another form's questions. The
   update also used the body's `form_id` instead of the URL's, and saving a
   form always reset it to un-archived.
5. **An empty approver payload wiped a form's approvers.**
   `PUT /form-approvers/form/:id` with `{}` deleted all of them.
6. **Saved reports trusted the body for the creator**, and edit, delete and
   refresh always failed (they read `req.userId`, which is never set).
7. `GET /clients/all` and `GET /clients/get/:id` still returned archived clients.

### Changes

- **One visibility rule for single entries.** `findVisibleEntry()` in
  `utilities/formEntryVisibility.js` applies the list's rule:
  - requestors see their own entries;
  - approvers also see entries on forms they're assigned to, once submitted;
  - admins see everything.

  It's used by the get, answers and approval-history endpoints, which answer
  404 for an entry the caller can't see, without revealing whether it exists.
- **Archive instead of delete** (admins only):

  | Record | Endpoint | Hidden from |
  |---|---|---|
  | Form | `PUT /api/forms/archive/:id` (and `DELETE /api/forms/:id`) | form lists, the report form filter, approver assignment lists; can't receive new entries |
  | Form entry | `PUT /api/form-entries/archive/:id` (and `DELETE /api/form-entries/:id`) | everywhere: lists, single-entry reads, dashboard, reports and raw answers, approval actions |
  | Client, room | `PUT /api/clients/archive/:id`, `PUT /api/rooms/archive/:id` (already existed) | their lists and lookups |
  | Saved report | `DELETE /api/saved-reports/:id` (already a soft delete) | the saved reports list |

  Nothing is removed from the database. Entries use a `FormEntries` default
  scope (`form_entry_archivestatus: 0`), so every entry query hides archived
  entries automatically; `FormEntries.unscoped()` reaches them when needed.
  Forms are filtered explicitly, because a scope there would also hide every
  entry of an archived form.
- **Entries of an archived form stay visible.** They're records of work
  already done, and the form's structure (`GET /forms/get/:id`) stays readable
  so they can still be opened. (Existing drafts on an archived form can still be
  edited and submitted; only *new* entries are blocked.)
- **Archive status is no longer accepted from create or update.** New entries
  always start un-archived; only the archive endpoint changes it.
- **Form builder:** both builders load the ids of the sections, questions and
  sub-questions that belong to the form, and skip any id in the request that
  isn't one of them. `PUT /forms/update/:id` uses the URL id, and saving a form
  never changes its archive status.
- **Approver assignments:** all three levels must be sent as arrays; clearing
  a level means sending an empty list for it. The Forms page already does this.
- **Saved reports:**
  - the creator comes from the token;
  - every admin still sees every saved report (shared);
  - only the creator can edit or refresh one;
  - any admin can archive one;
  - the `req.userId` bug is fixed.

### Merging with `feat/report-area-comparison`

That branch also changes `reportController.js`, `savedReports.js`,
`Reports.js` and `ReportsData.js`. A simulated three-way merge of all shared
files gives **no conflicts**, and the merged files keep both sets of changes.

### Tests

`tests/access.test.js` (27 tests), plus the archive routes in the role matrix:

- single-entry reads for requestors, approvers (assigned vs not, submitted vs
  pending) and admins;
- archiving entries and forms: who may archive, what's hidden where, rows still
  in the database, `DELETE` archives, requestors can't archive through
  create/update, archived forms refuse new entries, saving doesn't un-archive;
- archived clients hidden;
- form builder: another form's ids are ignored in update and in the
  delete-flag path, the URL form id wins, and normal editing still works;
- approver payloads with missing levels are refused;
- saved reports: creator from token, shared list, owner-only edit/refresh,
  archive by any admin.

Result: **569 tests passing**.

## Phase 4 — Auth hardening

**Branch:** `refactor/auth-hardening` (from `refactor/object-level-access`)

### Problems fixed

1. **Passwords could be guessed without limit.** Nothing slowed down repeated
   failed logins.
2. **Login revealed which usernames exist.** "Couldn't find your account" vs
   "Wrong password" told an attacker which usernames were real, and an unknown
   username also answered faster, because no password check ran.
3. **Refresh tokens were stored as-is.** Anyone with a copy of the database or
   a backup could use them to log in as any user with an active session.
4. **Access tokens lasted 5 hours**, and an expired one returned 403, which the
   client doesn't recover from (it only refreshes on 401).
5. **No security headers**, and `X-Powered-By: Express` was advertised.
6. **Admins could create users with any password.** The password rule only
   applied to resets.
7. Login and refresh sent internal error details to the browser on failure.

### Changes

- **Login lockout** (`utilities/loginThrottle.js`): **5 failed attempts →
  that username is locked for 15 minutes**, even for the right password. A
  successful login resets the count. Usernames match case-insensitively, and
  unknown usernames are locked the same way, so a lock never reveals whether an
  account exists. The response is `429` with "Too many failed attempts. Try
  again in N minutes."
  - The lock is per **username**, not per IP: nginx forwards raw TCP, so every
    request reaches the API from nginx's address (see Deferred).
  - It's kept in memory per server process, so a restart clears all locks.
    That's fine for one API instance per site.
  - Trade-off: someone who knows a username can lock it for 15 minutes by
    failing on purpose.
- **One login error:** "Invalid username or password" for an unknown username,
  an archived account or a wrong password. Unknown usernames are checked
  against a dummy bcrypt hash, so they take as long to answer as a wrong
  password.
- **Refresh tokens are stored as a SHA-256 hash.** Login stores the hash, and
  refresh and logout look the cookie up by its hash. **Deploying this logs
  everyone out once**, because existing stored tokens are raw and no longer
  match.
- **Refresh tokens don't rotate** (decision). Rotation would mean that when
  several requests refresh at once (several tabs open), only the first
  succeeds and the rest log out. Hashing covers the main risk, a leaked
  database. Rotation with a grace period can be added later without undoing
  anything.
- **Access tokens last 15 minutes** (login and refresh). An expired token gets
  `401`, so the client refreshes it and retries without the user noticing. A
  forged or malformed token still gets `403`.
- **`helmet`** sets security headers (`X-Content-Type-Options`,
  `X-Frame-Options`, HSTS, and others) and removes `X-Powered-By`.
  Cross-origin resource policy is `same-site`, because the client is on the
  same host on a different port.
- **One password rule** (`utilities/passwordPolicy.js`) for the user's own
  reset, an admin reset, create user and edit user: 8+ characters with an
  uppercase letter, a number and a special character.
- Removed the unused `bcryptjs` package. Login, refresh and logout errors are
  logged on the server only.

### Tests

`tests/auth-hardening.test.js` (20 tests), all failing before the change except
the "keeps working" ones:

- same message for an unknown user and a wrong password;
- lockout: 5 failures lock (even the right password then), 4 don't, a success
  resets the count, only that username is locked, unknown usernames too,
  case-insensitive, lifted after 15 minutes (tested with a simulated clock);
- refresh tokens: the database holds the hash; refresh and logout work; the
  hash itself is useless as a cookie;
- access tokens last 15 minutes; expired → 401, forged → 403;
- helmet headers present, `X-Powered-By` gone;
- weak passwords refused on create and edit user.

Result: **589 tests passing**.

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
- Convert manual transactions to managed ones
  (`sequelize.transaction(async (t) => …)`), moved here from Phase 2.
- Leads into the feature refactor.

---

## Frontend follow-ups

To do once the backend phases are finished. These come from manual testing of
the backend changes:

1. **"Not found" only appears in the browser console.** Since Phase 3, opening
   an entry you can't see (by changing the id in the URL) returns 404 from the
   entry, answers and approval-history endpoints. The page logs the error but
   shows nothing. It should show a clear "Entry not found or you don't have
   access" message (`view-form-entry.tsx`, `edit-form-entry.tsx`).
2. **Archive buttons.** The archive endpoints exist but nothing in the UI calls
   them yet:
   - `PUT /api/forms/archive/:id` (Forms page)
   - `PUT /api/form-entries/archive/:id` (Form Entry page)
   - `PUT /api/clients/archive/:id` and `PUT /api/rooms/archive/:id` (check
     whether those pages already have buttons)
   - `DELETE /api/saved-reports/:id` (Reports page)

   Show them only to `qfd_admin` and `all_access`, with a confirmation step.

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
- **Per-IP rate limiting.** nginx forwards raw TCP (`stream` TLS passthrough)
  without the PROXY protocol, so the API sees nginx's address for every
  request. Per-IP limits need either `proxy_protocol on` in nginx (plus support
  in the API's HTTPS server) or TLS termination at nginx. Until then, Phase 4
  locks per username.
- Backups are unencrypted, and the backup folder has loose permissions.
- `dev` deploys through a self-hosted runner that also hosts prod.
- Client: `RoleProtectedRoute` lets users through when `user` is null; Axios
  errors (including the bearer token) are logged to the console; `xlsx@0.18.5`
  has known CVEs.
