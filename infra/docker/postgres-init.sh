#!/bin/sh
# Creates the runtime role the API and worker connect as. It owns nothing and has no
# BYPASSRLS, so row-level security always applies to it. Grants come from migrations.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE app_user LOGIN PASSWORD '${APP_USER_PASSWORD}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
SQL
