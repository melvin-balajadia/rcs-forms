#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Deploy a site's test or prod stack  (production-ready)
# =============================================================================
# Usage:
#   ./deploy.sh <site> test                → start <site>'s test stack
#   ./deploy.sh <site> prod                → start <site>'s prod stack
#   ./deploy.sh <site> test --down         → tear down <site>'s test stack
#   ./deploy.sh <site> prod --down         → tear down <site>'s prod stack
#   ./deploy.sh <site> prod --rollback     → restore last known-good image tags
#   ./deploy.sh <site> test --build        → force rebuild (passed to compose)
#
# <site> is any name with a sites/<site>.conf file (e.g. marilao, taytay).
# Adding a new site is a config change (drop in sites/<newsite>.conf) — nothing
# in this script hardcodes a site name.
#
# Dev? Run locally — no Docker needed:
#   cd server && npm start
#   cd client && npm run dev
# =============================================================================

set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ─── Args ─────────────────────────────────────────────────────────────────────
SITE="${1:-}"
ENV="${2:-}"
shift 2 || true

# Parse flags explicitly (avoids false-positives from string-matching EXTRA_ARGS)
FLAG_DOWN=false
FLAG_ROLLBACK=false
COMPOSE_FLAGS=()

for arg in "$@"; do
  case "$arg" in
    --down)     FLAG_DOWN=true ;;
    --rollback) FLAG_ROLLBACK=true ;;
    *)          COMPOSE_FLAGS+=("$arg") ;;
  esac
done

# ─── Usage guard ──────────────────────────────────────────────────────────────
if [[ -z "$SITE" || -z "$ENV" ]]; then
  cat <<EOF
Usage: $0 <site> <test|prod> [options]

  <site>         → any name with a sites/<site>.conf file (e.g. marilao, taytay)
  test           → Test stack (SSL)
  prod           → Prod stack (SSL)

Options:
  --down         Tear down the stack
  --rollback     Restore previous image tags
  --build        Force image rebuild (passed to docker compose)

Available sites:
$(ls sites/*.conf 2>/dev/null | xargs -n1 basename -s .conf | sed 's/^/  - /' || echo "  (none found in sites/)")

Dev: run locally without Docker
  cd server && npm start
  cd client && npm run dev
EOF
  exit 1
fi

# ─── Site config ──────────────────────────────────────────────────────────────
SITE_CONF="sites/${SITE}.conf"
[[ -f "$SITE_CONF" ]] || error "Unknown site '${SITE}' — no ${SITE_CONF} found."
# shellcheck source=/dev/null
source "$SITE_CONF"

case "$ENV" in
  test)
    COMPOSE_FILE="docker-compose.test.yml"
    export CLIENT_DOMAIN="$TEST_CLIENT_DOMAIN"
    export CLIENT_PORT="$TEST_CLIENT_PORT"
    export SERVER_PORT="$TEST_SERVER_PORT"
    export MYSQL_PORT="$TEST_MYSQL_PORT"
    ;;
  prod)
    COMPOSE_FILE="docker-compose.prod.yml"
    export CLIENT_DOMAIN="$PROD_CLIENT_DOMAIN"
    export CLIENT_PORT="$PROD_CLIENT_PORT"
    export SERVER_PORT="$PROD_SERVER_PORT"
    export MYSQL_PORT="$PROD_MYSQL_PORT"
    ;;
  dev)
    error "Dev runs locally — no Docker needed. See usage above."
    ;;
  *)
    error "Unknown environment '${ENV}'. Use: test | prod"
    ;;
esac

export SITE
ENV_FILE="server/.env.${SITE}.${ENV}"
CLIENT_URL="https://${CLIENT_DOMAIN}:${CLIENT_PORT}"
SERVER_URL="https://${CLIENT_DOMAIN}:${SERVER_PORT}"
ROLLBACK_DIR="C:/deploy_rollback/${SITE}/${ENV}"
CONTAINERS=(
  "qfsd_${SITE}_client_${ENV}"
  "qfsd_${SITE}_server_${ENV}"
  "qfsd_${SITE}_nginx_${ENV}"
  "qfsd_${SITE}_mysql_${ENV}"
)

[[ -f "$COMPOSE_FILE" ]] || error "Compose file not found: $COMPOSE_FILE"

# Optional one-off override for this exact site+env (e.g. reusing a
# pre-existing volume from before this site had a CI-managed deploy) — applied
# automatically if present, nothing to hardcode per site here.
COMPOSE_ARGS=(-p "qfsd-${SITE}-${ENV}" -f "$COMPOSE_FILE")
OVERRIDE_FILE="docker-compose.${SITE}.${ENV}.override.yml"
if [[ -f "$OVERRIDE_FILE" ]]; then
  info "Applying override: $OVERRIDE_FILE"
  COMPOSE_ARGS+=(-f "$OVERRIDE_FILE")
fi

info "Site        : ${SITE_LABEL:-$SITE}"
info "Environment : ${ENV^^}"
info "Compose file: $COMPOSE_FILE"

# ─── --down ───────────────────────────────────────────────────────────────────
if $FLAG_DOWN; then
  warn "Tearing down ${SITE}/${ENV^^} stack..."
  docker compose "${COMPOSE_ARGS[@]}" down --remove-orphans
  success "Stack stopped."
  exit 0
fi

# ─── --rollback ───────────────────────────────────────────────────────────────
if $FLAG_ROLLBACK; then
  warn "Rolling back ${SITE}/${ENV^^} stack to previous images..."

  mkdir -p "$ROLLBACK_DIR"

  CLIENT_PREV=$(cat "${ROLLBACK_DIR}/client_prev.txt" 2>/dev/null || echo "")
  SERVER_PREV=$(cat "${ROLLBACK_DIR}/server_prev.txt" 2>/dev/null || echo "")

  if [[ -z "$CLIENT_PREV" || "$CLIENT_PREV" == "none" || \
        -z "$SERVER_PREV" || "$SERVER_PREV" == "none" ]]; then
    error "No previous image snapshots found in ${ROLLBACK_DIR}. Cannot rollback."
  fi

  info "Stopping current stack..."
  docker compose "${COMPOSE_ARGS[@]}" down --remove-orphans || true

  info "Restoring client image: $CLIENT_PREV"
  info "Restoring server image: $SERVER_PREV"

  # Re-tag the snapshotted image IDs back to the compose image names so
  # `up -d` (no --build) starts the PREVIOUS images, not the just-built ones.
  docker tag "$CLIENT_PREV" "qfsd-${SITE}-client:${ENV}" || error "Failed to retag client image ($CLIENT_PREV)"
  docker tag "$SERVER_PREV" "qfsd-${SITE}-server:${ENV}" || error "Failed to retag server image ($SERVER_PREV)"

  [[ -f "$ENV_FILE" ]] || error ".env file not found: $ENV_FILE (required for rollback)"

  docker compose "${COMPOSE_ARGS[@]}" up -d --remove-orphans
  success "Rollback complete. Previous images restored."
  exit 0
fi

# ─── Normal deploy ────────────────────────────────────────────────────────────
[[ -f "$ENV_FILE" ]] || error ".env file not found: $ENV_FILE"

# Snapshot current image IDs BEFORE bringing anything down, so --rollback can
# restore them. Inspect the IMAGES by tag (survives `down`, which removes
# containers), and use the SAME filenames the --rollback block reads above.
# In CI the build runs before this script, so the prod workflow snapshots
# earlier (see deploy-prod.yml); this covers manual `./deploy.sh <site> <env> --build` runs.
mkdir -p "$ROLLBACK_DIR"
docker image inspect --format='{{.Id}}' "qfsd-${SITE}-client:${ENV}" 2>/dev/null \
  > "${ROLLBACK_DIR}/client_prev.txt" || echo "none" > "${ROLLBACK_DIR}/client_prev.txt"
docker image inspect --format='{{.Id}}' "qfsd-${SITE}-server:${ENV}" 2>/dev/null \
  > "${ROLLBACK_DIR}/server_prev.txt" || echo "none" > "${ROLLBACK_DIR}/server_prev.txt"

info "Starting ${SITE}/${ENV^^} stack..."
docker compose "${COMPOSE_ARGS[@]}" down -t 30 --remove-orphans || true
docker compose "${COMPOSE_ARGS[@]}" up -d --remove-orphans "${COMPOSE_FLAGS[@]}"

success "────────────────────────────────────────────────"
success "  ${SITE_LABEL:-$SITE} ${ENV^^} stack is up!"
success "  Client → $CLIENT_URL"
success "  Server → $SERVER_URL/api"
success "────────────────────────────────────────────────"

# ─── Post-deploy health check ─────────────────────────────────────────────────
# ponytail: no Compose-level healthcheck: blocks on client/server/nginx in this
# pass (that's hardening scope, deferred) — so this only confirms containers
# are running, not "healthy". The curl below is the real check that the app
# is actually serving traffic.
info "Waiting 20s for containers to stabilize..."
sleep 20

FAILED=0
for container in "${CONTAINERS[@]}"; do
  STATUS=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "missing")
  echo "  [$container] status=$STATUS"
  if [[ "$STATUS" != "running" ]]; then
    warn "Container not running: $container"
    FAILED=1
  fi
done

if [[ $FAILED -ne 0 ]]; then
  error "One or more containers failed to start. Check logs:
  docker compose ${COMPOSE_ARGS[*]} logs --tail=50"
fi

success "All containers running."

# ─── Health check ──────────────────────────────────────────────────────────────
# Hits localhost, not the public domain — this runs on the same VM being
# tested, and curling its own public hostname depends on the router supporting
# NAT hairpinning, which isn't guaranteed. localhost still goes through the
# real nginx → server passthrough on the published port.
info "Verifying health at https://127.0.0.1:${SERVER_PORT}/health ..."
# 127.0.0.1, not localhost: some Windows/Docker Desktop setups resolve
# "localhost" to ::1 (IPv6) first, and if the published port isn't bound on
# IPv6, that's a silent connection-refused before curl ever reaches the
# container — 127.0.0.1 removes the ambiguity entirely.
HEALTH_STATUS=$(curl -sk --tlsv1.2 -o /dev/null -w "%{http_code}" "https://127.0.0.1:${SERVER_PORT}/health" || echo "000")
echo "  Health check returned: $HEALTH_STATUS"
if [[ "$HEALTH_STATUS" != "200" ]]; then
  error "Health check failed with status: $HEALTH_STATUS. Check logs:
  docker compose ${COMPOSE_ARGS[*]} logs --tail=50"
fi

success "Deploy complete."
