# Changelog

What changed in RCS Forms, newest first. Add an entry whenever work is merged
into `dev`.

**How to add an entry**

- Put new work under **Unreleased**. When it's released to production, rename
  that heading to the release date and start a new **Unreleased** above it.
- Group items under these headings (skip the empty ones):
  - **Security**: fixes for vulnerabilities or access problems;
  - **Added**: new features;
  - **Changed**: behavior that works differently now;
  - **Fixed**: bugs;
  - **Removed**: features or code taken out.
- Write each item from the user's or operator's point of view, in one or two
  sentences. Name the branch when it helps.
- Add anything someone must do by hand (database changes, `.env` changes,
  forced logouts) under **Deploy notes**.

Details for the security work are in
[docs/security-refactor.md](docs/security-refactor.md). Merge and deploy steps
are in [docs/merge-guide.md](docs/merge-guide.md).

---

## Unreleased

Nothing yet.

---

## 2026-10-05: Security refactor, dashboard and client improvements

Merged into `dev` on 2026-10-05 (merge commit `f1b1921`). **Not yet released
to production.**

Branches, in merge order: `fix/auth-critical-hotfix`,
`refactor/server-authz-middleware`, `refactor/approval-workflow-integrity`,
`refactor/object-level-access`, `refactor/auth-hardening`,
`refactor/input-validation-errors`, `refactor/server-service-layer`,
`feat/report-area-comparison`, `feat/dashboard-analytics`,
`feat/client-improvements`, `feat/dashboard-widgets`.

### Deploy notes

Do these on each environment and site database (Marilao and Taytay; test, then
production) after deploying:

1. Clear stored refresh tokens: `UPDATE users SET user_refreshtoken = NULL;`
2. Rotate `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` in the server
   `.env`, then restart the server.
3. Tell users beforehand: **everyone is logged out once**.
4. The machine that builds the client must be able to reach `cdn.sheetjs.com`
   (the `xlsx` package now installs from there).

No new environment variables. The two new saved-report columns
(`compare_area`, `area_label`) are created automatically on startup.

### Security

- **Password reset:** anyone could reset any user's password without logging
  in. Resets now use a signed, single-use token that expires after 15 minutes.
- **Secrets in responses:** password hashes and refresh tokens were sent to
  the browser. They are never returned now.
- **Routes without login:** the question, answer, form-section and client
  routes required no login. They do now.
- **Role checks on every route:** only `qfd_admin` and `all_access` can build
  forms, view reports, manage clients and rooms, and assign approvers. User
  Management is `all_access` only.
- **Forged approvals:** the server trusted user and approver ids sent by the
  browser. Identity now comes from the login token only.
- **Approval workflow:** entries could be created or saved straight as
  "completed", and approved entries could be edited. Status changes now follow
  the workflow, and entries in approval are locked.
- **Entry visibility:** changing the id in the URL showed anyone's entry. Now:
  requestors see their own entries, approvers also see submitted entries on
  forms they approve, admins see everything. Anything else shows "not found".
- **Form builder:** saving one form could change another form's questions.
- **Login lockout:** 5 failed attempts lock that username for 15 minutes.
  Unknown usernames and wrong passwords get the same message.
- **Sessions:**
  - refresh tokens are stored hashed;
  - access tokens last 15 minutes and renew silently;
  - an admin password reset, a role change, or archiving a user ends that
    user's sessions.
- **Archived users** can no longer log in or keep using an old session.
- **Security headers** added with `helmet`; `X-Powered-By` removed.
- **Password rule** everywhere: 8+ characters with an uppercase letter, a
  number and a special character.
- **Input validation:** type and size checks on 26 routes; page sizes and
  report sizes are capped.
- **Error messages** no longer include SQL or stack traces.
- **Client:**
  - protected pages send logged-out users to login;
  - error logs no longer contain the login token;
  - `xlsx` upgraded to SheetJS 0.20.3, fixing CVE-2023-30533 and
    CVE-2024-22363.

### Added

- **Dashboard** (replaces the old tiles and recent-entries table):
  - **Filters:** date range (today, 7, 30, 90 days or custom) and area for
    everyone. Only `all_access` can choose a different site.
  - **Widgets:**
    - forms accomplished per day (line chart, Main and Annex);
    - approval pipeline;
    - waiting for your approval;
    - returned entries;
    - entries per form;
    - most-returned forms;
    - recent form entries.
  - **Layout by role:** requestors see their own entries; approvers and
    admins get the approval widgets.
  - **Drill-down:** every number opens the matching entries in Form Entry.
  - Days are counted in Philippine time.
- **Archive actions** on Forms, Form Entry, Reports, Clients and Rooms, with a
  confirmation step (`qfd_admin` and `all_access`). The bulk "Delete" button,
  which only hid rows until refresh, is now a real "Archive selected".
- **User archiving** (`all_access` only):
  - nobody can archive their own account;
  - the user's approver assignments are switched off;
  - their sessions end immediately.
- **Form Entry filters:**
  - "Filter by form";
  - "Awaiting Approval (any level)" status option;
  - filters kept in the page address, so they survive a refresh;
  - chips showing filters that came from a dashboard link.
- **Reports:** Main vs Annex comparison on the overall summary; saved reports
  remember it.
- **Server tests:** 691 automated tests (`cd server && npm test`).

### Changed

- **Delete means archive:** deleting a form, entry, client, room or saved
  report sets its archive status instead of removing it from the database.
  Admins only.
- **Saved reports** are shared among admins. Only the creator can edit or
  refresh one; any admin can archive one.
- **Server structure:** logic moved from the large controllers into
  `server/services/`. API responses are unchanged.
- **Loading states:** pages share one loading style, and the session check
  lives in one place.

### Fixed

- **Hung API:** failed requests left database transactions open, which could
  hang the API.
- **Return count:** the return response reported the wrong count after an
  entry's first return.
- **Rooms search:** it crashed when filters were used.
- **Default dates:** the default date on new entries and reports showed
  yesterday before 8 AM.
- **Date filter:** the date-range filter on Form Entry left out the last day.
- **Entry not found:** opening an entry you can't see now shows "Entry not
  found or you don't have access" instead of an endless spinner.
- **Overflow:**
  - table filters wrap instead of overflowing the card;
  - long form names fit the "Filter by form" field;
  - the Required toggle stays inside the form builder card on phones.
- **Grey loading band:** refreshing a page no longer shows a grey band.

### Removed

- "Edit" in the saved report row menu (there was no edit page).
- The four metric tiles and the old recent-entries table on the dashboard
  (replaced by the new widgets).
- Unused server code: `getPendingApprovals`, `updateForm`, and the `bcryptjs`
  package.
