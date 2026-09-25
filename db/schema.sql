-- PostgreSQL schema for deployments that outgrow file storage (see ARCHITECTURE.md → Storage and the database path).
-- The application currently uses lib/storage/{cases,audit}.ts with JSON files; a repository implementing the same
-- functions against these tables is the only change required.

CREATE TABLE knowledge_versions (
  version        TEXT PRIMARY KEY,
  content_hash   CHAR(64) NOT NULL UNIQUE,
  generated_at   TIMESTAMPTZ NOT NULL,
  promoted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  validation     JSONB NOT NULL
);

CREATE TABLE cases (
  id             TEXT PRIMARY KEY CHECK (id ~ '^case_[a-f0-9]{12}$'),
  patient_ref    TEXT NOT NULL CHECK (patient_ref ~ '^[A-Za-z0-9-]{1,40}$'),
  demo_key       TEXT,
  input          JSONB NOT NULL,           -- validated CaseInput
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cases_updated_idx ON cases (updated_at DESC);

CREATE TABLE analyses (
  id                  TEXT PRIMARY KEY CHECK (id ~ '^an_[a-f0-9]{12}$'),
  case_id             TEXT NOT NULL REFERENCES cases(id),
  created_at          TIMESTAMPTZ NOT NULL,
  kb_version          TEXT NOT NULL,
  kb_content_hash     CHAR(64) NOT NULL,
  mode                TEXT NOT NULL CHECK (mode IN ('deterministic', 'deterministic+ai-extraction')),
  red_flag_status     TEXT NOT NULL CHECK (red_flag_status IN ('clear', 'urgent', 'emergency')),
  candidates_withheld BOOLEAN NOT NULL,
  result              JSONB NOT NULL        -- full AnalysisResult
);
CREATE INDEX analyses_case_idx ON analyses (case_id, created_at DESC);

CREATE TABLE redflag_acknowledgements (
  id             BIGSERIAL PRIMARY KEY,
  case_id        TEXT NOT NULL REFERENCES cases(id),
  analysis_id    TEXT NOT NULL REFERENCES analyses(id),
  rule_ids       TEXT[] NOT NULL,
  clinician_ref  TEXT NOT NULL,
  reason         TEXT NOT NULL,
  at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE decisions (
  id             TEXT PRIMARY KEY,
  case_id        TEXT NOT NULL REFERENCES cases(id),
  analysis_id    TEXT NOT NULL REFERENCES analyses(id),
  candidate_id   TEXT NOT NULL,
  candidate_name TEXT NOT NULL,
  system         TEXT NOT NULL CHECK (system IN ('allopathy', 'ayurveda', 'homeopathy')),
  action         TEXT NOT NULL CHECK (action IN ('accepted', 'rejected', 'modified', 'chose-alternative', 'reviewed')),
  alternative    TEXT,
  reason         TEXT,
  clinician_ref  TEXT NOT NULL,
  kb_version     TEXT NOT NULL,
  at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (action NOT IN ('rejected', 'chose-alternative') OR reason IS NOT NULL)
);

-- Append-only, hash-chained audit log. Revoke UPDATE/DELETE from the application role.
CREATE TABLE audit_log (
  seq            BIGINT PRIMARY KEY,
  at             TIMESTAMPTZ NOT NULL,
  event          TEXT NOT NULL,
  case_id        TEXT,
  analysis_id    TEXT,
  actor          TEXT,
  kb_version     TEXT,
  kb_content_hash CHAR(64),
  payload        JSONB NOT NULL,
  prev_hash      CHAR(64) NOT NULL,
  hash           CHAR(64) NOT NULL UNIQUE
);
CREATE INDEX audit_case_idx ON audit_log (case_id);
-- REVOKE UPDATE, DELETE ON audit_log FROM cds_app;
