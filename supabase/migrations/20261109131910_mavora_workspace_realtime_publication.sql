-- =========================================================
-- MAVORA ERP
-- Phase 10C-2E4 — Workspace Realtime Publication
--
-- Enables tenant-safe Workspace INSERT / UPDATE notifications
-- through Supabase Postgres Changes.
--
-- Important:
-- Supabase Postgres Changes DELETE events are not filterable.
-- MAVORA frontend must not rely on a tenant-filtered DELETE
-- event for cross-user deletion synchronization.
--
-- No legacy MRS objects are modified.
-- =========================================================

do $migration$
begin

  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    raise exception
      'supabase_realtime publication does not exist';
  end if;


  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workspace_posts'
  ) then

    execute
      'alter publication supabase_realtime '
      'add table public.workspace_posts';

  end if;

end;
$migration$;


-- Keep DEFAULT replica identity.
-- workspace_posts already has a UUID primary key.
-- REPLICA IDENTITY FULL is intentionally not enabled:
-- it does not make filtered DELETE events safe/filterable
-- and would increase WAL volume.
