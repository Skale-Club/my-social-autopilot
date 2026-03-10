-- Migration: Version Limit and Storage Cleanup
-- Limits post versions to 10 per post and adds cleanup function

-- ============================================================
-- PART 1: Function to limit post versions (trigger-based)
-- ============================================================

create or replace function public.limit_post_versions()
returns trigger
language plpgsql
as $$
declare
  max_versions int := 10;
  v_old_version_id uuid;
  v_old_image_url text;
  v_old_thumbnail_url text;
begin
  -- Find versions to delete (keep only the latest 10)
  for v_old_version_id, v_old_image_url, v_old_thumbnail_url in
    select id, image_url, thumbnail_url
    from public.post_versions
    where post_id = new.post_id
    order by version_number asc
    offset max_versions
  loop
    -- Delete the version record
    delete from public.post_versions where id = v_old_version_id;
    
    -- Log for potential cleanup (we can't directly delete from storage here)
    -- The application should handle storage cleanup based on this log
    insert into public.version_cleanup_log (version_id, image_url, thumbnail_url, created_at)
    values (v_old_version_id, v_old_image_url, v_old_thumbnail_url, now())
    on conflict do nothing;
  end loop;
  
  return new;
end;
$$;

-- Create cleanup log table if not exists
create table if not exists public.version_cleanup_log (
  id uuid default gen_random_uuid() primary key,
  version_id uuid not null,
  image_url text not null,
  thumbnail_url text,
  cleaned_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_version_cleanup_log_cleaned 
  on public.version_cleanup_log(cleaned_at) 
  where cleaned_at is null;

-- Drop existing trigger if any
drop trigger if exists limit_post_versions_trigger on public.post_versions;

-- Create trigger
create trigger limit_post_versions_trigger
  after insert on public.post_versions
  for each row
  execute function public.limit_post_versions();

-- ============================================================
-- PART 2: Storage cleanup helper function
-- ============================================================

-- Function to get pending cleanup files (called by app)
create or replace function public.get_pending_storage_cleanup(limit_count int default 100)
returns table (id uuid, image_url text, thumbnail_url text)
language plpgsql
security definer
as $$
begin
  return query
  select vcl.id, vcl.image_url, vcl.thumbnail_url
  from public.version_cleanup_log vcl
  where vcl.cleaned_at is null
  order by vcl.created_at asc
  limit limit_count;
end;
$$;

-- Function to mark cleanup as done
create or replace function public.mark_storage_cleaned(p_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.version_cleanup_log
  set cleaned_at = now()
  where id = p_id;
end;
$$;

-- ============================================================
-- PART 3: Indexes for performance
-- ============================================================

create index if not exists idx_post_versions_post_id_version 
  on public.post_versions(post_id, version_number desc);

-- ============================================================
-- PART 4: RLS policies for cleanup log
-- ============================================================

alter table public.version_cleanup_log enable row level security;

-- Only service role can access cleanup log
drop policy if exists "Service role only" on public.version_cleanup_log;
create policy "Service role only" on public.version_cleanup_log
  for all using (auth.role() = 'service_role');

-- ============================================================
-- PART 5: Clean up old versions that exceed limit
-- ============================================================

-- One-time cleanup of existing posts with more than 10 versions
do $$
declare
  v_post record;
  v_version record;
  v_count int;
begin
  for v_post in select distinct post_id from public.post_versions loop
    v_count := 0;
    for v_version in 
      select id, image_url, thumbnail_url
      from public.post_versions
      where post_id = v_post.post_id
      order by version_number desc
    loop
      v_count := v_count + 1;
      if v_count > 10 then
        -- Log for cleanup
        insert into public.version_cleanup_log (version_id, image_url, thumbnail_url)
        values (v_version.id, v_version.image_url, v_version.thumbnail_url)
        on conflict do nothing;
        
        -- Delete version
        delete from public.post_versions where id = v_version.id;
      end if;
    end loop;
  end loop;
end $$;
