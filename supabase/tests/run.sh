#!/usr/bin/env bash
# Runs the migrations, seed and SQL tests against a throwaway local Postgres 16.
# Usage: supabase/tests/run.sh   (needs initdb/pg_ctl/psql on PATH or in /usr/lib/postgresql/16/bin)
set -euo pipefail
cd "$(dirname "$0")/../.."
# Postgres refuses to run as root; re-run as the postgres system user if needed.
if [ "$(id -u)" = "0" ] && id postgres >/dev/null 2>&1; then
  exec runuser -u postgres -- "$PWD/supabase/tests/run.sh"
fi
export PATH="/usr/lib/postgresql/16/bin:$PATH"
DIR="$(mktemp -d)"
PORT=55432
cleanup() { pg_ctl -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT
initdb -D "$DIR/data" -U postgres --auth=trust >/dev/null
pg_ctl -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" start >/dev/null
PSQL=(psql -h "$DIR" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -c "create database orbis" >/dev/null
DB=(${PSQL[@]} -d orbis)
"${DB[@]}" -f supabase/tests/supabase_stubs.sql
for f in supabase/migrations/*.sql; do echo "migrate: $f"; "${DB[@]}" -f "$f"; done
echo "seed: supabase/seed.sql"; "${DB[@]}" -f supabase/seed.sql
for f in supabase/tests/test_*.sql; do echo "test: $f"; "${DB[@]}" -f "$f" >/dev/null 2>"$DIR/out" || { sed 's/^psql:[^ ]* //' "$DIR/out"; exit 1; }; sed 's/^psql:[^ ]* NOTICE:  /  /' "$DIR/out"; done
echo "ALL DATABASE TESTS PASSED"
