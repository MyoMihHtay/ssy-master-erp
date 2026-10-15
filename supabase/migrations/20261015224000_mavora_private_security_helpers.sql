-- MAVORA Manufacturing ERP
-- Migration 003
-- Move SECURITY DEFINER helpers out of the exposed public schema.

-- =========================================================
-- 1. PRIVATE SECURITY SCHEMA
-- =========================================================

create schema if not exists app_private;

revoke all on schema app_private from public;
revoke all on schema app_private from anon;

grant usage on schema app_private to authenticated;
grant usage on schema app_private to service_role;

-- =========================================================
-- 2. MOVE SECURITY DEFINER FUNCTIONS OUT OF PUBLIC
-- =========================================================

alter function public.handle_new_user()
  set schema app_private;

alter function public.is_tenant_member(uuid)
  set schema app_private;

alter function public.is_organization_member(uuid)
  set schema app_private;

alter function public.has_site_access(uuid)
  set schema app_private;

alter function public.has_warehouse_access(uuid)
  set schema app_private;

alter function public.has_capability(uuid, text, uuid)
  set schema app_private;

alter function public.can_view_membership(uuid)
  set schema app_private;

alter function public.can_view_profile(uuid)
  set schema app_private;

-- =========================================================
-- 3. REASSERT SAFE SEARCH PATH
-- =========================================================

alter function app_private.handle_new_user()
  set search_path = pg_catalog;

alter function app_private.is_tenant_member(uuid)
  set search_path = pg_catalog;

alter function app_private.is_organization_member(uuid)
  set search_path = pg_catalog;

alter function app_private.has_site_access(uuid)
  set search_path = pg_catalog;

alter function app_private.has_warehouse_access(uuid)
  set search_path = pg_catalog;

alter function app_private.has_capability(uuid, text, uuid)
  set search_path = pg_catalog;

alter function app_private.can_view_membership(uuid)
  set search_path = pg_catalog;

alter function app_private.can_view_profile(uuid)
  set search_path = pg_catalog;

-- =========================================================
-- 4. UPDATE INTERNAL HELPER-TO-HELPER REFERENCES
-- =========================================================

create or replace function app_private.has_warehouse_access(
  p_warehouse_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.warehouses w
    join public.tenant_memberships tm
      on tm.tenant_id = w.tenant_id
     and tm.user_id = auth.uid()
     and tm.status = 'active'
    where w.id = p_warehouse_id
      and app_private.has_site_access(w.site_id)
      and (
        not exists (
          select 1
          from public.membership_warehouse_access mwa_any
          where mwa_any.membership_id = tm.id
            and mwa_any.tenant_id = w.tenant_id
        )
        or exists (
          select 1
          from public.membership_warehouse_access mwa
          where mwa.membership_id = tm.id
            and mwa.tenant_id = w.tenant_id
            and mwa.warehouse_id = w.id
        )
      )
  );
$$;

create or replace function app_private.can_view_membership(
  p_membership_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.id = p_membership_id
      and (
        tm.user_id = auth.uid()
        or app_private.has_capability(
          tm.tenant_id,
          'users.view',
          null
        )
      )
  );
$$;

create or replace function app_private.can_view_profile(
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    p_profile_id = auth.uid()
    or exists (
      select 1
      from public.tenant_memberships target_tm
      where target_tm.user_id = p_profile_id
        and target_tm.status = 'active'
        and app_private.has_capability(
          target_tm.tenant_id,
          'users.view',
          null
        )
    );
$$;

-- =========================================================
-- 5. REMOVE EXTERNAL EXECUTION RIGHTS
-- =========================================================

revoke all on all functions in schema app_private from public;
revoke all on all functions in schema app_private from anon;
revoke all on all functions in schema app_private from authenticated;
revoke all on all functions in schema app_private from service_role;

-- Authenticated users need these helpers only for RLS policy evaluation.
grant execute on function app_private.is_tenant_member(uuid)
  to authenticated, service_role;

grant execute on function app_private.is_organization_member(uuid)
  to authenticated, service_role;

grant execute on function app_private.has_site_access(uuid)
  to authenticated, service_role;

grant execute on function app_private.has_warehouse_access(uuid)
  to authenticated, service_role;

grant execute on function app_private.has_capability(uuid, text, uuid)
  to authenticated, service_role;

grant execute on function app_private.can_view_membership(uuid)
  to authenticated, service_role;

grant execute on function app_private.can_view_profile(uuid)
  to authenticated, service_role;

-- handle_new_user() is a trigger-only function.
-- No anon/authenticated/service_role direct EXECUTE permission is granted.

