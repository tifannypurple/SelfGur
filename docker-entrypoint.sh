#!/bin/sh
set -eu

DB_PATH="${DATABASE_PATH:-/app/data/selfgur.db}"
UPLOAD_PATH="${UPLOAD_DIR:-/app/static}"

mkdir -p "$(dirname "$DB_PATH")" "$UPLOAD_PATH"

if [ "${FORCE_SEED_DATA:-false}" = "true" ] || [ ! -f "$DB_PATH" ]; then
  if [ -f /app/selfgur.db ]; then
    cp /app/selfgur.db "$DB_PATH"
    echo "Banco inicial copiado para $DB_PATH"
  fi
fi

if [ -d /app/static-seed ]; then
  if [ "${FORCE_SEED_DATA:-false}" = "true" ] || [ -z "$(ls -A "$UPLOAD_PATH" 2>/dev/null)" ]; then
    cp -a /app/static-seed/. "$UPLOAD_PATH"/
    echo "Uploads iniciais copiados para $UPLOAD_PATH"
  fi
fi

exec "$@"
