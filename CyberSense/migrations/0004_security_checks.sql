create table if not exists security_checks (
  id text primary key,
  target_url text not null,
  hostname text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  results jsonb not null default '[]'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists security_checks_host_idx on security_checks (hostname, completed_at desc);
create index if not exists security_checks_time_idx on security_checks (completed_at desc);
