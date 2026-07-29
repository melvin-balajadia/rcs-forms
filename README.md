# qfsd-forms

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
git clone https://github.com/melvin-balajadia/marilao-qfsdforms.git
cd marilao-qfsdforms
```

### Step 2 — Switch to the dev branch

```bash
git checkout dev
```

### Step 3 — Set up the server

There's no `.env.example` checked in (env files are git-ignored on purpose — they
hold DB passwords and JWT secrets). Ask a teammate/admin for real values, or use
the shape below:

```
NODE_ENV=dev
PORT_DEV=5003
PORT_TEST=8082
PORT_PROD=8087
MYSQL_HOST=localhost
MYSQL_USER=your_db_user
MYSQL_PASSWORD=your_db_password
MYSQL_DATABASE=your_db_name
MYSQL_ROOT_PASSWORD=your_root_password
CLIENT_PORT=1002
VITE_API_URL=http://localhost:5003
ACCESS_TOKEN_SECRET=your_secret
REFRESH_TOKEN_SECRET=your_secret
```

```bash
cd server
# create .env with the values above (MYSQL_HOST=localhost if you're running
# MySQL natively, or point it at whichever site's DB you're working against)
npm install
npm start          # runs nodemon index.js — no separate "dev" script exists
```

With no `NODE_ENV` override it defaults to `dev`, which serves plain HTTP on
`PORT_DEV` — no SSL certs needed for local work at all.

### Step 4 — Set up the client (new terminal)

```bash
cd client
npm install
```

Create `client/.env` with:

```
VITE_API_URL=http://localhost:5003
```

(match whatever `PORT_DEV` you set on the server — Vite bakes `VITE_API_URL` in
at build/dev-server start, it isn't read from the server's `.env`.)

```bash
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
          confirms all 4 containers "running", curls https://localhost:<port>/health
        ↓
    Delete .env.<site>.test from disk (always, even on failure)
```

### Production Pipeline (`deploy-prod.yml`, triggers on push to `main`)

Same shape as test, on each site's `<site>-prod` runner label and
`<site>-prod` GitHub Environment, with one addition: `bash deploy.sh <site>
prod --rollback` runs automatically if the deploy step fails (image
snapshot/rollback logic lives inside `deploy.sh`, not the workflow).

> **Why does the health check hit `localhost` and not the public domain?**
> It runs *on the same VM* it's testing. Curling its own public hostname
> depends on the router supporting NAT hairpinning, which isn't guaranteed —
> `localhost` still goes through the real nginx → server passthrough on the
> published port, it just skips the DNS/routing round trip that can fail from
> inside the same network.

---

## Adding a new site

This is the entire process — no workflow YAML edits required:

1. **Create `sites/<newsite>.conf`** (copy `sites/taytay.conf` as a template) with
   that site's test/prod domains, client/server ports, and a MySQL host port
   that doesn't collide with any other site or app already running on the same
   VMs (`docker ps` / check `sites/*.conf` for what's taken).
2. **Create GitHub Environments** `<newsite>-test` and `<newsite>-prod**`
   (Settings → Environments), each with a `SITE_ENV` secret holding that
   site+env's `.env` contents.
3. **Add runner labels** `<newsite>-test` / `<newsite>-prod` to whichever
   physical runners should host it (Settings → Actions → Runners → click a
   runner → Labels).
4. **Place the SSL certs** — if the new site is also a `*.royalecoldstorage.com.ph`
   subdomain, `server/certificates/` (already there) covers it, nothing to do.
   A genuinely different domain would need its own cert added there instead.
5. Push to `dev` — the new site appears in the next deploy's matrix automatically.

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
./config.cmd --url https://github.com/melvin-balajadia/marilao-qfsdforms --token <token> --labels marilao-test,taytay-test --runasservice

# PRODUCTION VM:
./config.cmd --url https://github.com/melvin-balajadia/marilao-qfsdforms --token <token> --labels marilao-prod,taytay-prod --runasservice
```

> If this VM already runs a runner for another repo (e.g. `smartscan-docker`),
> use a **separate install folder** — a self-hosted runner on a personal GitHub
> account is bound to exactly one repo, it can't be shared. Adding a new site
> to *this* repo later, though, is just adding a label to the *existing*
> qfsd-forms runner — no new install.

4. Verify it shows **Idle (green)** under Settings → Actions → Runners, with
   every label (`<site>-test` or `<site>-prod`) the corresponding matrix job
   will request.

### Step 4 — Place SSL certificates

Certs are **not** stored in the repo (git-ignored). Every site currently in
this repo shares one wildcard cert (`*.royalecoldstorage.com.ph`), so this is
a one-time setup regardless of how many sites are deployed here — placed
inside **the runner's own checkout**, not wherever you might have manually
cloned the repo before:

```
C:\actions-runner-qfsd\_work\marilao-qfsdforms\marilao-qfsdforms\server\certificates\
├── server.crt   ← leaf cert
├── inter.crt    ← intermediate chain
└── cert.key     ← private key
```

If you only have a merged/full-chain bundle (leaf + intermediates + root
concatenated into one file), split it back into the three pieces above:

```bash
awk '/BEGIN CERTIFICATE/{n++} {print > ("block"n".crt")}' cert.crt
mv block1.crt server.crt              # leaf
cat block2.crt block3.crt > inter.crt # intermediate chain (drop the self-signed root block)
```

The `_work\<repo>\<repo>` folder only gets created after the runner's first
checkout ever runs — you can create the nested path yourself ahead of time and
drop the certs in before the first push, or let the first run fail on a missing
cert and place them afterward (`clean: false` on checkout means they'll persist
for every run after that).

### Step 5 — Add GitHub Environments + Secrets (per site, per env)

1. Repo → **Settings → Environments** → create `<site>-test` and `<site>-prod`
   for each site (e.g. `marilao-test`, `marilao-prod`, `taytay-test`, `taytay-prod`).
2. Each environment → **Environment secrets** → add `SITE_ENV` (full contents of
   what should become `server/.env.<site>.<env>`).

Use the key shape shown in the *Local Setup* section above, with these two
values **must match that site's `sites/<site>.conf` exactly**:

- `server/.env.<site>.test` → `PORT_TEST` = that site's `TEST_SERVER_PORT`
- `server/.env.<site>.prod` → `PORT_PROD` = that site's `PROD_SERVER_PORT`

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
**Settings → Actions → Runners** for status and labels. If you add/fix a label
*after* a job is already queued, cancel that run and re-trigger — the
scheduler doesn't always re-check an already-queued job against a newly added
label.

```powershell
Get-Service actions.runner.*
Start-Service "actions.runner.<name>"
```

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

### One site's health check fails but containers show "running"

`deploy.sh` already confirms containers are running before it curls
`/health` — so a health-check failure with everything "running" usually means
the app crashed just after that check, or (curl exit code `000`) a DNS/NAT
problem. Confirm from an **external** device (not the VM itself):

```bash
curl -sk https://mqfdform.royalecoldstorage.com.ph:8082/health
curl -sk https://tqfdform.royalecoldstorage.com.ph:8084/health
```

If that also fails, check `docker logs qfsd_<site>_server_<env> --tail 50`. If
it succeeds, the deploy is actually fine — it's a NAT-hairpin limitation of
hitting `localhost` from that same box, not the app.

### Runner workspace is locked / access denied

```powershell
net stop actions.runner.<name>
rd /s /q "C:\actions-runner-qfsd\_work\marilao-qfsdforms"
net start actions.runner.<name>
```

Then retrigger the deploy (this affects every site's next run on that runner,
since the workspace is shared — not per-site).

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
  own curl to `/health` is the real correctness check.
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
