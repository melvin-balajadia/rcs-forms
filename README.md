# qfsd-forms

A Dockerized deployment setup for the QFSD Forms application (Vite/React client +
Node/Express server + MySQL) with automated CI/CD via GitHub Actions.

- **Test** → https://mqfdform.royalecoldstorage.com.ph:1002 (client) · :8082 (server)
- **Production** → https://rcsmqfdform.royalecoldstorage.com.ph:2002 (client) · :8087 (server)

---

## For New Developers — Local Setup

This is all you need to start coding. No Docker required for local development.

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
# MySQL natively, or point it at a MySQL you already have reachable)
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

Pushing to `dev` **automatically deploys to the test environment** via GitHub
Actions. Check https://mqfdform.royalecoldstorage.com.ph:1002 to verify.

---

## Deploying to Production

Only do this once you're happy with what's on test — **there is currently no
required-reviewer approval gate** (GitHub Environments' protection rules need
GitHub Pro on a private repo; this repo is on the Free plan), so merging to
`main` deploys immediately, with no pause to reconsider.

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

Pushing to `main` triggers **Deploy to Production** automatically.

---

## How the CI/CD Pipeline Works

### CI (`ci.yml`) — runs on every push/PR to `dev` or `main`

GitHub-hosted runners, not the self-hosted ones — build/lint only, nothing touches
a VM.

- `client`: `npm ci` → `npm run lint` (non-blocking — see *Known Gaps*) → `npm run build`
- `server`: `npm ci` only (no test suite exists yet)

### Test Pipeline (`deploy-test.yml`, triggers on push to `dev`)

```
Push to dev
    ↓
Stop existing qfsd-test containers
    ↓
Checkout source (clean: false — server/certificates/ is git-ignored and must survive)
    ↓
Write .env.test from GitHub Secret ENV_TEST
    ↓
Build new Docker images
    ↓
deploy.sh test → stop old + start new, wait 20s, confirm all 4 containers "running"
    ↓
Verify health: curl https://localhost:8082/health (not the public domain — see note below)
    ↓
Delete .env.test from disk (always, even on failure)
```

### Production Pipeline (`deploy-prod.yml`, triggers on push to `main`)

```
Push to main
    ↓
Stop existing qfsd-prod containers
    ↓
Snapshot current image IDs → C:\deploy_rollback\prod (for rollback)
    ↓
Checkout source (clean: false)
    ↓
Write .env.prod from GitHub Secret ENV_PROD
    ↓
Build new Docker images
    ↓
deploy.sh prod → stop old + start new, wait 20s, confirm all 4 containers "running"
    ↓
Verify health: curl https://localhost:8087/health
    ↓
If health check fails → automatic rollback to previous images
    ↓
Delete .env.prod from disk (always, even on failure)
```

> **Why `localhost` and not the public domain?** The health check runs *on the
> same VM* it's testing. Curling its own public hostname depends on the router
> supporting NAT hairpinning, which isn't guaranteed — `localhost` still goes
> through the real nginx → server passthrough on the published port, it just
> skips the DNS/routing round trip that can fail from inside the same network.

---

## Rollback

### Automatic Rollback (Prod only)

If any step in the prod pipeline fails — including the health check — the
workflow automatically restores the previous images from `C:\deploy_rollback\prod`.
You'll see a **Rollback on failure** step in the Actions log if this triggers.

### Manual Rollback

```bash
# RDP/AnyDesk into the target server, open Git Bash
bash deploy.sh prod --rollback
bash deploy.sh test --rollback   # deploy.sh supports it for test too, just not wired into CI
```

> ⚠️ Requires a previous successful deploy to have snapshot files in
> `C:\deploy_rollback\<env>`. On the very first deploy, no snapshots exist yet.

### Manual Teardown

```bash
bash deploy.sh test --down
bash deploy.sh prod --down
```

---

## Branching Rules

| Branch | Purpose                       | Deploys to |
| ------ | ----------------------------- | ---------- |
| `dev`  | Daily development work        | Test       |
| `main` | Stable, production-ready code | Production |

- Branch off `dev` for new feature work
- Don't push directly to `main`
- Verify test is working before merging to `main` — remember, there's no approval gate to catch you

---

## For Server Admins — Setting Up a New VM

### Step 1 — Install prerequisites

- [Git for Windows](https://git-scm.com/download/win) (workflows call `C:\Program Files\Git\bin\bash.exe` directly)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```powershell
git --version
docker --version
```

### Step 2 — Create the rollback directory

```powershell
mkdir C:\deploy_rollback\test
mkdir C:\deploy_rollback\prod
```

### Step 3 — Set up the GitHub Actions runner

1. GitHub repo → **Settings → Actions → Runners → New self-hosted runner**
2. Select **Windows**, **x64**
3. In an admin PowerShell:

```powershell
mkdir C:\actions-runner-qfsd; cd C:\actions-runner-qfsd

Invoke-WebRequest -Uri <url GitHub shows you> -OutFile actions-runner.zip
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory("$PWD\actions-runner.zip", "$PWD")

# TEST machine:
./config.cmd --url https://github.com/melvin-balajadia/marilao-qfsdforms --token <token> --labels test --runasservice

# PRODUCTION machine:
./config.cmd --url https://github.com/melvin-balajadia/marilao-qfsdforms --token <token> --labels production --runasservice
```

> If this VM already runs a runner for another repo (e.g. `smartscan-docker`),
> use a **separate install folder** — a self-hosted runner on a personal GitHub
> account is bound to exactly one repo, it can't be shared.

4. Verify it shows **Idle (green)** under Settings → Actions → Runners, with
   exactly the label (`test` or `production`) the corresponding workflow's
   `runs-on:` expects.

### Step 4 — Place SSL certificates

Certs are **not** stored in the repo (git-ignored). Each environment needs three
files, placed inside **the runner's own checkout**, not wherever you might have
manually cloned the repo before:

```
C:\actions-runner-qfsd\_work\marilao-qfsdforms\marilao-qfsdforms\server\certificates\
├── server.crt   ← leaf cert
├── inter.crt    ← intermediate chain
└── cert.key     ← private key
```

Both VMs use the *same* three files — the cert is a wildcard
(`*.royalecoldstorage.com.ph`), so it covers both `mqfdform...` and `rcsmqfdform...`.

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

### Step 5 — Add GitHub Environments + Secrets

1. Repo → **Settings → Environments** → create `test` and `production`.
2. Repo → **Settings → Environments → test → Environment secrets** → add `ENV_TEST`
   (full contents of what should become `server/.env.test`).
3. Same for `production → ENV_PROD` (→ `server/.env.prod`).

Use the same key shape shown in the *Local Setup* section above, with these two
values **must match the compose files exactly**:

- `server/.env.test` → `PORT_TEST=8082`
- `server/.env.prod` → `PORT_PROD=8087`

> ⚠️ No trailing spaces after any line — Docker will reject the variable and
> the container fails to start.

### Step 6 — Open firewall ports

```powershell
New-NetFirewallRule -DisplayName "QFSD Test Client"  -Direction Inbound -Protocol TCP -LocalPort 1002 -Action Allow
New-NetFirewallRule -DisplayName "QFSD Test Server"  -Direction Inbound -Protocol TCP -LocalPort 8082 -Action Allow
New-NetFirewallRule -DisplayName "QFSD Prod Client"  -Direction Inbound -Protocol TCP -LocalPort 2002 -Action Allow
New-NetFirewallRule -DisplayName "QFSD Prod Server"  -Direction Inbound -Protocol TCP -LocalPort 8087 -Action Allow
```

> Do **not** open `3309` (MySQL) — internal only, never expose a database port
> to the internet.

### Step 7 — Trigger the first deploy

```bash
git push origin dev    # → Test
git push origin main   # → Production
```

### Step 8 — Verify

```powershell
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### Migrating an existing manual deployment onto this pipeline

If a VM already has containers running from a hand-rolled `docker compose up`
(no CI), the new CI-driven stack uses **different, pinned volume/project names**
(`qfsd-test`/`qfsd-prod` vs whatever the old folder's directory name produced) —
so it'll start with an empty database unless you point it at the old data:

```powershell
docker inspect <old_mysql_container_name> --format "{{json .Mounts}}"
```

Find the old volume name, then in `docker-compose.test.yml` / `.prod.yml`:

```yaml
volumes:
  qfsd_test_mysql_data:
    external: true
    name: <the-old-volume-name>
```

Then stop the old stack (`docker compose down` — **no** `-v`, that deletes
volumes) to free its ports before the new stack tries to bind them.

---

## Useful Docker Commands

```bash
# View live logs
docker compose -f docker-compose.test.yml logs -f
docker compose -f docker-compose.prod.yml logs -f

# View logs for a specific container
docker logs qfsd_server_test --tail 50
docker logs qfsd_server_prod --tail 50

# Restart a single container
docker restart qfsd_server_test
docker restart qfsd_nginx_test

# Shell into a container
docker exec -it qfsd_server_test sh
docker exec -it qfsd_mysql_test sh

# Connect to MySQL
docker exec -it qfsd_mysql_test mysql -u root -p

# Stop everything
docker compose -f docker-compose.test.yml down
docker compose -f docker-compose.prod.yml down

# Manual deploy with forced rebuild
"C:\Program Files\Git\bin\bash.exe" -c "bash deploy.sh test --build"
"C:\Program Files\Git\bin\bash.exe" -c "bash deploy.sh prod --build"

# Manual rollback
"C:\Program Files\Git\bin\bash.exe" -c "bash deploy.sh prod --rollback"
```

---

## Troubleshooting

### Job stuck on "Waiting for a runner to pick up this job..."

The runner is either offline, or its labels don't match `runs-on:` in the
workflow exactly (`self-hosted` + `test`, or `self-hosted` + `production`).
Check **Settings → Actions → Runners** for status and labels. If you add/fix a
label *after* a job is already queued, cancel that run and re-trigger — the
scheduler doesn't always re-check an already-queued job against a newly added
label.

```powershell
Get-Service actions.runner.*
Start-Service "actions.runner.<name>"
```

### `502 Bad Gateway` — server container crashed

```bash
docker logs qfsd_server_prod --tail 50
```

Common causes: bad `.env` values, DB connection failed, or — specific to this
app — missing SSL certs. `server/index.js` builds its HTTPS server object
unconditionally at startup (before the dev/test/prod branch check), so a
missing cert file crashes the process immediately rather than falling back to
HTTP as the code comments imply.

### `.env file not found` during deploy

Check **Settings → Environments → (test|production) → Environment secrets** —
verify `ENV_TEST`/`ENV_PROD` actually exist on the matching environment.

### `container name already in use` / port already allocated

Usually means an old stack (manual or CI) is still holding the port.

```bash
docker compose -f docker-compose.prod.yml down --remove-orphans
```

Then re-run the workflow from the Actions tab.

### Health check fails but containers show "running"

`deploy.sh` already confirms containers are running before the workflow's
health-check step runs — so a health-check failure with everything "running"
usually means the app crashed just after that check, or (if you're seeing
curl exit code `000`) a DNS/NAT problem hitting the public domain rather than
`localhost` — confirm which by curling from an **external** device (not the VM
itself):

```bash
curl -sk https://mqfdform.royalecoldstorage.com.ph:8082/health
curl -sk https://rcsmqfdform.royalecoldstorage.com.ph:8087/health
```

If that also fails, check `docker logs qfsd_server_<env> --tail 50`. If it
succeeds, the deploy is actually fine — it's a NAT-hairpin limitation of the
health-check step's environment, not the app.

### Runner workspace is locked / access denied

```powershell
net stop actions.runner.<name>
rd /s /q "C:\actions-runner-qfsd\_work\marilao-qfsdforms"
net start actions.runner.<name>
```

Then retrigger the deploy.

### CORS errors in the browser

Check `server/config/allowedOrigin.js` includes the exact origin you're hitting
from, including the port. Known gap: local dev's actual Vite port (`1002`, per
`client/vite.config.ts`) isn't in the allowlist, only `http://localhost:5173` is.

### `$'\r': command not found` — Windows line endings in a shell script

```bash
sed -i 's/\r//' deploy.sh
```

### Rollback snapshot is `none` or missing

Normal on the very first deploy — no previous images exist yet to snapshot.
From the second deploy onward it'll be populated:

```bash
cat /c/deploy_rollback/prod/server_prev.txt
cat /c/deploy_rollback/prod/client_prev.txt
```

---

## Known Gaps (deliberately deferred, not oversights)

- **No automated DB backups** — unlike some other projects on this account,
  there's no scheduled backup container here yet.
- **No branch protection / required reviewers** — the repo is private on
  GitHub's Free plan, which doesn't support either for private repos (Pro
  upgrade, ~$4/mo, would unlock both).
- **No Compose-level `healthcheck:` blocks** on the `client`/`server`/`nginx`
  services (only `mysql` has one) — `deploy.sh`'s post-deploy check only
  confirms containers are *running*, not passing an internal health probe. The
  workflow's external curl to `/health` is the real correctness check.
- **Client lint has ~120 pre-existing errors** (mostly
  `@typescript-eslint/no-explicit-any`) — `ci.yml` runs lint with
  `continue-on-error: true` so it doesn't block merges; worth a cleanup pass
  separately.
- **`client/vite.config.ts` dev port vs. CORS allowlist mismatch** — see
  Troubleshooting above.
