CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('USER', 'MANAGER', 'ADMIN');
CREATE TYPE request_status AS ENUM ('IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE approval_stage AS ENUM ('MANAGER', 'ADMIN', 'COMPLETE');
CREATE TYPE approval_level AS ENUM ('MANAGER', 'ADMIN');
CREATE TYPE approval_action AS ENUM ('APPROVE', 'REJECT');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE CHECK (email = LOWER(email)),
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 100),
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'USER',
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE access_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 2 AND 80),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 5 AND 240),
  icon TEXT NOT NULL DEFAULT 'key'
    CHECK (icon IN ('shield', 'code', 'palette', 'ticket', 'database', 'key')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL UNIQUE,
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  access_type_id UUID NOT NULL REFERENCES access_types(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
  status request_status NOT NULL DEFAULT 'IN_PROGRESS',
  stage approval_stage NOT NULL DEFAULT 'MANAGER',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT valid_request_state CHECK (
    (status = 'IN_PROGRESS' AND stage IN ('MANAGER', 'ADMIN')) OR
    (status IN ('APPROVED', 'REJECTED', 'CANCELLED') AND stage = 'COMPLETE')
  )
);

CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES access_requests(id) ON DELETE RESTRICT,
  level approval_level NOT NULL,
  approver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action approval_action NOT NULL,
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 500),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, level)
);

CREATE INDEX idx_users_manager ON users(manager_id) WHERE is_active = TRUE;
CREATE INDEX idx_requests_requester ON access_requests(requester_id, created_at DESC);
CREATE INDEX idx_requests_queue ON access_requests(stage, status, created_at)
  WHERE status = 'IN_PROGRESS';
CREATE INDEX idx_approvals_request ON approvals(request_id, decided_at);
