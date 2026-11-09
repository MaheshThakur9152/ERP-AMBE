#!/usr/bin/env bash
# Isolated PostgreSQL restore drill. Run on the Docker host: infra/backup/restore-drill.sh
# Restores the newest successful backup into a throwaway container with no network,
# compares it with production read-only, then removes only what it created.
set -Eeuo pipefail

ID="erp-restore-drill-$(date -u +%Y%m%d%H%M%S)"
IMAGE="${DRILL_IMAGE:-erp-ambe-postgres}"
DIFF_DIR="$(mktemp -d)"
cleanup() {
  docker rm -f "$ID" >/dev/null 2>&1 || true
  docker volume rm "$ID" >/dev/null 2>&1 || true
  rm -rf "$DIFF_DIR"
}
trap cleanup EXIT

in_backup() { docker exec erp-backup sh -c "$1"; }
DB_USER="$(in_backup 'printf %s "${PGUSER:-erp_admin}"')"
DB_NAME="$(in_backup 'printf %s "${PGDATABASE:-erp_facility}"')"
PREFIX="$(docker exec erp-backup /usr/local/bin/erp_backup.py latest-pg)"
fetch() { in_backup "aws --endpoint-url \"\$S3_ENDPOINT_URL\" s3 cp \"s3://\$DR_S3_BUCKET/${PREFIX}$1\" - --only-show-errors"; }
EXPECTED="$(fetch manifest.json | python3 -c 'import json,sys;print(json.load(sys.stdin)["dump_sha256"])')"
echo "backup: $PREFIX"

docker run -d --name "$ID" --network none --entrypoint docker-entrypoint.sh \
  -e POSTGRES_USER="$DB_USER" -e POSTGRES_DB="$DB_NAME" -e POSTGRES_HOST_AUTH_METHOD=trust \
  -v "$ID":/var/lib/postgresql/data "$IMAGE" postgres >/dev/null
for _ in $(seq 1 60); do
  docker exec "$ID" pg_isready -q -h 127.0.0.1 -U "$DB_USER" && break
  sleep 2
done
docker exec "$ID" pg_isready -q -h 127.0.0.1 -U "$DB_USER"

START=$(date +%s)
# The drill superuser already exists, so its CREATE ROLE error is expected; other roles must apply.
fetch globals.sql | docker exec -i "$ID" psql -q -U "$DB_USER" -d "$DB_NAME" 2>&1 | grep -v 'already exists' || true
fetch database.dump | tee >(sha256sum | cut -d' ' -f1 > "$DIFF_DIR/sha") \
  | docker exec -i "$ID" pg_restore -U "$DB_USER" -d "$DB_NAME" --exit-on-error
wait
for _ in $(seq 1 10); do [ -s "$DIFF_DIR/sha" ] && break; sleep 1; done
[ "$(cat "$DIFF_DIR/sha")" = "$EXPECTED" ] || { echo "FAILED: dump SHA-256 mismatch"; exit 1; }
echo "restore: OK in $(( $(date +%s) - START ))s, sha256 matches manifest"

read -r -d '' PROFILE <<'SQL' || true
select 'extension '||extname||' '||extversion from pg_extension order by 1;
select 'schema '||nspname from pg_namespace where nspname !~ '^pg_' and nspname<>'information_schema' order by 1;
select 'constraint '||conrelid::regclass||' '||conname||' '||pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace order by 1;
select 'index '||indexdef from pg_indexes where schemaname='public' order by 1;
select 'trigger '||tgrelid::regclass||' '||tgname from pg_trigger where not tgisinternal order by 1;
select 'sequence '||schemaname||'.'||sequencename||' '||coalesce(last_value::text,'unset') from pg_sequences order by 1;
do $$
declare t record; c bigint; h text;
begin
  for t in select format('%I.%I',schemaname,tablename) q from pg_tables where schemaname not in ('pg_catalog','information_schema') order by 1 loop
    execute format('select count(*), md5(coalesce(string_agg(x::text, chr(10) order by x::text),'''')) from %s x', t.q) into c, h;
    raise notice 'table % rows=% md5=%', t.q, c, h;
  end loop;
end $$;
SQL
profile() { docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' "$1" psql -U "$DB_USER" -d "$DB_NAME" -At -v ON_ERROR_STOP=1 2>&1 <<<"$PROFILE" | sed 's/^psql:[^ ]* NOTICE:  //;s/^NOTICE:  //'; }
profile erp-postgres > "$DIFF_DIR/prod"
profile "$ID" > "$DIFF_DIR/restored"

for kind in extension schema constraint index trigger sequence table; do
  printf '%-11s production=%s restored=%s\n' "$kind" "$(grep -c "^$kind " "$DIFF_DIR/prod" || true)" "$(grep -c "^$kind " "$DIFF_DIR/restored" || true)"
done
echo "total rows: production=$(grep '^table ' "$DIFF_DIR/prod" | sed -E 's/.*rows=([0-9]+).*/\1/' | awk '{s+=$1} END {print s+0}') restored=$(grep '^table ' "$DIFF_DIR/restored" | sed -E 's/.*rows=([0-9]+).*/\1/' | awk '{s+=$1} END {print s+0}')"
if diff "$DIFF_DIR/prod" "$DIFF_DIR/restored" > "$DIFF_DIR/delta"; then
  echo "RESULT: PASS, restored database identical to production"
else
  # Lines name tables only by their digest; a live ERP may legitimately write after the dump.
  echo "RESULT: DIFFERENCES ($(grep -c '^[<>]' "$DIFF_DIR/delta") lines)"
  sed -E 's/md5=.*//' "$DIFF_DIR/delta" | cut -c1-120
  exit 1
fi
