-- SENTINEL-X domain schema. IDs are application-generated text UUIDs / stable keys.
-- JSONB snapshots are the exposure twin source of truth after a pipeline run.

create table if not exists organizations (
  id text primary key,
  name text not null,
  canonical_domain text not null unique,
  sector text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assessments (
  id text primary key,
  organization_id text not null references organizations(id),
  target text not null,
  mode text not null check (mode in ('DEMO', 'LIVE')),
  status text not null,
  current_stage text not null,
  authorized boolean not null default false,
  authorization_id text,
  stage_log jsonb not null default '[]'::jsonb,
  snapshot jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists assessments_org_idx on assessments (organization_id);
create index if not exists assessments_status_idx on assessments (status);
create index if not exists assessments_created_idx on assessments (created_at desc);

create table if not exists authorization_records (
  id text primary key,
  assessment_id text not null references assessments(id) on delete cascade,
  target text not null,
  authorized_by text not null,
  authorization_type text not null,
  scope jsonb not null,
  start_time timestamptz not null,
  end_time timestamptz,
  allowed_modules jsonb not null,
  restrictions jsonb not null default '[]'::jsonb,
  confirmation_text text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists authorization_assessment_idx on authorization_records (assessment_id);

create table if not exists twin_snapshots (
  id text primary key,
  assessment_id text not null references assessments(id) on delete cascade,
  label text not null,
  captured_at timestamptz not null,
  immutable boolean not null default true,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists twin_snapshots_assessment_idx on twin_snapshots (assessment_id, captured_at desc);

create table if not exists simulations (
  id text primary key,
  assessment_id text not null references assessments(id) on delete cascade,
  name text not null,
  control_ids jsonb not null,
  target_path_ids jsonb,
  survivability jsonb not null,
  residual_risk numeric not null,
  residual_band text not null,
  before_risk numeric not null,
  after_risk numeric not null,
  removed_path_ids jsonb not null default '[]'::jsonb,
  surviving_path_ids jsonb not null default '[]'::jsonb,
  result jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists simulations_assessment_idx on simulations (assessment_id, created_at desc);

create table if not exists defense_optimizations (
  id text primary key,
  assessment_id text not null references assessments(id) on delete cascade,
  constraints jsonb not null,
  strategies jsonb not null,
  selected_strategy_id text,
  created_at timestamptz not null default now()
);

create index if not exists defense_opt_assessment_idx on defense_optimizations (assessment_id, created_at desc);

create table if not exists reports (
  id text primary key,
  assessment_id text not null references assessments(id) on delete cascade,
  title text not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists reports_assessment_idx on reports (assessment_id, created_at desc);

create table if not exists ai_queries (
  id text primary key,
  assessment_id text not null references assessments(id) on delete cascade,
  question text not null,
  audience text not null,
  provider text not null,
  response jsonb not null,
  rejected boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists ai_queries_assessment_idx on ai_queries (assessment_id, created_at desc);

create table if not exists audit_logs (
  id text primary key,
  assessment_id text,
  action text not null,
  request_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_assessment_idx on audit_logs (assessment_id, created_at desc);
create index if not exists audit_logs_action_idx on audit_logs (action, created_at desc);
