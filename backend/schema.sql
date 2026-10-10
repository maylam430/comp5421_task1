-- Run once in the Supabase SQL editor.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  content text not null default '',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_updated_at_idx on public.notes (updated_at desc);

-- The FastAPI server uses the service_role key, which bypasses row level security.
alter table public.notes enable row level security;
