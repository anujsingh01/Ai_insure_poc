-- Security baseline: runtime role, tenant row-level security, append-only audit log.
-- Runs as the table owner. The runtime role (app_user) owns nothing and cannot bypass RLS.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    -- Infra normally creates this role with a login password; this keeps migrations runnable anywhere.
    CREATE ROLE app_user NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;--> statement-breakpoint

CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint

-- The tenant for the current transaction, set by withTenant() via set_config(..., true).
-- NULL when unset, which makes every tenant policy evaluate to false.
CREATE FUNCTION app_current_tenant() RETURNS text
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT nullif(current_setting('app.tenant_id', true), '') $$;--> statement-breakpoint

-- ---------------------------------------------------------------- tenant tables
-- Every tenant table gets ENABLE + FORCE (so even the owner is filtered) and one isolation policy.

ALTER TABLE org_profile ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE org_profile FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON org_profile
  USING (org_id = app_current_tenant())
  WITH CHECK (org_id = app_current_tenant());--> statement-breakpoint

-- ---------------------------------------------------------------- audit log

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY audit_read ON audit_log FOR SELECT USING (org_id = app_current_tenant());--> statement-breakpoint
CREATE POLICY audit_append ON audit_log FOR INSERT WITH CHECK (org_id = app_current_tenant());--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM app_user;--> statement-breakpoint

-- Canonical text of a row, hashed into the chain. Changing this breaks verification of old rows.
CREATE FUNCTION audit_payload(r audit_log) RETURNS text
  LANGUAGE sql IMMUTABLE
  AS $$
    SELECT concat_ws('|',
      r.org_id, r.seq::text, coalesce(r.actor_user_id, ''), r.action,
      coalesce(r.target_type, ''), coalesce(r.target_id, ''), r.metadata::text,
      coalesce(r.ip, ''), coalesce(r.user_agent, ''),
      to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
  $$;--> statement-breakpoint

CREATE FUNCTION audit_log_chain() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  last_seq bigint;
  last_hash bytea;
BEGIN
  -- Serialise appends per organisation so sequence numbers and hashes never fork.
  PERFORM pg_advisory_xact_lock(hashtextextended('audit_log:' || NEW.org_id, 0));
  SELECT seq, hash INTO last_seq, last_hash
    FROM audit_log WHERE org_id = NEW.org_id ORDER BY seq DESC LIMIT 1;
  NEW.seq := coalesce(last_seq, 0) + 1;
  NEW.created_at := clock_timestamp();
  NEW.prev_hash := last_hash;
  NEW.hash := digest(coalesce(last_hash, ''::bytea) || convert_to(audit_payload(NEW), 'UTF8'), 'sha256');
  RETURN NEW;
END
$$;--> statement-breakpoint

CREATE TRIGGER audit_log_chain BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_chain();--> statement-breakpoint

CREATE FUNCTION audit_log_immutable() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only' USING ERRCODE = 'insufficient_privilege';
END
$$;--> statement-breakpoint

CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();--> statement-breakpoint

-- Returns the id of the first row whose hash doesn't match, or NULL if the chain is intact.
-- Runs with the caller's rights, so it only sees (and verifies) the current tenant's rows.
CREATE FUNCTION audit_first_broken_link() RETURNS bigint
  LANGUAGE plpgsql STABLE
  AS $$
DECLARE
  r audit_log;
  expected_prev bytea := NULL;
  expected_seq bigint := 0;
BEGIN
  FOR r IN SELECT * FROM audit_log WHERE org_id = app_current_tenant() ORDER BY seq LOOP
    expected_seq := expected_seq + 1;
    IF r.seq IS DISTINCT FROM expected_seq
       OR r.prev_hash IS DISTINCT FROM expected_prev
       OR r.hash IS DISTINCT FROM digest(coalesce(expected_prev, ''::bytea) || convert_to(audit_payload(r), 'UTF8'), 'sha256') THEN
      RETURN r.id;
    END IF;
    expected_prev := r.hash;
  END LOOP;
  RETURN NULL;
END
$$;
