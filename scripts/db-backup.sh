#!/bin/sh
# Backup do PostgreSQL (formato custom, comprimido) com retenção.
# Conexão via variáveis padrão libpq: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE.
#
# Uso (no container db-backup do compose, em loop) ou manual:
#   PGHOST=localhost PGPORT=5544 PGUSER=condohub PGPASSWORD=condohub \
#   PGDATABASE=condohub BACKUP_DIR=./backups sh scripts/db-backup.sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
DB="${PGDATABASE:-condohub}"
TS="$(date +%Y%m%d-%H%M%S)"
FILE="${BACKUP_DIR}/${DB}-${TS}.dump"

mkdir -p "$BACKUP_DIR"
echo "[backup] $(date -u +%FT%TZ) pg_dump ${DB} -> ${FILE}"

# -Fc: formato custom (comprimido, restaurável seletivamente com pg_restore).
pg_dump -Fc -f "$FILE" "$DB"

echo "[backup] concluído: ${FILE} ($(du -h "$FILE" | cut -f1))"

# Retenção: remove dumps mais antigos que RETENTION_DAYS.
find "$BACKUP_DIR" -name "${DB}-*.dump" -type f -mtime "+${RETENTION_DAYS}" -print -delete || true
echo "[backup] retenção: mantidos os últimos ${RETENTION_DAYS} dia(s)"
