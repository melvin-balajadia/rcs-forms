#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Deploy test or prod stack  (production-ready)
# =============================================================================
# Usage:
#   ./deploy.sh test                → start test stack  (:1002 / :8082)
#   ./deploy.sh prod                → start prod stack  (:2002 / :8087)
#   ./deploy.sh test --down         → tear down test stack
#   ./deploy.sh prod --down         → tear down prod stack
#   ./deploy.sh prod --rollback     → restore last known-good image tags
#   ./deploy.sh test --build        → force rebuild (passed to compose)
#
# Dev? Run locally — no Docker needed:
#   cd server && npm run dev
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
ENV="${1:-}"
shift || true

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
if [[ -z "$ENV" ]]; then
  cat <<EOF
Usage: $0 <test|prod> [options]

  test           → Test stack  (SSL) at :1002 / :8082
  prod           → Prod stack  (SSL) at :2002 / :8087

Options:
  --down         Tear down the stack
  --rollback     Restore previous image tags (prod only)
  --build        Force image rebuild (passed to docker compose)

Dev: run locally without Docker
  cd server && npm run dev
  cd client && npm run dev
EOF
  exit 1
fi

# ─── Environment config ───────────────────────────────────────────────────────
case "$ENV" in
  test)
    COMPOSE_FILE="docker-compose.test.yml"
    ENV_FILE="server/.env.test"
    CLIENT_URL="https://mqfdform.royalecoldstorage.com.ph:1002"
    SERVER_URL="https://mqfdform.royalecoldstorage.com.ph:8082"
    ROLLBACK_DIR="C:/deploy_rollback/test"
    CONTAINERS=(qfsd_client_test qfsd_server_test qfsd_nginx_test qfsd_mysql_test)
    ;;
  prod)
    COMPOSE_FILE="docker-compose.prod.yml"
    ENV_FILE="server/.env.prod"
    CLIENT_URL="https://rcsmqfdform.royalecoldstorage.com.ph:2002"
    SERVER_URL="https://rcsmqfdform.royalecoldstorage.com.ph:8087"
    ROLLBACK_DIR="C:/deploy_rollback/prod"
    CONTAINERS=(qfsd_client_prod qfsd_server_prod qfsd_nginx_prod qfsd_mysql_prod)
    ;;
  dev)
    error "Dev runs locally — no Docker needed. See usage above."
    ;;
  *)
    error "Unknown environment '${ENV}'. Use: test | prod"
    ;;
esac

[[ -f "$COMPOSE_FILE" ]] || error "Compose file not found: $COMPOSE_FILE"

info "Environment : ${ENV^^}"
info "Compose file: $COMPOSE_FILE"

# ─── --down ───────────────────────────────────────────────────────────────────
if $FLAG_DOWN; then
  warn "Tearing down ${ENV^^} stack..."
  docker compose -f "$COMPOSE_FILE" down --remove-orphans
  success "Stack stopped."
  exit 0
fi

# ─── --rollback ───────────────────────────────────────────────────────────────
if $FLAG_ROLLBACK; then
  warn "Rolling back ${ENV^^} stack to previous images..."

  mkdir -p "$ROLLBACK_DIR"

  CLIENT_PREV=$(cat "${ROLLBACK_DIR}/client_prev.txt" 2>/dev/null || echo "")
  SERVER_PREV=$(cat "${ROLLBACK_DIR}/server_prev.txt" 2>/dev/null || echo "")

  if [[ -z "$CLIENT_PREV" || "$CLIENT_PREV" == "none" || \
        -z "$SERVER_PREV" || "$SERVER_PREV" == "none" ]]; then
    error "No previous image snapshots found in ${ROLLBACK_DIR}. Cannot rollback."
  fi

  info "Stopping current stack..."
  docker compose -f "$COMPOSE_FILE" down --remove-orphans || true

  info "Restoring client image: $CLIENT_PREV"
  info "Restoring server image: $SERVER_PREV"

  # Re-tag the snapshotted image IDs back to the compose image names so
  # `up -d` (no --build) starts the PREVIOUS images, not the just-built ones.
  docker tag "$CLIENT_PREV" "qfsd-client:${ENV}" || error "Failed to retag client image ($CLIENT_PREV)"
  docker tag "$SERVER_PREV" "qfsd-server:${ENV}" || error "Failed to retag server image ($SERVER_PREV)"

  [[ -f "$ENV_FILE" ]] || error ".env file not found: $ENV_FILE (required for rollback)"

  docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
  success "Rollback complete. Previous images restored."
  exit 0
fi

# ─── Normal deploy ────────────────────────────────────────────────────────────
[[ -f "$ENV_FILE" ]] || error ".env file not found: $ENV_FILE"

# Snapshot current image IDs BEFORE bringing anything down, so --rollback can
# restore them. Inspect the IMAGES by tag (survives `down`, which removes
# containers), and use the SAME filenames the --rollback block reads above.
# In CI the build runs before this script, so the prod workflow snapshots
# earlier (see deploy-prod.yml); this covers manual `./deploy.sh <env> --build` runs.
mkdir -p "$ROLLBACK_DIR"
docker image inspect --format='{{.Id}}' "qfsd-client:${ENV}" 2>/dev/null \
  > "${ROLLBACK_DIR}/client_prev.txt" || echo "none" > "${ROLLBACK_DIR}/client_prev.txt"
docker image inspect --format='{{.Id}}' "qfsd-server:${ENV}" 2>/dev/null \
  > "${ROLLBACK_DIR}/server_prev.txt" || echo "none" > "${ROLLBACK_DIR}/server_prev.txt"

info "Starting ${ENV^^} stack..."
docker compose -f "$COMPOSE_FILE" down -t 30 --remove-orphans || true
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans "${COMPOSE_FLAGS[@]}"

success "────────────────────────────────────────────────"
success "  ${ENV^^} stack is up!"
success "  Client → $CLIENT_URL"
success "  Server → $SERVER_URL/api"
success "────────────────────────────────────────────────"

# ─── Post-deploy health check ─────────────────────────────────────────────────
# ponytail: no Compose-level healthcheck: blocks on client/server/nginx in this
# pass (that's hardening scope, deferred) — so this only confirms containers
# are running, not "healthy". The workflow's external curl to /health is the
# real check that the app is actually serving traffic.
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
  docker compose -f $COMPOSE_FILE logs --tail=50"
fi

success "All containers running. Deploy complete."
