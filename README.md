# rcs-forms

A Dockerized deployment setup for the QFSD Forms application (Vite/React client +
Node/Express server + MySQL) with automated CI/CD via GitHub Actions —
**multi-site**: one codebase, deployed independently per physical site.

| Site | Test | Production |
|---|---|---|
| Marilao | https://mqfdform.royalecoldstorage.com.ph:1002 (client) · :8082 (server) | https://rcsmqfdform.royalecoldstorage.com.ph:2002 (client) · :8087 (server) |
| Taytay | https://tqfdform.royalecoldstorage.com.ph:1004 (client) · :8084 (server) | https://rcstqfdform.royalecoldstorage.com.ph:2004 (client) · :8089 (server) |

Adding another site later is a **config change, not a code change** — see
*Adding a new site* below.

---

## For New Developers — Local Setup

This is all you need to start coding. No Docker required for local development.
Local dev always targets **one** site's data at a time — whichever `.env` you
create points at that site's database.

### Prerequisites

Install these on your machine:

- [Git](https://git-scm.com/download/win)
- [Node.js](https://nodejs.org/) — the Docker images pin **client → Node 22**,
  **server → Node 18** (see `client/Dockerfile` / `server/Dockerfile`); match those
  locally if you hit a "works in Docker, weird locally" bug.

### Step 1 — Clone the repo

```bash
git clone https://github.com/melvin-balajadia/rcs-forms.git
cd rcs-forms
```

### Step 2 — Switch to the dev branch

```bash
git checkout dev
```

### Step 3 — Set up the server

`server/.env.example` has the full key shape (git-tracked, no real secrets in
it) — copy it and fill in real values (ask a teammate/admin, since the actual
DB password/JWT secrets aren't in git):

```bash
cd server
cp .env.example .env
# edit .env: real DB credentials, real secrets — MYSQL_HOST=localhost is
# already correct as-is for local dev, don't change it to `mysql` here
npm install
npm start          # runs nodemon index.js — no separate "dev" script exists
```

With no `NODE_ENV` override it defaults to `dev`, which serves plain HTTP on
`PORT_DEV` — no SSL certs needed for local work at all.

> ⚠️ **`MYSQL_HOST=localhost` is only correct here** (local dev, MySQL running
> natively on your machine). Every **Docker-deployed** environment (test/prod,
> any site) needs `MYSQL_HOST=mysql` instead — that's the Compose service name,
> not a hostname. Mixing these up is a real, easy-to-make mistake (see
> Troubleshooting) — copying this exact template into a `SITE_ENV` secret
> without changing this one line will break that deploy.

### Step 4 — Set up the client (new terminal)

```bash
cd client
npm install
cp .env.example .env
# edit .env: match whatever PORT_DEV you set on the server — Vite bakes
# VITE_API_URL in at dev-server start, it isn't read from the server's own .env
npm run dev
```

> ⚠️ **Known inconsistency**: `client/vite.config.ts` sets the dev server to run
> on **port 1002**, but `server/config/allowedOrigin.js`'s CORS allowlist still
> has `http://localhost:5173` (Vite's usual default) instead. If you hit a CORS
> error in the browser console during local dev, this is why — add
> `http://localhost:1002` to `allowedOrigins` in that file.

Client runs at → whatever port `vite.config.ts` reports (currently `1002`)
Server runs at → `http://localhost:<PORT_DEV>`

---

## Daily Coding Workflow

Always work on the `dev` branch.

```bash
git checkout dev
git pull origin dev

# make your changes in client/ or server/

git add .
git commit -m "describe what you changed"
git push origin dev
```

Pushing to `dev` **automatically deploys to every site's test environment** —
Marilao and Taytay both redeploy from the same push, in parallel. Check each
site's test URL above to verify.

---

## Deploying to Production

Only do this once you're happy with what's on test — **there is currently no
required-reviewer approval gate** (GitHub Environments' protection rules need
GitHub Pro on a private repo; this repo is on the Free plan), so merging to
`main` deploys immediately, with no pause to reconsider, to **every site at once**.

### Option A — Via GitHub (recommended)

1. Go to the repo on GitHub
2. **Pull requests → New pull request**
3. `base: main` ← `compare: dev`
4. **Create pull request → Merge pull request**

### Option B — Via Git locally

```bash
git checkout main
git merge dev
git push origin main
```

Pushing to `main` triggers **Deploy to Production** for every configured site.

---

## How the CI/CD Pipeline Works

### CI (`ci.yml`) — runs on every push/PR to `dev` or `main`

GitHub-hosted runners, not the self-hosted ones — build/lint only, nothing touches
a VM, and it's site-agnostic (same app code regardless of site).

- `client`: `npm ci` → `npm run lint` (non-blocking — see *Known Gaps*) → `npm run build`
- `server`: `npm ci` only (no test suite exists yet)

### Test Pipeline (`deploy-test.yml`, triggers on push to `dev`)

```
Push to dev
    ↓
discover-sites job: list sites/*.conf → emit as a matrix (one entry per site)
    ↓
For EACH site, in parallel, on that site's own "<site>-test"-labeled runner:
    Stop existing containers for this site (docker compose -p qfsd-<site>-test down)
        ↓
    Checkout source (clean: false — server/certificates/ is git-ignored and must survive)
        ↓
    Write server/.env.<site>.test from GitHub Secret SITE_ENV (environment: <site>-test)
        ↓
    bash deploy.sh <site> test --build
        → snapshots current images, stops old, builds + starts new,
          confirms all 4 containers "running", then health-checks (see below)
        ↓
    Delete .env.<site>.test from disk (always, even on failure)
```

### Production Pipeline (`deploy-prod.yml`, triggers on push to `main`)

Same shape as test, on each site's `<site>-prod` runner label and
`<site>-prod` GitHub Environment, with one addition: `bash deploy.sh <site>
prod --rollback` runs automatically if the deploy step fails (image
snapshot/rollback logic lives inside `deploy.sh`, not the workflow).

### The health check, and why it works the way it does

`deploy.sh` verifies the deploy by running `curl` **inside the nginx container**
(`docker exec qfsd_<site>_nginx_<env> curl ... https://localhost:<port>/health`),
not against the host-published port. This exercises the real nginx → server
passthrough while staying entirely inside Docker's own network — it doesn't
depend on anything about how the host machine's networking is set up.

It also **retries** — up to 12 attempts, 10s apart — instead of one fixed sleep
+ single check. `sequelize.sync()` can take a variable amount of time (longer
on a fresh database creating every table from scratch), so the app may not be
listening yet the instant the first attempt runs; retrying avoids failing a
perfectly good deploy just because it was checked a few seconds too early.

---

## Adding a new site

This is the entire process — no workflow YAML edits required:

1. **Create `sites/<newsite>.conf`** (copy `sites/taytay.conf` as a template) with
   that site's test/prod domains, client/server ports, and a MySQL host port
   that doesn't collide with any other site or app already running on the same
   VMs (`docker ps` / check `sites/*.conf` for what's taken).
2. **Create GitHub Environments** `<newsite>-test` and `<newsite>-prod`
   (Settings → Environments), each with a `SITE_ENV` secret holding that
   site+env's `.env` contents — double-check `MYSQL_HOST=mysql` and
   `PORT_TEST`/`PORT_PROD` match that site's `.conf` (see Troubleshooting —
   both have caused real deploy failures).
3. **Add runner labels** `<newsite>-test` / `<newsite>-prod` to whichever
   physical runners should host it (Settings → Actions → Runners → click a
   runner → Labels).
4. **Place the SSL certs** — if the new site is also a `*.royalecoldstorage.com.ph`
   subdomain, `server/certificates/` (already there) covers it, nothing to do.
   A genuinely different domain would need its own cert added there instead.
5. Push to `dev` — the new site appears in the next deploy's matrix automatically.

---

## Managing a change that should apply to only one site

Since every site deploys from the same commit, a code change on `dev`/`main`
reaches **every** site at once — there's no per-site branch or fork. For a
difference that should only apply to one site, keep the one codebase and drive
the difference from config instead:

- **A config value or limit** — add it to that one site's `.env` (its
  `SITE_ENV` secret) and read it in code (`process.env.WHATEVER`). Already the
  pattern used for DB credentials, ports, and domains.
- **Something frontend-facing** (logo, display name, a UI toggle) — follow the
  existing precedent: `VITE_API_URL` is already a per-site build arg in
  `docker-compose.test.yml`/`.prod.yml`. Add a new one (`VITE_SITE_NAME`, etc.)
  the same way, set differently per site in `sites/<site>.conf`, read via
  `import.meta.env.VITE_SITE_NAME` in the client.
- **A different code path or business rule** — gate it behind a flag read from
  that site's `.env` (`if (process.env.FEATURE_X_ENABLED === "true")`) rather
  than forking the repo. The same commit still builds and deploys everywhere;
  only the site whose `.env` sets the flag actually behaves differently.

**Known gap**: nothing inside the running app currently knows *which site it
is* — `SITE` only exists at the Compose/shell level for naming containers and
volumes, it's never passed into the container itself. If code needs to branch
on "am I Taytay or Marilao" specifically (not just on a feature flag), add
`SITE=<site>` as an explicit line in each site's `.env`, or thread `${SITE}`
through as a proper `environment:` entry in the compose files.

**Don't**: branch-per-site or fork-per-site. That reintroduces exactly the
problem this pipeline was built to avoid — every future fix needing to be
re-applied N times instead of landing once.

---

## Rollback

### Automatic Rollback (Prod only)

If `deploy.sh <site> prod --build` fails for a given site — including its
health check — the workflow automatically runs `deploy.sh <site> prod
--rollback`, restoring that site's previous images from
`C:\deploy_rollback\<site>\prod`. Other sites in the same matrix run are
unaffected by one site's failure (`fail-fast: false`).

### Manual Rollback

```bash
# RDP/AnyDesk into the target server, open Git Bash
bash deploy.sh marilao prod --rollback
bash deploy.sh taytay prod --rollback
bash deploy.sh <site> test --rollback   # deploy.sh supports it for test too, just not wired into CI
```

> ⚠️ Requires a previous successful deploy to have snapshot files in
> `C:\deploy_rollback\<site>\<env>`. On the very first deploy for a site, no
> snapshots exist yet.

### Manual Teardown

```bash
bash deploy.sh marilao test --down
bash deploy.sh taytay prod --down
```

---

## Branching Rules

| Branch | Purpose                       | Deploys to |
| ------ | ----------------------------- | ---------- |
| `dev`  | Daily development work        | Every site's Test environment |
| `main` | Stable, production-ready code | Every site's Production environment |

- Branch off `dev` for new feature work
- Don't push directly to `main`
- Verify test is working (**on every site**, not just one) before merging to `main` — remember, there's no approval gate to catch you

---

## For Server Admins — Setting Up a New VM

### Step 1 — Install prerequisites

- [Git for Windows](https://git-scm.com/download/win) (workflows call `C:\Program Files\Git\bin\bash.exe` directly)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```powershell
git --version
docker --version
```

### Step 2 — Create the rollback directories (one per site+env this VM will host)

```powershell
mkdir C:\deploy_rollback\marilao\test
mkdir C:\deploy_rollback\taytay\test
# (repeat with \prod on the Production VM)
```

### Step 3 — Set up the GitHub Actions runner

A single runner on a VM can carry labels for multiple sites — you don't need a
separate runner install per site, only per repo (and per Windows service if
this VM also hosts something like `smartscan-docker`, which is a different repo).

1. GitHub repo → **Settings → Actions → Runners → New self-hosted runner**
2. Select **Windows**, **x64**
3. In an admin PowerShell:

```powershell
mkdir C:\actions-runner-qfsd; cd C:\actions-runner-qfsd

Invoke-WebRequest -Uri <url GitHub shows you> -OutFile actions-runner.zip
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory("$PWD\actions-runner.zip", "$PWD")

# TEST VM — one runner, labeled for every site it hosts:
./config.cmd --url https://github.com/melvin-balajadia/rcs-forms --token <token> --labels marilao-test,taytay-test --runasservice

# PRODUCTION VM:
./config.cmd --url https://github.com/melvin-balajadia/rcs-forms --token <token> --labels marilao-prod,taytay-prod --runasservice
```

> If this VM already runs a runner for another repo (e.g. `smartscan-docker`),
> use a **separate install folder** — a self-hosted runner on a personal GitHub
> account is bound to exactly one repo, it can't be shared. Adding a new site
> to *this* repo later, though, is just adding a label to the *existing*
> rcs-forms runner — no new install.
>
> Label names use **hyphens** (`marilao-test`), not underscores
> (`marilao_test`) — GitHub label matching is a literal string comparison, and
> this exact mismatch has caused a job to sit "Waiting for a runner" forever
> before. Double-check after adding.

4. Verify it shows **Idle (green)** under Settings → Actions → Runners, with
   every label (`<site>-test` or `<site>-prod`) the corresponding matrix job
   will request.

### Step 4 — Place SSL certificates

Certs are **not** stored in the repo (git-ignored). Every site currently in
this repo shares one wildcard cert (`*.royalecoldstorage.com.ph`), so this is
a one-time setup regardless of how many sites are deployed here.

Place them at a **stable location outside the runner's workspace**, not inside
the repo checkout:

```
C:\qfsdforms-certs\
├── server.crt   ← leaf cert
├── inter.crt    ← intermediate chain
└── cert.key     ← private key
```

Both `deploy-test.yml` and `deploy-prod.yml` have a **Restore certs** step
(`xcopy "C:\qfsdforms-certs" "%CD%\server\certificates\" /E /I /Y`) that copies
these into the checkout at the start of every run — so the certs survive even
if the runner's `_work` folder gets deleted and recreated (e.g. the
"workspace is locked" fix in Troubleshooting, which otherwise would have taken
the shared cert down with it, for every site). This location is independent of
which VM, which install folder, or which repo checkout path is in use — set it
up once per VM and every site's every deploy picks it up automatically.

If you only have a merged/full-chain bundle (leaf + intermediates + root
concatenated into one file), split it back into the three pieces above before
placing them in `C:\qfsdforms-certs\`:

```bash
awk '/BEGIN CERTIFICATE/{n++} {print > ("block"n".crt")}' cert.crt
mv block1.crt server.crt              # leaf
cat block2.crt block3.crt > inter.crt # intermediate chain (drop the self-signed root block)
```

### Step 5 — Add GitHub Environments + Secrets (per site, per env)

1. Repo → **Settings → Environments** → create `<site>-test` and `<site>-prod`
   for each site (e.g. `marilao-test`, `marilao-prod`, `taytay-test`, `taytay-prod`).
2. Each environment → **Environment secrets** → add `SITE_ENV` (full contents of
   what should become `server/.env.<site>.<env>`).

Use `server/.env.example` as the starting point — copy it, fill in real
values, paste the whole thing as the `SITE_ENV` secret's value. **Two values
have already caused real failed deploys** — check these carefully (also
flagged inline in `.env.example` itself):

| Value | Must be | Why |
|---|---|---|
| `MYSQL_HOST` | `mysql` (never `localhost`) | `localhost` inside a container means "this container," not the database — connection refused every time. The Local Setup template above uses `localhost` on purpose (that's for native local dev), don't carry that value over into a `SITE_ENV` secret. |
| `PORT_TEST` / `PORT_PROD` | exactly that site's `TEST_SERVER_PORT` / `PROD_SERVER_PORT` from `sites/<site>.conf` | nginx routes to the app on this port; if the app is actually listening on a different one (e.g. a copy-pasted default), nginx's upstream connection is refused and the health check fails even though every container shows "running." |

> ⚠️ No trailing spaces after any line — Docker will reject the variable and
> the container fails to start.

### Step 6 — Open firewall ports (per site on this VM)

```powershell
# Marilao
New-NetFirewallRule -DisplayName "QFSD Marilao Test Client"  -Direction Inbound -Protocol TCP -LocalPort 1002 -Action Allow
New-NetFirewallRule -DisplayName "QFSD Marilao Test Server"  -Direction Inbound -Protocol TCP -LocalPort 8082 -Action Allow
New-NetFirewallRule -DisplayName "QFSD Marilao Prod Client"  -Direction Inbound -Protocol TCP -LocalPort 2002 -Action Allow
New-NetFirewallRule -DisplayName "QFSD Marilao Prod Server"  -Direction Inbound -Protocol TCP -LocalPort 8087 -Action Allow

# Taytay
New-NetFirewallRule -DisplayName "QFSD Taytay Test Client"   -Direction Inbound -Protocol TCP -LocalPort 1004 -Action Allow
New-NetFirewallRule -DisplayName "QFSD Taytay Test Server"   -Direction Inbound -Protocol TCP -LocalPort 8084 -Action Allow
New-NetFirewallRule -DisplayName "QFSD Taytay Prod Client"   -Direction Inbound -Protocol TCP -LocalPort 2004 -Action Allow
New-NetFirewallRule -DisplayName "QFSD Taytay Prod Server"   -Direction Inbound -Protocol TCP -LocalPort 8089 -Action Allow
```

> Do **not** open `3309`/`3310` (MySQL, one port per site) — internal only,
> never expose a database port to the internet.

### Step 7 — Trigger the first deploy

```bash
git push origin dev    # → every site's Test
git push origin main   # → every site's Production
```

### Step 8 — Verify

```powershell
docker ps --format "table {{.Names}}\t{{.Status}}"
```

You should see both sites' containers (`qfsd_marilao_*` and `qfsd_taytay_*`)
running side by side, on their own ports, without touching each other.

### Migrating an existing manual deployment onto this pipeline

If a VM already has containers running from a hand-rolled `docker compose up`
(no CI, no site-scoping), the new CI-driven stack uses **different, pinned
project/volume names** (`qfsd-<site>-<env>` vs whatever the old folder's
directory name produced) — so it'll start with an empty database unless you
point it at the old data. This repo already has three examples of this:

| Override file | Reuses volume |
|---|---|
| `docker-compose.marilao.test.override.yml` | `qfsd-forms_mysql_data` |
| `docker-compose.marilao.prod.override.yml` | `qfsdforms_marilao_mysql_data` |
| `docker-compose.taytay.prod.override.yml` | `qfsdforms_taytay_mysql_data` |

(Marilao and Taytay's production environments were both already running
manually — as `qfsdforms_marilao-*`/`qfsdforms_taytay-*` containers — before
this pipeline existed, each with real data. Only Taytay's *test* environment
is genuinely fresh.) To do the same for another migrated site:

```powershell
docker inspect <old_mysql_container_name> --format "{{json .Mounts}}"
```

Find the old volume name, then create `docker-compose.<site>.<env>.override.yml`:

```yaml
volumes:
  mysql_data:
    external: true
    name: <the-old-volume-name>
```

`deploy.sh` picks up any file matching that name pattern automatically — no
script changes needed. Then stop the old stack (`docker compose down` — **no**
`-v`, that deletes volumes) to free its ports before the new stack tries to
bind them.

> ⚠️ **These override files need to stay forever**, not just for a transition
> period. They're a permanent bridge between the CI-managed compose project and
> a volume that already existed under a different name — the underlying Docker
> volume never renames itself to match the new convention. Removing the
> override later would make Compose silently create a **new, empty** volume
> under the standard name instead of reattaching to the real data — it would
> look exactly like everything vanished. The only way to retire one is a
> deliberate one-time migration (create a volume under the standard name, copy
> the data across, verify, then remove the override) — optional cleanup, not
> something that happens on its own.

---

## Useful Docker Commands

```bash
# View live logs (per site)
docker compose -p qfsd-marilao-test -f docker-compose.test.yml logs -f
docker compose -p qfsd-taytay-prod -f docker-compose.prod.yml logs -f

# View logs for a specific container
docker logs qfsd_marilao_server_test --tail 50
docker logs qfsd_taytay_server_prod --tail 50

# Restart a single container
docker restart qfsd_marilao_server_test
docker restart qfsd_taytay_nginx_test

# Shell into a container
docker exec -it qfsd_marilao_server_test sh
docker exec -it qfsd_taytay_mysql_test sh

# Connect to MySQL
docker exec -it qfsd_marilao_mysql_test mysql -u root -p

# Manually re-run the same health check deploy.sh does
docker exec qfsd_marilao_nginx_test curl -sk --tlsv1.2 -o /dev/null -w "%{http_code}\n" https://localhost:8082/health

# Stop everything for a site
docker compose -p qfsd-marilao-test -f docker-compose.test.yml down
docker compose -p qfsd-taytay-prod -f docker-compose.prod.yml down

# Manual deploy with forced rebuild
"C:\Program Files\Git\bin\bash.exe" -c "bash deploy.sh marilao test --build"
"C:\Program Files\Git\bin\bash.exe" -c "bash deploy.sh taytay prod --build"

# Manual rollback
"C:\Program Files\Git\bin\bash.exe" -c "bash deploy.sh marilao prod --rollback"

# See which sites deploy.sh knows about
bash deploy.sh   # prints usage + lists everything under sites/*.conf
```

---

## Troubleshooting

### Job stuck on "Waiting for a runner to pick up this job..."

The runner is either offline, or its labels don't match `runs-on:` for that
site (`self-hosted` + `<site>-test`, or `self-hosted` + `<site>-prod`). Check
**Settings → Actions → Runners** for status and labels — including whether the
label is hyphenated correctly (`marilao-test`, not `marilao_test`; GitHub
matches labels as literal strings). If you add/fix a label *after* a job is
already queued, cancel that run and re-trigger — the scheduler doesn't always
re-check an already-queued job against a newly added label.

```powershell
Get-Service actions.runner.*
Start-Service "actions.runner.<name>"
```

### Container keeps restarting / `ECONNREFUSED ::1:3306` in server logs

`MYSQL_HOST` in that site's `SITE_ENV` secret is set to `localhost` instead of
`mysql`. Inside a container, `localhost` means "this container," not the
database — the app tries to connect to itself and fails. Fix the secret's
`MYSQL_HOST` value, re-run the job (no push needed, secrets are read fresh on
each run).

### Health check fails, but the server logs show it started fine

(`docker logs qfsd_<site>_server_<env>` shows a successful DB connection and
"Test/Production server running" — the app itself is fine.)

Check the **nginx** container's logs instead:
```bash
docker logs qfsd_<site>_nginx_<env> --tail 50
```
If you see `connect() failed (111: Connection refused) ... upstream:
"<ip>:<port>"` — nginx is trying to reach the app on a port nothing's actually
listening on. This means `PORT_TEST`/`PORT_PROD` in that site's `SITE_ENV`
secret doesn't match `SERVER_PORT` in `sites/<site>.conf` (nginx routes using
the `.conf` value; the app binds using `PORT_TEST`/`PORT_PROD` — these have to
agree). Fix the secret, re-run.

### `502 Bad Gateway` — server container crashed

```bash
docker logs qfsd_<site>_server_prod --tail 50
```

Common causes: bad `.env` values, DB connection failed, or — specific to this
app — missing SSL certs. `server/index.js` builds its HTTPS server object
unconditionally at startup (before the dev/test/prod branch check), so a
missing cert file crashes the process immediately rather than falling back to
HTTP as the code comments imply.

### `.env file not found` during deploy

Check **Settings → Environments → <site>-(test|production) → Environment
secrets** — verify `SITE_ENV` actually exists on that specific site+env's
environment (not just some other site's).

### `container name already in use` / port already allocated

Usually means an old stack (manual, or a different site) is still holding the
port — check `sites/*.conf` for what's supposed to be free, and:

```bash
docker compose -p qfsd-<site>-prod -f docker-compose.prod.yml down --remove-orphans
```

Then re-run the workflow from the Actions tab.

### Health check fails after several retries, containers all show "running" the whole time

`deploy.sh`'s health check retries up to 12 times (10s apart) precisely because
`sequelize.sync()` can be slow on a fresh database — if it's still failing
after all 12 attempts, that's no longer a timing issue. Get the actual error:

```bash
docker exec qfsd_<site>_nginx_<env> curl -sk --tlsv1.2 -v https://localhost:<port>/health
docker logs qfsd_<site>_server_<env> --tail 50
```

### Runner workspace is locked / access denied

```powershell
net stop actions.runner.<name>
rd /s /q "C:\actions-runner-qfsd\_work\rcs-forms"
net start actions.runner.<name>
```

Then retrigger the deploy (this affects every site's next run on that runner,
since the workspace is shared — not per-site). Safe to do — the shared cert
lives in `C:\qfsdforms-certs\`, outside this folder, and gets restored back
into the fresh workspace automatically on the next run.

### CORS errors in the browser

Check `server/config/allowedOrigin.js` includes the exact origin you're hitting
from, including the port — this list needs every site's client URL, not just
one. Known gap: local dev's actual Vite port (`1002`, per
`client/vite.config.ts`) isn't in the allowlist, only `http://localhost:5173` is.

### `$'\r': command not found` — Windows line endings in a shell script

```bash
sed -i 's/\r//' deploy.sh
```

### Rollback snapshot is `none` or missing

Normal on a site's very first deploy — no previous images exist yet to
snapshot. From the second deploy onward it'll be populated:

```bash
cat /c/deploy_rollback/marilao/prod/server_prev.txt
cat /c/deploy_rollback/taytay/prod/client_prev.txt
```

### Two sites' containers seem to be interfering with each other

They shouldn't — each site gets its own Compose project (`qfsd-<site>-<env>`),
network, volumes, and ports (defined in that site's `sites/<site>.conf`). If
you see cross-talk, the most likely cause is two sites' `.conf` files
accidentally sharing a port — check `sites/*.conf` for duplicate
`*_CLIENT_PORT`/`*_SERVER_PORT`/`*_MYSQL_PORT` values on the same VM.

---

## Known Gaps (deliberately deferred, not oversights)

- **No automated DB backups** — unlike some other projects on this account,
  there's no scheduled backup container here yet.
- **No branch protection / required reviewers** — the repo is private on
  GitHub's Free plan, which doesn't support either for private repos (Pro
  upgrade, ~$4/mo, would unlock both) — and either way it would apply
  per-environment, so per-site, not globally.
- **No Compose-level `healthcheck:` blocks** on the `client`/`server`/`nginx`
  services (only `mysql` has one) — `deploy.sh`'s post-deploy check only
  confirms containers are *running*, not passing an internal health probe. Its
  own retrying curl (via `docker exec`) to `/health` is the real correctness
  check.
- **Client lint has ~120 pre-existing errors** (mostly
  `@typescript-eslint/no-explicit-any`) — `ci.yml` runs lint with
  `continue-on-error: true` so it doesn't block merges; worth a cleanup pass
  separately.
- **`client/vite.config.ts` dev port vs. CORS allowlist mismatch** — see
  Troubleshooting above.
- **`fail-fast: false` on the deploy matrix** means one site's deploy failure
  doesn't cancel other sites' — intentional, but it also means a partially-
  failed push across sites needs a human to notice and reconcile which sites
  are now on which commit.
- **No `SITE` variable inside the running app container** — the app currently
  has no way to know which site it's deployed for except indirectly through
  its own `.env` values. See *Managing a change that should apply to only one
  site* above if code ever needs to branch on site identity directly.
