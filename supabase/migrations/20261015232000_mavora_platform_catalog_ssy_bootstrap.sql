-- MAVORA Manufacturing ERP
-- Migration 005
-- Platform catalog + first pilot tenant bootstrap
-- No Auth user is created in this migration.

-- =========================================================
-- 1. PLATFORM MODULE CATALOG
-- =========================================================

insert into public.platform_modules
  (code, name, description, is_active)
values
  ('platform',    'Platform Administration', 'Tenant, user, role and platform settings', true),
  ('masterdata',  'Master Data',             'Shared manufacturing master data', true),
  ('production',  'Production',              'Production planning and factory operations', true),
  ('quality',     'Quality',                 'QC, QA, traceability and CAPA', true),
  ('inventory',   'Inventory',               'Warehouse and stock management', true),
  ('maintenance', 'Maintenance',             'Machine maintenance, repair and CMMS', true),
  ('procurement', 'Procurement',             'Purchasing and supplier processes', true),
  ('finance',     'Finance',                 'Finance and manufacturing cost controls', true),
  ('hr',          'Human Resources',         'Employees, attendance and workforce controls', true),
  ('workspace',   'Workspace',               'Internal collaboration and operational workspace', true),
  ('reporting',   'Reporting',               'Operational and management reporting', true),
  ('audit',       'Audit & Compliance',      'Audit trails and compliance visibility', true)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;

-- =========================================================
-- 2. FOUNDATION CAPABILITIES
-- =========================================================

insert into public.capabilities
  (code, module_code, action, description, risk_level, is_active)
values
  ('settings.manage',
   'platform',
   'manage',
   'Manage tenant and platform configuration',
   'critical',
   true),

  ('users.view',
   'platform',
   'view',
   'View tenant users and memberships',
   'standard',
   true),

  ('users.manage',
   'platform',
   'manage',
   'Manage tenant users and memberships',
   'critical',
   true),

  ('roles.manage',
   'platform',
   'manage',
   'Manage roles, permissions and assignments',
   'critical',
   true),

  ('masterdata.manage',
   'masterdata',
   'manage',
   'Manage shared tenant master data',
   'high',
   true),

  ('inventory.master_manage',
   'inventory',
   'master_manage',
   'Manage warehouses and inventory master structure',
   'high',
   true),

  ('production.master_manage',
   'production',
   'master_manage',
   'Manage work centers and production lines',
   'high',
   true),

  ('audit.view',
   'audit',
   'view',
   'View authorized audit records',
   'high',
   true)
on conflict (code) do update
set
  module_code = excluded.module_code,
  action = excluded.action,
  description = excluded.description,
  risk_level = excluded.risk_level,
  is_active = excluded.is_active;

-- =========================================================
-- 3. FIRST ORGANIZATION — MRS GROUP
-- =========================================================

insert into public.organizations
  (code, name, legal_name, status)
values
  ('MRS', 'MRS Group', null, 'active')
on conflict (code) do update
set
  name = excluded.name,
  status = excluded.status;

-- =========================================================
-- 4. FIRST PILOT TENANT — SAT SAT YO
-- =========================================================

insert into public.tenants
  (
    organization_id,
    code,
    slug,
    name,
    legal_name,
    country_code,
    currency_code,
    timezone,
    status
  )
select
  o.id,
  'SSY',
  'sat-sat-yo',
  'Sat Sat Yo',
  null,
  'MM',
  'MMK',
  'Asia/Yangon',
  'active'
from public.organizations o
where o.code = 'MRS'
on conflict (slug) do update
set
  organization_id = excluded.organization_id,
  code = excluded.code,
  name = excluded.name,
  country_code = excluded.country_code,
  currency_code = excluded.currency_code,
  timezone = excluded.timezone,
  status = excluded.status;

-- =========================================================
-- 5. TENANT SETTINGS
-- =========================================================

insert into public.tenant_settings
  (
    tenant_id,
    company_short_name,
    default_language,
    currency_code,
    date_format,
    invoice_prefix
  )
select
  t.id,
  'Sat Sat Yo',
  'my',
  'MMK',
  'DD/MM/YYYY',
  'SSY'
from public.tenants t
where t.slug = 'sat-sat-yo'
on conflict (tenant_id) do update
set
  company_short_name = excluded.company_short_name,
  default_language = excluded.default_language,
  currency_code = excluded.currency_code,
  date_format = excluded.date_format,
  invoice_prefix = excluded.invoice_prefix;

-- =========================================================
-- 6. FIRST SITE — MANDALAY FACTORY
-- =========================================================

insert into public.sites
  (
    tenant_id,
    code,
    name,
    site_type,
    timezone,
    is_active
  )
select
  t.id,
  'MDY-FACTORY',
  'Mandalay Factory',
  'factory',
  'Asia/Yangon',
  true
from public.tenants t
where t.slug = 'sat-sat-yo'
on conflict (tenant_id, code) do update
set
  name = excluded.name,
  site_type = excluded.site_type,
  timezone = excluded.timezone,
  is_active = excluded.is_active;

-- =========================================================
-- 7. ENABLE PLATFORM MODULES FOR FIRST TENANT
-- =========================================================

insert into public.tenant_modules
  (tenant_id, module_code, is_enabled, config)
select
  t.id,
  pm.code,
  true,
  '{}'::jsonb
from public.tenants t
cross join public.platform_modules pm
where t.slug = 'sat-sat-yo'
  and pm.is_active = true
on conflict (tenant_id, module_code) do update
set
  is_enabled = excluded.is_enabled;

-- =========================================================
-- 8. FOUNDATION OWNER ROLE
-- =========================================================

insert into public.roles
  (
    tenant_id,
    code,
    name,
    description,
    is_system_seed,
    is_active
  )
select
  t.id,
  'OWNER',
  'Owner / Managing Director',
  'Tenant owner role with full current foundation capabilities',
  true,
  true
from public.tenants t
where t.slug = 'sat-sat-yo'
on conflict (tenant_id, code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_system_seed = excluded.is_system_seed,
  is_active = excluded.is_active;

-- =========================================================
-- 9. OWNER ROLE -> FOUNDATION CAPABILITIES
-- =========================================================

insert into public.role_capabilities
  (role_id, capability_code, tenant_id)
select
  r.id,
  c.code,
  r.tenant_id
from public.roles r
join public.tenants t
  on t.id = r.tenant_id
cross join public.capabilities c
where t.slug = 'sat-sat-yo'
  and r.code = 'OWNER'
  and c.code in (
    'settings.manage',
    'users.view',
    'users.manage',
    'roles.manage',
    'masterdata.manage',
    'inventory.master_manage',
    'production.master_manage',
    'audit.view'
  )
on conflict (role_id, capability_code) do update
set tenant_id = excluded.tenant_id;

