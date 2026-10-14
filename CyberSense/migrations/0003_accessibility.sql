-- Track D accessibility scanning schema.
--
-- Kept in its own table on purpose: an accessibility violation is a fact about a
-- rendered page, not a modeled attack path, so accessibility results must never
-- be merged into the SENTINEL-X cyber risk model. `result` holds the full scan
-- record (including per-element evidence); the scalar/jsonb columns duplicate the
-- fields the history list needs so it can be queried without reading whole blobs.

create table if not exists accessibility_scans (
  id text primary key,
  url text not null,
  hostname text not null,
  status text not null check (status in ('COMPLETED', 'PARTIAL', 'FAILED')),
  engine text not null,
  scanned_at timestamptz not null default now(),
  summary jsonb not null default '{}'::jsonb,
  violations jsonb not null default '[]'::jsonb,
  incomplete jsonb not null default '[]'::jsonb,
  passes jsonb not null default '[]'::jsonb,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists accessibility_scans_host_idx on accessibility_scans (hostname, scanned_at desc);
create index if not exists accessibility_scans_time_idx on accessibility_scans (scanned_at desc);
