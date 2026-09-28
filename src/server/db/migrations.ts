/**
 * Forward-only SQL migrations, embedded as strings so they ship inside the
 * standalone server bundle (no filesystem lookups at runtime).
 *
 * Rules: never edit a migration that has been deployed — append a new one.
 * Each migration runs inside a transaction together with its bookkeeping row.
 */
export interface Migration {
  name: string;
  sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    name: "0001_init",
    sql: /* sql */ `
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash   text NOT NULL,
  first_name      text NOT NULL,
  surname         text NOT NULL,
  role            text NOT NULL CHECK (role IN ('learner', 'teacher', 'admin')),
  date_of_birth   date,
  grade_level     text,
  guardian_email  text,
  ec_number       text UNIQUE,
  school_name     text,
  teacher_status  text CHECK (teacher_status IN ('pending', 'verified', 'rejected')),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_learner_fields CHECK (role <> 'learner' OR date_of_birth IS NOT NULL),
  CONSTRAINT users_teacher_fields CHECK (
    role <> 'teacher' OR (ec_number IS NOT NULL AND school_name IS NOT NULL AND teacher_status IS NOT NULL)
  )
);
CREATE INDEX users_role_created_idx ON users (role, created_at DESC);
CREATE INDEX users_teacher_queue_idx ON users (teacher_status, created_at) WHERE role = 'teacher';

CREATE TABLE sessions (
  id          text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  user_agent  text
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

CREATE TABLE resources (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL UNIQUE,
  title            text NOT NULL,
  description      text NOT NULL DEFAULT '',
  tier             text NOT NULL,
  level            text,
  subject          text,
  resource_type    text NOT NULL,
  audience         text NOT NULL DEFAULT 'public' CHECK (audience IN ('public', 'educator')),
  year             smallint CHECK (year BETWEEN 1980 AND 2100),
  exam_session     text CHECK (exam_session IN ('june', 'november')),
  paper_number     smallint CHECK (paper_number BETWEEN 1 AND 9),
  file_key         text NOT NULL,
  preview_key      text,
  cover_key        text,
  file_size_bytes  integer NOT NULL CHECK (file_size_bytes > 0),
  page_count       integer NOT NULL CHECK (page_count > 0),
  checksum_sha256  text NOT NULL UNIQUE,
  download_count   integer NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  is_published     boolean NOT NULL DEFAULT true,
  created_by       uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  search tsvector GENERATED ALWAYS AS (
    to_tsvector(
      'simple',
      title || ' ' || description
        || ' ' || coalesce(replace(subject, '-', ' '), '')
        || ' ' || coalesce(replace(level, '-', ' '), '')
        || ' ' || coalesce(replace(resource_type, '-', ' '), '')
        || ' ' || coalesce(year::text, '')
    )
  ) STORED
);
CREATE INDEX resources_browse_idx  ON resources (tier, level, subject) WHERE is_published;
CREATE INDEX resources_popular_idx ON resources (download_count DESC, created_at DESC) WHERE is_published;
CREATE INDEX resources_newest_idx  ON resources (created_at DESC) WHERE is_published;
CREATE INDEX resources_search_idx  ON resources USING gin (search);

CREATE TABLE resource_events (
  id           bigserial PRIMARY KEY,
  resource_id  uuid NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  user_id      uuid REFERENCES users (id) ON DELETE SET NULL,
  kind         text NOT NULL CHECK (kind IN ('view', 'download')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resource_events_resource_idx ON resource_events (resource_id, created_at DESC);
CREATE INDEX resource_events_user_idx     ON resource_events (user_id, created_at DESC);
CREATE INDEX resource_events_created_idx  ON resource_events (created_at);

CREATE TABLE resource_daily_uniques (
  resource_id  uuid NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  day          date NOT NULL,
  PRIMARY KEY (resource_id, user_id, day)
);

CREATE TABLE support_tickets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference        text NOT NULL UNIQUE,
  first_name       text NOT NULL,
  surname          text NOT NULL,
  email            text NOT NULL,
  phone            text,
  category         text NOT NULL,
  message          text NOT NULL,
  user_id          uuid REFERENCES users (id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  delivery_status  text NOT NULL DEFAULT 'pending'
                   CHECK (delivery_status IN ('pending', 'sent', 'failed', 'not_configured')),
  delivery_error   text,
  ip_hash          text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_tickets_status_idx ON support_tickets (status, created_at DESC);
CREATE INDEX support_tickets_ip_idx     ON support_tickets (ip_hash, created_at DESC);

CREATE TABLE error_logs (
  id           bigserial PRIMARY KEY,
  source       text NOT NULL CHECK (source IN ('server', 'client')),
  level        text NOT NULL DEFAULT 'error' CHECK (level IN ('error', 'warning')),
  message      text NOT NULL,
  stack        text,
  url          text,
  fingerprint  text NOT NULL,
  context      jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id      uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX error_logs_created_idx     ON error_logs (created_at DESC);
CREATE INDEX error_logs_fingerprint_idx ON error_logs (fingerprint, created_at DESC);
`,
  },
];
