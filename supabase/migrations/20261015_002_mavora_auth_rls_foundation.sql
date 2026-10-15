-- MAVORA Manufacturing ERP
-- Migration 002
-- Authentication helpers + tenant isolation + RLS policies

-- =========================================================
-- 1. HARDEN EXISTING UPDATED_AT FUNCTION
-- =========================================================

alter function public.set_updated_at()
  set search_path = pg_catalog;

-- =========================================================
-- 2. AUTH USER -> PROFILE
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.profiles (
    id,
    display_name,
    phone
  )
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      new.email,
      new.phone,
      'User'
    ),
    new.phone
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_mavora_auth_user_created on auth.users;

create trigger on_mavora_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Backfill profiles safely if DEV already contains Auth users.
insert into public.profiles (id, display_name, phone)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    u.email,
    u.phone,
    'User'
  ),
  u.phone
from auth.users u
on conflict (id) do nothing;

-- =========================================================
-- 3. TENANT MEMBERSHIP HELPER
-- =========================================================

create or replace function public.is_tenant_member(
  p_tenant_id uuid
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
    where tm.tenant_id = p_tenant_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
  );
$$;

-- =========================================================
-- 4. ORGANIZATION MEMBERSHIP HELPER
-- =========================================================

create or replace function public.is_organization_member(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.tenants t
    join public.tenant_memberships tm
      on tm.tenant_id = t.id
    where t.organization_id = p_organization_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
  );
$$;

-- =========================================================
-- 5. SITE ACCESS HELPER
-- =========================================================

create or replace function public.has_site_access(
  p_site_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.sites s
    join public.tenant_memberships tm
      on tm.tenant_id = s.tenant_id
     and tm.user_id = auth.uid()
     and tm.status = 'active'
    where s.id = p_site_id
      and (
        exists (
          select 1
          from public.membership_sites ms
          where ms.membership_id = tm.id
            and ms.tenant_id = s.tenant_id
            and ms.site_id = s.id
        )
        or exists (
          select 1
          from public.role_assignments ra
          where ra.membership_id = tm.id
            and ra.tenant_id = s.tenant_id
            and (
              ra.site_id is null
              or ra.site_id = s.id
            )
        )
      )
  );
$$;

-- =========================================================
-- 6. WAREHOUSE ACCESS HELPER
-- =========================================================

create or replace function public.has_warehouse_access(
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
      and public.has_site_access(w.site_id)
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

-- =========================================================
-- 7. CAPABILITY HELPER
-- =========================================================

create or replace function public.has_capability(
  p_tenant_id uuid,
  p_capability_code text,
  p_site_id uuid default null
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
    join public.role_assignments ra
      on ra.membership_id = tm.id
     and ra.tenant_id = tm.tenant_id
    join public.roles r
      on r.id = ra.role_id
     and r.tenant_id = tm.tenant_id
     and r.is_active = true
    join public.role_capabilities rc
      on rc.role_id = r.id
     and rc.tenant_id = tm.tenant_id
    join public.capabilities c
      on c.code = rc.capability_code
     and c.is_active = true
    where tm.tenant_id = p_tenant_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
      and c.code = p_capability_code
      and (
        (
          p_site_id is null
          and ra.site_id is null
        )
        or
        (
          p_site_id is not null
          and exists (
            select 1
            from public.sites s
            where s.id = p_site_id
              and s.tenant_id = p_tenant_id
          )
          and (
            ra.site_id is null
            or ra.site_id = p_site_id
          )
        )
      )
  );
$$;

-- =========================================================
-- 8. MEMBERSHIP VISIBILITY HELPER
-- =========================================================

create or replace function public.can_view_membership(
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
        or public.has_capability(
          tm.tenant_id,
          'users.view',
          null
        )
      )
  );
$$;

-- =========================================================
-- 9. PROFILE VISIBILITY HELPER
-- =========================================================

create or replace function public.can_view_profile(
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
        and public.has_capability(
          target_tm.tenant_id,
          'users.view',
          null
        )
    );
$$;

-- =========================================================
-- 10. FUNCTION EXECUTION SECURITY
-- =========================================================

revoke all on function public.is_tenant_member(uuid) from public;
revoke all on function public.is_organization_member(uuid) from public;
revoke all on function public.has_site_access(uuid) from public;
revoke all on function public.has_warehouse_access(uuid) from public;
revoke all on function public.has_capability(uuid, text, uuid) from public;
revoke all on function public.can_view_membership(uuid) from public;
revoke all on function public.can_view_profile(uuid) from public;

grant execute on function public.is_tenant_member(uuid)
  to authenticated;

grant execute on function public.is_organization_member(uuid)
  to authenticated;

grant execute on function public.has_site_access(uuid)
  to authenticated;

grant execute on function public.has_warehouse_access(uuid)
  to authenticated;

grant execute on function public.has_capability(uuid, text, uuid)
  to authenticated;

grant execute on function public.can_view_membership(uuid)
  to authenticated;

grant execute on function public.can_view_profile(uuid)
  to authenticated;

-- =========================================================
-- 11. ORGANIZATIONS / TENANTS
-- =========================================================

create policy organizations_select_member
on public.organizations
for select
to authenticated
using (
  public.is_organization_member(id)
);

create policy tenants_select_member
on public.tenants
for select
to authenticated
using (
  public.is_tenant_member(id)
);

-- =========================================================
-- 12. TENANT SETTINGS / MODULES
-- =========================================================

create policy tenant_settings_select_member
on public.tenant_settings
for select
to authenticated
using (
  public.is_tenant_member(tenant_id)
);

create policy tenant_settings_update_manager
on public.tenant_settings
for update
to authenticated
using (
  public.has_capability(
    tenant_id,
    'settings.manage',
    null
  )
)
with check (
  public.has_capability(
    tenant_id,
    'settings.manage',
    null
  )
);

create policy platform_modules_select_authenticated
on public.platform_modules
for select
to authenticated
using (is_active = true);

create policy tenant_modules_select_member
on public.tenant_modules
for select
to authenticated
using (
  public.is_tenant_member(tenant_id)
);

create policy tenant_modules_update_manager
on public.tenant_modules
for update
to authenticated
using (
  public.has_capability(
    tenant_id,
    'settings.manage',
    null
  )
)
with check (
  public.has_capability(
    tenant_id,
    'settings.manage',
    null
  )
);

-- =========================================================
-- 13. SITES
-- =========================================================

create policy sites_select_scoped
on public.sites
for select
to authenticated
using (
  public.has_site_access(id)
);

create policy sites_insert_manager
on public.sites
for insert
to authenticated
with check (
  public.has_capability(
    tenant_id,
    'settings.manage',
    null
  )
);

create policy sites_update_manager
on public.sites
for update
to authenticated
using (
  public.has_capability(
    tenant_id,
    'settings.manage',
    null
  )
)
with check (
  public.has_capability(
    tenant_id,
    'settings.manage',
    null
  )
);

-- =========================================================
-- 14. DEPARTMENTS / POSITIONS
-- =========================================================

create policy departments_select_scoped
on public.departments
for select
to authenticated
using (
  (
    site_id is null
    and public.is_tenant_member(tenant_id)
  )
  or
  (
    site_id is not null
    and public.has_site_access(site_id)
  )
);

create policy departments_insert_manager
on public.departments
for insert
to authenticated
with check (
  public.has_capability(
    tenant_id,
    'settings.manage',
    site_id
  )
);

create policy departments_update_manager
on public.departments
for update
to authenticated
using (
  public.has_capability(
    tenant_id,
    'settings.manage',
    site_id
  )
)
with check (
  public.has_capability(
    tenant_id,
    'settings.manage',
    site_id
  )
);

create policy positions_select_member
on public.positions
for select
to authenticated
using (
  public.is_tenant_member(tenant_id)
);

create policy positions_insert_manager
on public.positions
for insert
to authenticated
with check (
  public.has_capability(
    tenant_id,
    'settings.manage',
    null
  )
);

create policy positions_update_manager
on public.positions
for update
to authenticated
using (
  public.has_capability(
    tenant_id,
    'settings.manage',
    null
  )
)
with check (
  public.has_capability(
    tenant_id,
    'settings.manage',
    null
  )
);

-- =========================================================
-- 15. WAREHOUSES / WORK CENTERS / PRODUCTION LINES
-- =========================================================

create policy warehouses_select_scoped
on public.warehouses
for select
to authenticated
using (
  public.has_warehouse_access(id)
);

create policy warehouses_insert_manager
on public.warehouses
for insert
to authenticated
with check (
  public.has_capability(
    tenant_id,
    'inventory.master_manage',
    site_id
  )
);

create policy warehouses_update_manager
on public.warehouses
for update
to authenticated
using (
  public.has_capability(
    tenant_id,
    'inventory.master_manage',
    site_id
  )
)
with check (
  public.has_capability(
    tenant_id,
    'inventory.master_manage',
    site_id
  )
);

create policy work_centers_select_scoped
on public.work_centers
for select
to authenticated
using (
  public.has_site_access(site_id)
);

create policy work_centers_insert_manager
on public.work_centers
for insert
to authenticated
with check (
  public.has_capability(
    tenant_id,
    'production.master_manage',
    site_id
  )
);

create policy work_centers_update_manager
on public.work_centers
for update
to authenticated
using (
  public.has_capability(
    tenant_id,
    'production.master_manage',
    site_id
  )
)
with check (
  public.has_capability(
    tenant_id,
    'production.master_manage',
    site_id
  )
);

create policy production_lines_select_scoped
on public.production_lines
for select
to authenticated
using (
  public.has_site_access(site_id)
);

create policy production_lines_insert_manager
on public.production_lines
for insert
to authenticated
with check (
  public.has_capability(
    tenant_id,
    'production.master_manage',
    site_id
  )
);

create policy production_lines_update_manager
on public.production_lines
for update
to authenticated
using (
  public.has_capability(
    tenant_id,
    'production.master_manage',
    site_id
  )
)
with check (
  public.has_capability(
    tenant_id,
    'production.master_manage',
    site_id
  )
);

-- =========================================================
-- 16. PROFILES / MEMBERSHIPS
-- =========================================================

create policy profiles_select_allowed
on public.profiles
for select
to authenticated
using (
  public.can_view_profile(id)
);

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
)
with check (
  id = auth.uid()
);

create policy tenant_memberships_select_allowed
on public.tenant_memberships
for select
to authenticated
using (
  public.can_view_membership(id)
);

create policy tenant_memberships_insert_manager
on public.tenant_memberships
for insert
to authenticated
with check (
  public.has_capability(
    tenant_id,
    'users.manage',
    null
  )
);

create policy tenant_memberships_update_manager
on public.tenant_memberships
for update
to authenticated
using (
  public.has_capability(
    tenant_id,
    'users.manage',
    null
  )
)
with check (
  public.has_capability(
    tenant_id,
    'users.manage',
    null
  )
);

-- =========================================================
-- 17. MEMBERSHIP SITE / WAREHOUSE SCOPE
-- =========================================================

create policy membership_sites_select_allowed
on public.membership_sites
for select
to authenticated
using (
  public.can_view_membership(membership_id)
);

create policy membership_sites_insert_manager
on public.membership_sites
for insert
to authenticated
with check (
  public.has_capability(
    tenant_id,
    'users.manage',
    null
  )
);

create policy membership_sites_delete_manager
on public.membership_sites
for delete
to authenticated
using (
  public.has_capability(
    tenant_id,
    'users.manage',
    null
  )
);

create policy membership_warehouse_select_allowed
on public.membership_warehouse_access
for select
to authenticated
using (
  public.can_view_membership(membership_id)
);

create policy membership_warehouse_insert_manager
on public.membership_warehouse_access
for insert
to authenticated
with check (
  public.has_capability(
    tenant_id,
    'users.manage',
    null
  )
);

create policy membership_warehouse_delete_manager
on public.membership_warehouse_access
for delete
to authenticated
using (
  public.has_capability(
    tenant_id,
    'users.manage',
    null
  )
);

-- =========================================================
-- 18. ROLES / CAPABILITIES
-- =========================================================

create policy roles_select_member
on public.roles
for select
to authenticated
using (
  public.is_tenant_member(tenant_id)
);

create policy roles_insert_manager
on public.roles
for insert
to authenticated
with check (
  public.has_capability(
    tenant_id,
    'roles.manage',
    null
  )
);

create policy roles_update_manager
on public.roles
for update
to authenticated
using (
  public.has_capability(
    tenant_id,
    'roles.manage',
    null
  )
)
with check (
  public.has_capability(
    tenant_id,
    'roles.manage',
    null
  )
);

create policy capabilities_select_authenticated
on public.capabilities
for select
to authenticated
using (
  is_active = true
);

create policy role_capabilities_select_member
on public.role_capabilities
for select
to authenticated
using (
  public.is_tenant_member(tenant_id)
);

create policy role_capabilities_insert_manager
on public.role_capabilities
for insert
to authenticated
with check (
  public.has_capability(
    tenant_id,
    'roles.manage',
    null
  )
);

create policy role_capabilities_delete_manager
on public.role_capabilities
for delete
to authenticated
using (
  public.has_capability(
    tenant_id,
    'roles.manage',
    null
  )
);

create policy role_assignments_select_allowed
on public.role_assignments
for select
to authenticated
using (
  public.can_view_membership(membership_id)
);

create policy role_assignments_insert_manager
on public.role_assignments
for insert
to authenticated
with check (
  public.has_capability(
    tenant_id,
    'roles.manage',
    null
  )
);

create policy role_assignments_delete_manager
on public.role_assignments
for delete
to authenticated
using (
  public.has_capability(
    tenant_id,
    'roles.manage',
    null
  )
);

-- =========================================================
-- 19. MASTER DATA
-- =========================================================

create policy units_select_member
on public.units
for select
to authenticated
using (
  public.is_tenant_member(tenant_id)
);

create policy units_insert_manager
on public.units
for insert
to authenticated
with check (
  public.has_capability(
    tenant_id,
    'masterdata.manage',
    null
  )
);

create policy units_update_manager
on public.units
for update
to authenticated
using (
  public.has_capability(
    tenant_id,
    'masterdata.manage',
    null
  )
)
with check (
  public.has_capability(
    tenant_id,
    'masterdata.manage',
    null
  )
);

create policy unit_conversions_select_member
on public.unit_conversions
for select
to authenticated
using (
  public.is_tenant_member(tenant_id)
);

create policy unit_conversions_insert_manager
on public.unit_conversions
for insert
to authenticated
with check (
  public.has_capability(
    tenant_id,
    'masterdata.manage',
    null
  )
);

create policy unit_conversions_update_manager
on public.unit_conversions
for update
to authenticated
using (
  public.has_capability(
    tenant_id,
    'masterdata.manage',
    null
  )
)
with check (
  public.has_capability(
    tenant_id,
    'masterdata.manage',
    null
  )
);

create policy product_categories_select_member
on public.product_categories
for select
to authenticated
using (
  public.is_tenant_member(tenant_id)
);

create policy product_categories_insert_manager
on public.product_categories
for insert
to authenticated
with check (
  public.has_capability(
    tenant_id,
    'masterdata.manage',
    null
  )
);

create policy product_categories_update_manager
on public.product_categories
for update
to authenticated
using (
  public.has_capability(
    tenant_id,
    'masterdata.manage',
    null
  )
)
with check (
  public.has_capability(
    tenant_id,
    'masterdata.manage',
    null
  )
);

create policy expense_categories_select_member
on public.expense_categories
for select
to authenticated
using (
  public.is_tenant_member(tenant_id)
);

create policy expense_categories_insert_manager
on public.expense_categories
for insert
to authenticated
with check (
  public.has_capability(
    tenant_id,
    'masterdata.manage',
    null
  )
);

create policy expense_categories_update_manager
on public.expense_categories
for update
to authenticated
using (
  public.has_capability(
    tenant_id,
    'masterdata.manage',
    null
  )
)
with check (
  public.has_capability(
    tenant_id,
    'masterdata.manage',
    null
  )
);

-- =========================================================
-- 20. AUDIT LOG
-- =========================================================

create policy audit_logs_select_authorized
on public.audit_logs
for select
to authenticated
using (
  tenant_id is not null
  and public.has_capability(
    tenant_id,
    'audit.view',
    site_id
  )
);

-- No INSERT / UPDATE / DELETE client policy for audit_logs.
-- Audit creation will use controlled server-side mechanisms.

