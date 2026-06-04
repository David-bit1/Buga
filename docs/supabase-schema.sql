create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  email text unique not null,
  password text not null,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  avatar text not null default 'neon',
  theme_color text not null default '#8a4dff',
  is_kids boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_user_name_unique
  on public.profiles (user_id, lower(name));

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  movie_id integer not null,
  title text not null default '',
  poster text not null default '',
  backdrop text not null default '',
  genres jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, movie_id)
);

create table if not exists public.watch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  movie_id integer not null,
  title text not null default '',
  poster text not null default '',
  backdrop text not null default '',
  genres jsonb not null default '[]'::jsonb,
  progress numeric not null default 0,
  "current_time" numeric not null default 0,
  duration numeric not null default 0,
  runtime numeric not null default 0,
  last_viewed timestamptz not null default now(),
  source text not null default 'watch',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, movie_id)
);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  movie_id integer not null,
  title text not null default '',
  poster text not null default '',
  backdrop text not null default '',
  genres jsonb not null default '[]'::jsonb,
  reason text not null default '',
  source text not null default '',
  score numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, movie_id)
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  favorite_movie_ids integer[] not null default '{}'::integer[],
  watch_history jsonb not null default '[]'::jsonb,
  continue_watching jsonb not null default '[]'::jsonb,
  recent_movie_ids integer[] not null default '{}'::integer[],
  genre_scores jsonb not null default '[]'::jsonb,
  actor_scores jsonb not null default '[]'::jsonb,
  director_scores jsonb not null default '[]'::jsonb,
  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, profile_id)
);

create table if not exists public.genres (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer,
  name text not null,
  slug text not null unique,
  color text not null default '#8a4dff',
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.movies (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer not null unique,
  title text not null,
  overview text not null default '',
  poster text not null default '',
  backdrop text not null default '',
  release_date text not null default '',
  runtime integer not null default 0,
  genres jsonb not null default '[]'::jsonb,
  video_source text not null default '',
  featured boolean not null default false,
  status text not null default 'published' check (status in ('draft', 'published')),
  processing_status text not null default 'idle' check (processing_status in ('idle', 'processing', 'ready', 'error')),
  source_file text not null default '',
  hls_directory text not null default '',
  hls_manifest text not null default '',
  hls_qualities jsonb not null default '[]'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'favorites',
    'watch_history',
    'recommendations',
    'user_preferences',
    'genres',
    'movies',
    'admin_settings'
  ]
  loop
    execute format('drop trigger if exists set_updated_at_%I on public.%I', table_name, table_name);
    execute format(
      'create trigger set_updated_at_%I before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.watch_history enable row level security;
alter table public.recommendations enable row level security;
alter table public.user_preferences enable row level security;
alter table public.genres enable row level security;
alter table public.movies enable row level security;
alter table public.admin_settings enable row level security;

-- El backend usa la service_role key, por lo que estas tablas pueden permanecer protegidas por RLS
-- hasta que quieras exponer acceso directo desde el cliente.
