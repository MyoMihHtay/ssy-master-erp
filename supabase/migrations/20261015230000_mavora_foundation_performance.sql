-- MAVORA Manufacturing ERP
-- Migration 004
-- Foundation performance hardening:
-- 1. Cover foreign-key access paths
-- 2. Optimize auth.uid() evaluation in profile RLS

-- =========================================================
-- 1. AUDIT LOGS
-- =========================================================

create index if not exists idx_audit_logs_site_tenant
  on public.audit_logs (site_id, tenant_id);

create index if not exists idx_audit_logs_actor_user
  on public.audit_logs (actor_user_id);

-- =========================================================
-- 2. PLATFORM CAPABILITIES
-- =========================================================

create index if not exists idx_capabilities_module
  on public.capabilities (module_code);

-- =========================================================
-- 3. DEPARTMENTS / POSITIONS
-- =========================================================

create index if not exists idx_departments_parent_tenant
  on public.departments (parent_id, tenant_id);

create index if not exists idx_departments_site_tenant
  on public.departments (site_id, tenant_id);

create index if not exists idx_positions_department_tenant
  on public.positions (department_id, tenant_id);

-- =========================================================
-- 4. CATEGORIES
-- =========================================================

create index if not exists idx_product_categories_parent_tenant
  on public.product_categories (parent_id, tenant_id);

create index if not exists idx_expense_categories_parent_tenant
  on public.expense_categories (parent_id, tenant_id);

-- =========================================================
-- 5. MEMBERSHIP ACCESS
-- =========================================================

create index if not exists idx_membership_sites_membership_tenant
  on public.membership_sites (membership_id, tenant_id);

create index if not exists idx_membership_sites_site_tenant
  on public.membership_sites (site_id, tenant_id);

create index if not exists idx_membership_warehouse_membership_tenant
  on public.membership_warehouse_access (membership_id, tenant_id);

create index if not exists idx_membership_warehouse_warehouse_tenant
  on public.membership_warehouse_access (warehouse_id, tenant_id);

create index if not exists idx_memberships_default_site_tenant
  on public.tenant_memberships (default_site_id, tenant_id);

create index if not exists idx_memberships_user
  on public.tenant_memberships (user_id);

-- =========================================================
-- 6. TENANT MODULES
-- =========================================================

create index if not exists idx_tenant_modules_module
  on public.tenant_modules (module_code);

-- =========================================================
-- 7. WAREHOUSE / FACTORY STRUCTURE
-- =========================================================

create index if not exists idx_warehouses_site_tenant
  on public.warehouses (site_id, tenant_id);

create index if not exists idx_work_centers_site_tenant
  on public.work_centers (site_id, tenant_id);

create index if not exists idx_work_centers_department_tenant
  on public.work_centers (department_id, tenant_id);

create index if not exists idx_production_lines_site_tenant
  on public.production_lines (site_id, tenant_id);

create index if not exists idx_production_lines_work_center_tenant
  on public.production_lines (work_center_id, tenant_id);

-- =========================================================
-- 8. ROLE / CAPABILITY STRUCTURE
-- =========================================================

create index if not exists idx_role_assignments_membership_tenant
  on public.role_assignments (membership_id, tenant_id);

create index if not exists idx_role_assignments_role_tenant
  on public.role_assignments (role_id, tenant_id);

create index if not exists idx_role_assignments_site_tenant
  on public.role_assignments (site_id, tenant_id);

create index if not exists idx_role_assignments_created_by
  on public.role_assignments (created_by);

create index if not exists idx_role_capabilities_role_tenant
  on public.role_capabilities (role_id, tenant_id);

create index if not exists idx_role_capabilities_capability
  on public.role_capabilities (capability_code);

-- =========================================================
-- 9. UNIT CONVERSIONS
-- =========================================================

create index if not exists idx_unit_conversions_from_tenant
  on public.unit_conversions (from_unit_id, tenant_id);

create index if not exists idx_unit_conversions_to_tenant
  on public.unit_conversions (to_unit_id, tenant_id);

-- =========================================================
-- 10. RLS INIT-PLAN OPTIMIZATION
-- =========================================================
-- Using (select auth.uid()) allows PostgreSQL to evaluate the
-- authenticated user ID once per statement instead of per row.

drop policy if exists profiles_update_self
  on public.profiles;

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
)
with check (
  id = (select auth.uid())
);

