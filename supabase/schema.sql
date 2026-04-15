-- ============================================================
-- TRAP TRANSCRIPTOR — Schema Supabase
-- Esegui questo script nell'SQL Editor di Supabase
-- ============================================================

-- Abilita l'estensione uuid
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABELLA: profiles
-- Estende auth.users con dati aggiuntivi dell'utente
-- ============================================================
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text not null,
  display_name text,
  avatar_url  text,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

-- Trigger per aggiornare updated_at automaticamente
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- Trigger per creare il profilo automaticamente al signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- TABELLA: jobs
-- Traccia ogni job di trascrizione
-- ============================================================
create table public.jobs (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  filename        text not null,
  original_name   text not null,
  status          text not null default 'uploading'
                  check (status in ('uploading','processing','transcribing','summarizing','completed','error')),
  error_message   text,
  video_path      text,          -- path in Supabase Storage bucket 'videos'
  transcript_text text,          -- testo trascrizione completa
  transcript_path text,          -- path in bucket 'transcripts'
  report_html     text,          -- HTML del resoconto
  report_path     text,          -- path in bucket 'reports'
  assemblyai_id   text,          -- ID job AssemblyAI per polling
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

create trigger jobs_updated_at
  before update on public.jobs
  for each row execute procedure public.handle_updated_at();

-- Index per query frequenti
create index jobs_user_id_idx on public.jobs(user_id);
create index jobs_status_idx on public.jobs(status);
create index jobs_created_at_idx on public.jobs(created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- profiles: ogni utente vede e modifica solo il proprio profilo
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- jobs: ogni utente vede e gestisce solo i propri job
alter table public.jobs enable row level security;

create policy "jobs_select_own"
  on public.jobs for select
  using (auth.uid() = user_id);

create policy "jobs_insert_own"
  on public.jobs for insert
  with check (auth.uid() = user_id);

create policy "jobs_update_own"
  on public.jobs for update
  using (auth.uid() = user_id);

create policy "jobs_delete_own"
  on public.jobs for delete
  using (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKETS
-- Crea i bucket nell'interfaccia Supabase Storage oppure
-- esegui questi comandi via Dashboard > Storage
-- ============================================================

-- Bucket: videos (file originali caricati)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos', 'videos', false, 5368709120,  -- 5 GB max
  array['video/mp4','video/quicktime','video/x-matroska','video/webm','video/mpeg']
) on conflict (id) do nothing;

-- Bucket: transcripts (file .txt trascrizione)
insert into storage.buckets (id, name, public, file_size_limit)
values ('transcripts', 'transcripts', false, 52428800)  -- 50 MB
on conflict (id) do nothing;

-- Bucket: reports (file .html report)
insert into storage.buckets (id, name, public, file_size_limit)
values ('reports', 'reports', false, 52428800)
on conflict (id) do nothing;

-- Bucket: avatars (immagini profilo utente, pubblico)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 5242880,  -- 5 MB
  array['image/jpeg','image/png','image/webp','image/gif']
) on conflict (id) do nothing;

-- ============================================================
-- STORAGE RLS POLICIES
-- ============================================================

-- avatars: pubblici in lettura, solo owner in scrittura
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_owner_insert"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "avatars_owner_update"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "avatars_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- videos: solo owner
create policy "videos_owner_all"
  on storage.objects for all
  using (bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]);

-- transcripts: solo owner
create policy "transcripts_owner_all"
  on storage.objects for all
  using (bucket_id = 'transcripts' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'transcripts' and auth.uid()::text = (storage.foldername(name))[1]);

-- reports: solo owner
create policy "reports_owner_all"
  on storage.objects for all
  using (bucket_id = 'reports' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'reports' and auth.uid()::text = (storage.foldername(name))[1]);
