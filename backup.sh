#!/usr/bin/env bash
# =============================================================================
# backup.sh — Dump every running MySQL stack on this host
# =============================================================================
# Usage:
#   ./backup.sh              → back up all prod stacks
#   ./backup.sh test         → back up all test stacks
#
# Writes C:/backups/<site>/<env>/<site>_<env>_<date>.sql.gz and prunes dumps
# older than RETAIN_DAYS. Run nightly from Task Scheduler — see README.
#
# Discovers targets from running containers (qfsd_<site>_mysql_<env>) rather
# than sites/*.conf: the box only ever has the stacks it actually runs, and
# this needs no site config, no workspace, and no .env — which matters because
# the deploy pipeline deletes server/.env.<site>.<env> after every run.
# =============================================================================

set -euo pipefail

ENV="${1:-prod}"
BACKUP_ROOT="C:/backups"
RETAIN_DAYS=14

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

STAMP=$(date +%Y-%m-%d_%H%M)
# Anchored to ^qfsd_: this host also runs unrelated stacks (whdocr, smartscan).
# Backing up another project's production DB from this repo's script would be a
# scope decision made by accident — those get their own schedule if they want one.
CONTAINERS=$(docker ps --filter "name=^qfsd_.*_mysql_${ENV}$" --format '{{.Names}}') \
  || error "Cannot reach the Docker daemon — is Docker running, and is this account in docker-users?"
[[ -n "$CONTAINERS" ]] || error "No running qfsd_*_mysql_${ENV} containers found."

FAILED=0
for container in $CONTAINERS; do
  # qfsd_<site>_mysql_<env> → <site>
  site=${container#qfsd_}; site=${site%%_mysql_*}
  dest="${BACKUP_ROOT}/${site}/${ENV}"
  out="${dest}/${site}_${ENV}_${STAMP}.sql.gz"
  mkdir -p "$dest"

  info "Dumping ${container} → ${out}"
  # Password stays inside the container: read MYSQL_ROOT_PASSWORD from the env
  # the container already has and hand it to mysqldump via MYSQL_PWD, so it
  # never appears in this host's process list or shell history.
  # --single-transaction keeps InnoDB consistent without locking the app out.
  if ! docker exec "$container" sh -c \
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --routines --events --all-databases' \
      | gzip > "$out"; then
    echo -e "${RED}[ERROR]${NC} Dump failed for ${container}" >&2
    rm -f "$out"
    FAILED=1
    continue
  fi

  # A dump that "succeeded" but is truncated is worse than a loud failure —
  # mysqldump writes its completion marker last, so its presence proves the
  # stream finished. 2000 bytes is well under any real dump, well over an
  # empty gzip header.
  size=$(wc -c < "$out")
  if (( size < 2000 )) || ! gzip -dc "$out" | tail -5 | grep -q "Dump completed"; then
    echo -e "${RED}[ERROR]${NC} Dump looks incomplete (${size} bytes): ${out}" >&2
    FAILED=1
    continue
  fi

  success "$(basename "$out") — ${size} bytes"
  find "$dest" -name '*.sql.gz' -mtime "+${RETAIN_DAYS}" -delete
done

(( FAILED == 0 )) || error "One or more dumps failed — see above."
success "All ${ENV} backups complete."
