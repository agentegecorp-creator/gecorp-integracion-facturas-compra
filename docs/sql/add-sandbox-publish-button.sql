alter table review_cases
  add column if not exists sandbox_publish_status text default 'not_ready',
  add column if not exists sandbox_published_at timestamptz,
  add column if not exists sandbox_record_type text,
  add column if not exists sandbox_record_id text,
  add column if not exists sandbox_publish_error text;

create table if not exists sandbox_publish_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  status text not null default 'running',
  limit_count integer not null default 0,
  attempted_count integer not null default 0,
  created_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists sandbox_publish_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references sandbox_publish_runs(id),
  case_id uuid references review_cases(id),
  record_type text,
  tran_id text,
  entity_id text,
  status text not null,
  netsuite_record_id text,
  error_text text,
  payload_json jsonb,
  result_json jsonb,
  created_at timestamptz not null default now()
);
