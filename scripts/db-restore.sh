#!/bin/sh
# Restaura um dump (formato custom) num banco alvo, RECRIANDO-O.
# Conexão via variáveis libpq: PGHOST, PGPORT, PGUSER, PGPASSWORD.
#
# Uso:  sh scripts/db-restore.sh <arquivo.dump> [banco_alvo]
#   PGHOST=localhost PGPORT=5544 PGUSER=condohub PGPASSWORD=condohub \
#   sh scripts/db-restore.sh ./backups/condohub-20260618-030000.dump condohub
#
# ⚠️ DESTRUTIVO: o banco alvo é derrubado e recriado. Confirme o alvo correto.
set -eu

FILE="${1:?informe o arquivo .dump}"
TARGET="${2:-${PGDATABASE:-condohub}}"

[ -f "$FILE" ] || { echo "✗ arquivo não encontrado: $FILE" >&2; exit 1; }

echo "[restore] alvo: ${TARGET}  origem: ${FILE}"
psql -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${TARGET}\" WITH (FORCE);"
psql -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${TARGET}\";"

# --no-owner/--no-privileges: portável entre ambientes com usuários diferentes.
pg_restore --no-owner --no-privileges --exit-on-error -d "$TARGET" "$FILE"

echo "[restore] concluído em ${TARGET}"
