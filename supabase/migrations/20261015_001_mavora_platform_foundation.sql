-- MAVORA Manufacturing ERP
-- Foundation Schema v1
-- Environment: Development
-- Purpose: Multi-tenant platform foundation
-- No business transaction tables in this migration.

create extension if not exists pgcrypto;

-- =========================================================
-- 1. ORGANIZATIONS
-- =========================================================
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  legal_name text,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 2. TENANTS / COMPANIES
-- =========================================================
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  code text not null,
  slug text not null unique,
  name text not null,
  legal_name text,
  country_code text not null default 'MM',
  currency_code text not null default 'MMK',
  timezone text not null default 'Asia/Yangon',
  status text not null default 'active'
    check (status in ('active', 'suspended', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

-- =========================================================
-- 3. TENANT SETTINGS
-- =========================================================
create table if not exists public.tenant_settings (
  tenant_id uuid primary key
    references public.tenants(id) on delete cascade,
  company_short_name text,
  logo_url text,
  primary_color text,
  secondary_color text,
  default_language text not null default 'my'
    check (default_language in ('my', 'en')),
  currency_code text not null default 'MMK',
  date_format text not null default 'DD/MM/YYYY',
  invoice_prefix text,
  tax_registration_no text,
  address text,
  phone text,
  email text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 4. PLATFORM MODULES
-- =========================================================
create table if not exists public.platform_modules (
  code text primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.tenants(id) on delete cascade,
  module_code text not null
    references public.platform_modules(code) on delete restrict,
  is_enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, module_code)
);

-- =========================================================
-- 5. SITES
-- =========================================================
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  site_type text not null default 'factory'
    check (site_type in ('factory', 'branch', 'office', 'warehouse', 'other')),
  timezone text not null default 'Asia/Yangon',
  address text,
  latitude numeric,
  longitude numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

-- =========================================================
-- 6. DEPARTMENTS / POSITIONS
-- =========================================================
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.tenants(id) on delete cascade,
  site_id uuid
    references public.sites(id) on delete restrict,
  parent_id uuid
    references public.departments(id) on delete restrict,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.tenants(id) on delete cascade,
  department_id uuid
    references public.departments(id) on delete restrict,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

-- =========================================================
-- 7. WAREHOUSES / WORK CENTERS / LINES
-- =========================================================
create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.tenants(id) on delete cascade,
  site_id uuid not null
    references public.sites(id) on delete restrict,
  code text not null,
  name text not null,
  warehouse_type text not null
    check (warehouse_type in ('RM','SFG','PKG','FG','QUARANTINE','GENERAL','SPARE')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, site_id, code)
);

create table if not exists public.work_centers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.tenants(id) on delete cascade,
  site_id uuid not null
    references public.sites(id) on delete restrict,
  department_id uuid
    references public.departments(id) on delete restrict,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, site_id, code)
);

create table if not exists public.production_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.tenants(id) on delete cascade,
  site_id uuid not null
    references public.sites(id) on delete restrict,
  work_center_id uuid
    references public.work_centers(id) on delete restrict,
  code text not null,
  name text not null,
  capacity_per_hour numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, site_id, code)
);

-- =========================================================
-- 8. USER PROFILES
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key
    references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  avatar_url text,
  preferred_language text not null default 'my'
    check (preferred_language in ('my', 'en')),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 9. TENANT MEMBERSHIP
-- =========================================================
create table if not exists public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.tenants(id) on delete cascade,
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'invited', 'suspended')),
  joined_at timestamptz default now(),
  default_site_id uuid
    references public.sites(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists public.membership_sites (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null
    references public.tenant_memberships(id) on delete cascade,
  site_id uuid not null
    references public.sites(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (membership_id, site_id)
);

create table if not exists public.membership_warehouse_access (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null
    references public.tenant_memberships(id) on delete cascade,
  warehouse_id uuid not null
    references public.warehouses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (membership_id, warehouse_id)
);

-- =========================================================
-- 10. ROLES / CAPABILITIES
-- =========================================================
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  is_system_seed boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists public.capabilities (
  code text primary key,
  module_code text,
  action text not null,
  description text,
  risk_level text not null default 'standard'
    check (risk_level in ('low','standard','high','critical')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.role_capabilities (
  role_id uuid not null
    references public.roles(id) on delete cascade,
  capability_code text not null
    references public.capabilities(code) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, capability_code)
);

create table if not exists public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null
    references public.tenant_memberships(id) on delete cascade,
  role_id uuid not null
    references public.roles(id) on delete cascade,
  site_id uuid
    references public.sites(id) on delete cascade,
  created_by uuid
    references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 11. MASTER DATA
-- =========================================================
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  symbol text,
  unit_type text,
  is_base_unit boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists public.unit_conversions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.tenants(id) on delete cascade,
  from_unit_id uuid not null
    references public.units(id) on delete restrict,
  to_unit_id uuid not null
    references public.units(id) on delete restrict,
  conversion_factor numeric not null check (conversion_factor > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, from_unit_id, to_unit_id)
);

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.tenants(id) on delete cascade,
  parent_id uuid
    references public.product_categories(id) on delete restrict,
  code text not null,
  name text not null,
  category_type text not null
    check (category_type in ('RM','SFG','FG','PKG','SPARE','CONSUMABLE','OTHER')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.tenants(id) on delete cascade,
  parent_id uuid
    references public.expense_categories(id) on delete restrict,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

-- =========================================================
-- 12. AUDIT LOG
-- =========================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid
    references public.tenants(id) on delete restrict,
  site_id uuid
    references public.sites(id) on delete restrict,
  actor_user_id uuid
    references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 13. INDEXES
-- =========================================================
create index if not exists idx_tenants_organization
  on public.tenants(organization_id);

create index if not exists idx_sites_tenant
  on public.sites(tenant_id);

create index if not exists idx_memberships_tenant_user
  on public.tenant_memberships(tenant_id, user_id);

create index if not exists idx_roles_tenant
  on public.roles(tenant_id);

create index if not exists idx_audit_logs_tenant_created
  on public.audit_logs(tenant_id, created_at desc);

-- SECURITY NOTE:
-- RLS is enabled in this migration as a deny-by-default baseline.
-- RLS helper functions and access policies will be introduced in the
-- next reviewed migration.
-- =========================================================
-- 14. TENANT INTEGRITY / SECURITY HARDENING
-- =========================================================

-- Referenced tenant-scoped records expose a composite key so
-- child records can prove that their parent belongs to the same tenant.

alter table public.sites
  add constraint uq_sites_id_tenant unique (id, tenant_id);

alter table public.departments
  add constraint uq_departments_id_tenant unique (id, tenant_id);

alter table public.warehouses
  add constraint uq_warehouses_id_tenant unique (id, tenant_id);

alter table public.work_centers
  add constraint uq_work_centers_id_tenant unique (id, tenant_id);

alter table public.production_lines
  add constraint uq_production_lines_id_tenant unique (id, tenant_id);

alter table public.tenant_memberships
  add constraint uq_memberships_id_tenant unique (id, tenant_id);

alter table public.roles
  add constraint uq_roles_id_tenant unique (id, tenant_id);

alter table public.units
  add constraint uq_units_id_tenant unique (id, tenant_id);

alter table public.product_categories
  add constraint uq_product_categories_id_tenant unique (id, tenant_id);

alter table public.expense_categories
  add constraint uq_expense_categories_id_tenant unique (id, tenant_id);

-- ---------------------------------------------------------
-- SAME-TENANT FOREIGN KEYS
-- ---------------------------------------------------------

alter table public.departments
  add constraint fk_departments_site_tenant
  foreign key (site_id, tenant_id)
  references public.sites(id, tenant_id)
  on delete restrict;

alter table public.departments
  add constraint fk_departments_parent_tenant
  foreign key (parent_id, tenant_id)
  references public.departments(id, tenant_id)
  on delete restrict;

alter table public.positions
  add constraint fk_positions_department_tenant
  foreign key (department_id, tenant_id)
  references public.departments(id, tenant_id)
  on delete restrict;

alter table public.warehouses
  add constraint fk_warehouses_site_tenant
  foreign key (site_id, tenant_id)
  references public.sites(id, tenant_id)
  on delete restrict;

alter table public.work_centers
  add constraint fk_work_centers_site_tenant
  foreign key (site_id, tenant_id)
  references public.sites(id, tenant_id)
  on delete restrict;

alter table public.work_centers
  add constraint fk_work_centers_department_tenant
  foreign key (department_id, tenant_id)
  references public.departments(id, tenant_id)
  on delete restrict;

alter table public.production_lines
  add constraint fk_production_lines_site_tenant
  foreign key (site_id, tenant_id)
  references public.sites(id, tenant_id)
  on delete restrict;

alter table public.production_lines
  add constraint fk_production_lines_work_center_tenant
  foreign key (work_center_id, tenant_id)
  references public.work_centers(id, tenant_id)
  on delete restrict;

alter table public.tenant_memberships
  add constraint fk_memberships_default_site_tenant
  foreign key (default_site_id, tenant_id)
  references public.sites(id, tenant_id)
  on delete restrict;

alter table public.unit_conversions
  add constraint fk_unit_conversions_from_tenant
  foreign key (from_unit_id, tenant_id)
  references public.units(id, tenant_id)
  on delete restrict;

alter table public.unit_conversions
  add constraint fk_unit_conversions_to_tenant
  foreign key (to_unit_id, tenant_id)
  references public.units(id, tenant_id)
  on delete restrict;

alter table public.product_categories
  add constraint fk_product_categories_parent_tenant
  foreign key (parent_id, tenant_id)
  references public.product_categories(id, tenant_id)
  on delete restrict;

alter table public.expense_categories
  add constraint fk_expense_categories_parent_tenant
  foreign key (parent_id, tenant_id)
  references public.expense_categories(id, tenant_id)
  on delete restrict;

alter table public.audit_logs
  add constraint chk_audit_site_requires_tenant
  check (site_id is null or tenant_id is not null);

alter table public.audit_logs
  add constraint fk_audit_logs_site_tenant
  foreign key (site_id, tenant_id)
  references public.sites(id, tenant_id)
  on delete restrict;

-- ---------------------------------------------------------
-- TENANT IDs FOR AUTHORIZATION JOIN TABLES
-- ---------------------------------------------------------

alter table public.membership_sites
  add column tenant_id uuid not null
  references public.tenants(id) on delete cascade;

alter table public.membership_warehouse_access
  add column tenant_id uuid not null
  references public.tenants(id) on delete cascade;

alter table public.role_capabilities
  add column tenant_id uuid not null
  references public.tenants(id) on delete cascade;

alter table public.role_assignments
  add column tenant_id uuid not null
  references public.tenants(id) on delete cascade;

alter table public.membership_sites
  add constraint fk_membership_sites_membership_tenant
  foreign key (membership_id, tenant_id)
  references public.tenant_memberships(id, tenant_id)
  on delete cascade;

alter table public.membership_sites
  add constraint fk_membership_sites_site_tenant
  foreign key (site_id, tenant_id)
  references public.sites(id, tenant_id)
  on delete cascade;

alter table public.membership_warehouse_access
  add constraint fk_membership_warehouse_membership_tenant
  foreign key (membership_id, tenant_id)
  references public.tenant_memberships(id, tenant_id)
  on delete cascade;

alter table public.membership_warehouse_access
  add constraint fk_membership_warehouse_warehouse_tenant
  foreign key (warehouse_id, tenant_id)
  references public.warehouses(id, tenant_id)
  on delete cascade;

alter table public.role_capabilities
  add constraint fk_role_capabilities_role_tenant
  foreign key (role_id, tenant_id)
  references public.roles(id, tenant_id)
  on delete cascade;

alter table public.role_assignments
  add constraint fk_role_assignments_membership_tenant
  foreign key (membership_id, tenant_id)
  references public.tenant_memberships(id, tenant_id)
  on delete cascade;

alter table public.role_assignments
  add constraint fk_role_assignments_role_tenant
  foreign key (role_id, tenant_id)
  references public.roles(id, tenant_id)
  on delete cascade;

alter table public.role_assignments
  add constraint fk_role_assignments_site_tenant
  foreign key (site_id, tenant_id)
  references public.sites(id, tenant_id)
  on delete cascade;

-- Capability must belong to a known MAVORA module when module_code is set.
alter table public.capabilities
  add constraint fk_capabilities_module
  foreign key (module_code)
  references public.platform_modules(code)
  on delete restrict;

-- Prevent duplicate role assignment, including tenant-wide NULL site scope.
create unique index uq_role_assignments_scope
  on public.role_assignments (membership_id, role_id, site_id)
  nulls not distinct;

-- ---------------------------------------------------------
-- UPDATED_AT DATABASE TRIGGER
-- ---------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger trg_tenants_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

create trigger trg_tenant_settings_updated_at
before update on public.tenant_settings
for each row execute function public.set_updated_at();

create trigger trg_tenant_modules_updated_at
before update on public.tenant_modules
for each row execute function public.set_updated_at();

create trigger trg_sites_updated_at
before update on public.sites
for each row execute function public.set_updated_at();

create trigger trg_departments_updated_at
before update on public.departments
for each row execute function public.set_updated_at();

create trigger trg_positions_updated_at
before update on public.positions
for each row execute function public.set_updated_at();

create trigger trg_warehouses_updated_at
before update on public.warehouses
for each row execute function public.set_updated_at();

create trigger trg_work_centers_updated_at
before update on public.work_centers
for each row execute function public.set_updated_at();

create trigger trg_production_lines_updated_at
before update on public.production_lines
for each row execute function public.set_updated_at();

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger trg_tenant_memberships_updated_at
before update on public.tenant_memberships
for each row execute function public.set_updated_at();

create trigger trg_roles_updated_at
before update on public.roles
for each row execute function public.set_updated_at();

create trigger trg_units_updated_at
before update on public.units
for each row execute function public.set_updated_at();

create trigger trg_product_categories_updated_at
before update on public.product_categories
for each row execute function public.set_updated_at();

create trigger trg_expense_categories_updated_at
before update on public.expense_categories
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- TENANT / RLS PERFORMANCE INDEXES
-- ---------------------------------------------------------

create index if not exists idx_tenant_modules_tenant
  on public.tenant_modules(tenant_id);

create index if not exists idx_departments_tenant
  on public.departments(tenant_id);

create index if not exists idx_positions_tenant
  on public.positions(tenant_id);

create index if not exists idx_warehouses_tenant
  on public.warehouses(tenant_id);

create index if not exists idx_work_centers_tenant
  on public.work_centers(tenant_id);

create index if not exists idx_production_lines_tenant
  on public.production_lines(tenant_id);

create index if not exists idx_membership_sites_tenant
  on public.membership_sites(tenant_id);

create index if not exists idx_membership_warehouse_tenant
  on public.membership_warehouse_access(tenant_id);

create index if not exists idx_role_capabilities_tenant
  on public.role_capabilities(tenant_id);

create index if not exists idx_role_assignments_tenant
  on public.role_assignments(tenant_id);

create index if not exists idx_units_tenant
  on public.units(tenant_id);

create index if not exists idx_unit_conversions_tenant
  on public.unit_conversions(tenant_id);

create index if not exists idx_product_categories_tenant
  on public.product_categories(tenant_id);

create index if not exists idx_expense_categories_tenant
  on public.expense_categories(tenant_id);

-- ---------------------------------------------------------
-- RLS: DENY-BY-DEFAULT SECURITY BASELINE
-- No policies are created here.
-- Therefore browser anon/authenticated access remains blocked until
-- the reviewed authorization migration is applied.
-- ---------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.platform_modules enable row level security;
alter table public.tenant_modules enable row level security;
alter table public.sites enable row level security;
alter table public.departments enable row level security;
alter table public.positions enable row level security;
alter table public.warehouses enable row level security;
alter table public.work_centers enable row level security;
alter table public.production_lines enable row level security;
alter table public.profiles enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.membership_sites enable row level security;
alter table public.membership_warehouse_access enable row level security;
alter table public.roles enable row level security;
alter table public.capabilities enable row level security;
alter table public.role_capabilities enable row level security;
alter table public.role_assignments enable row level security;
alter table public.units enable row level security;
alter table public.unit_conversions enable row level security;
alter table public.product_categories enable row level security;
alter table public.expense_categories enable row level security;
alter table public.audit_logs enable row level security;

-- End of MAVORA Foundation Schema v1.
