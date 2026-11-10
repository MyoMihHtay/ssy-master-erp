
-- =========================================================
-- MAVORA ERP
-- Phase 10D — Standard Organization Roles / JD Foundation
--
-- Existing departments / positions / roles remain intact.
--
-- Foundation:
--   Department
--      -> Position
--      -> Job Profile / Reporting Line
--      -> Duties & Responsibilities
--      -> System Role
--      -> Role Capabilities
--      -> Employee Position Assignment
--
-- Tenant OWNER and MAVORA Platform Administrator remain
-- separate security concepts.
-- =========================================================


-- =========================================================
-- 1. POSITION TENANT COMPOSITE IDENTITY
-- =========================================================

alter table public.positions
add constraint uq_positions_id_tenant
unique (
  id,
  tenant_id
);


-- =========================================================
-- 2. JOB POSITION PROFILE
-- =========================================================

create table public.job_position_profiles (
  position_id uuid primary key,

  tenant_id uuid not null,

  role_id uuid not null,

  reports_to_position_id uuid,

  level_code text not null,

  job_description text not null,

  approval_level integer
    not null
    default 0,

  scope_type text
    not null
    default 'self',

  metadata jsonb
    not null
    default '{}'::jsonb,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint job_position_profiles_position_tenant_fkey
    foreign key (
      position_id,
      tenant_id
    )
    references public.positions (
      id,
      tenant_id
    )
    on delete cascade,

  constraint job_position_profiles_role_tenant_fkey
    foreign key (
      role_id,
      tenant_id
    )
    references public.roles (
      id,
      tenant_id
    )
    on delete restrict,

  constraint job_position_profiles_reports_to_tenant_fkey
    foreign key (
      reports_to_position_id,
      tenant_id
    )
    references public.positions (
      id,
      tenant_id
    )
    on delete restrict,

  constraint job_position_profiles_level_check
    check (
      level_code in (
        'executive',
        'manager',
        'supervisor',
        'officer',
        'staff',
        'system'
      )
    ),

  constraint job_position_profiles_approval_check
    check (
      approval_level between 0 and 100
    ),

  constraint job_position_profiles_scope_check
    check (
      scope_type in (
        'tenant',
        'department',
        'team',
        'self'
      )
    ),

  constraint job_position_profiles_reporting_check
    check (
      reports_to_position_id is null
      or reports_to_position_id <> position_id
    )
);


create index
job_position_profiles_tenant_idx
on public.job_position_profiles (
  tenant_id
);


create index
job_position_profiles_role_idx
on public.job_position_profiles (
  role_id
);


create index
job_position_profiles_reports_to_idx
on public.job_position_profiles (
  reports_to_position_id
);


-- =========================================================
-- 3. POSITION DUTIES & RESPONSIBILITIES
-- =========================================================

create table public.job_position_duties (
  id uuid primary key
    default gen_random_uuid(),

  tenant_id uuid not null,

  position_id uuid not null,

  duty_order integer
    not null,

  duty_text text
    not null,

  is_critical boolean
    not null
    default false,

  is_active boolean
    not null
    default true,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint job_position_duties_position_tenant_fkey
    foreign key (
      position_id,
      tenant_id
    )
    references public.positions (
      id,
      tenant_id
    )
    on delete cascade,

  constraint job_position_duties_order_check
    check (
      duty_order > 0
    ),

  constraint job_position_duties_text_check
    check (
      length(
        btrim(
          duty_text
        )
      ) between 3 and 2000
    ),

  constraint job_position_duties_position_order_key
    unique (
      position_id,
      duty_order
    )
);


create index
job_position_duties_tenant_idx
on public.job_position_duties (
  tenant_id
);


-- =========================================================
-- 4. EMPLOYEE / MEMBERSHIP POSITION ASSIGNMENT
-- =========================================================

create table public.membership_position_assignments (
  id uuid primary key
    default gen_random_uuid(),

  tenant_id uuid not null,

  membership_id uuid not null,

  position_id uuid not null,

  is_primary boolean
    not null
    default true,

  status text
    not null
    default 'active',

  starts_at timestamptz
    not null
    default now(),

  ends_at timestamptz,

  assigned_by uuid
    references auth.users(id)
    on delete set null,

  note text,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint membership_position_assignments_membership_tenant_fkey
    foreign key (
      membership_id,
      tenant_id
    )
    references public.tenant_memberships (
      id,
      tenant_id
    )
    on delete cascade,

  constraint membership_position_assignments_position_tenant_fkey
    foreign key (
      position_id,
      tenant_id
    )
    references public.positions (
      id,
      tenant_id
    )
    on delete restrict,

  constraint membership_position_assignments_status_check
    check (
      status in (
        'active',
        'inactive'
      )
    ),

  constraint membership_position_assignments_date_check
    check (
      ends_at is null
      or ends_at > starts_at
    ),

  constraint membership_position_assignments_note_check
    check (
      note is null
      or length(note) <= 2000
    )
);


create unique index
membership_position_assignments_primary_uidx
on public.membership_position_assignments (
  membership_id
)
where
  is_primary = true
  and status = 'active'
  and ends_at is null;


create index
membership_position_assignments_tenant_idx
on public.membership_position_assignments (
  tenant_id
);


create index
membership_position_assignments_position_idx
on public.membership_position_assignments (
  position_id
);


create index
membership_position_assignments_assigned_by_idx
on public.membership_position_assignments (
  assigned_by
);


-- =========================================================
-- 5. RLS
-- =========================================================

alter table public.job_position_profiles
enable row level security;

alter table public.job_position_duties
enable row level security;

alter table public.membership_position_assignments
enable row level security;


revoke all
on table
  public.job_position_profiles,
  public.job_position_duties,
  public.membership_position_assignments
from public, anon;


grant
  select,
  insert,
  update,
  delete
on table
  public.job_position_profiles,
  public.job_position_duties,
  public.membership_position_assignments
to authenticated;


grant all
on table
  public.job_position_profiles,
  public.job_position_duties,
  public.membership_position_assignments
to service_role;


create policy
job_position_profiles_select_member
on public.job_position_profiles
for select
to authenticated
using (
  app_private.is_tenant_member(
    tenant_id
  )
);


create policy
job_position_profiles_insert_manager
on public.job_position_profiles
for insert
to authenticated
with check (
  app_private.has_capability(
    tenant_id,
    'settings.manage',
    null
  )
);


create policy
job_position_profiles_update_manager
on public.job_position_profiles
for update
to authenticated
using (
  app_private.has_capability(
    tenant_id,
    'settings.manage',
    null
  )
)
with check (
  app_private.has_capability(
    tenant_id,
    'settings.manage',
    null
  )
);


create policy
job_position_profiles_delete_manager
on public.job_position_profiles
for delete
to authenticated
using (
  app_private.has_capability(
    tenant_id,
    'settings.manage',
    null
  )
);


create policy
job_position_duties_select_member
on public.job_position_duties
for select
to authenticated
using (
  app_private.is_tenant_member(
    tenant_id
  )
);


create policy
job_position_duties_insert_manager
on public.job_position_duties
for insert
to authenticated
with check (
  app_private.has_capability(
    tenant_id,
    'settings.manage',
    null
  )
);


create policy
job_position_duties_update_manager
on public.job_position_duties
for update
to authenticated
using (
  app_private.has_capability(
    tenant_id,
    'settings.manage',
    null
  )
)
with check (
  app_private.has_capability(
    tenant_id,
    'settings.manage',
    null
  )
);


create policy
job_position_duties_delete_manager
on public.job_position_duties
for delete
to authenticated
using (
  app_private.has_capability(
    tenant_id,
    'settings.manage',
    null
  )
);


create policy
membership_position_assignments_select_allowed
on public.membership_position_assignments
for select
to authenticated
using (
  app_private.can_view_membership(
    membership_id
  )
);


create policy
membership_position_assignments_insert_manager
on public.membership_position_assignments
for insert
to authenticated
with check (
  app_private.has_capability(
    tenant_id,
    'users.manage',
    null
  )
);


create policy
membership_position_assignments_update_manager
on public.membership_position_assignments
for update
to authenticated
using (
  app_private.has_capability(
    tenant_id,
    'users.manage',
    null
  )
)
with check (
  app_private.has_capability(
    tenant_id,
    'users.manage',
    null
  )
);


create policy
membership_position_assignments_delete_manager
on public.membership_position_assignments
for delete
to authenticated
using (
  app_private.has_capability(
    tenant_id,
    'users.manage',
    null
  )
);


-- =========================================================
-- 6. STANDARD ORGANIZATION SEED
-- =========================================================

create or replace function
app_private.seed_standard_org_structure(
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_department_count integer;
  v_position_count integer;
  v_profile_count integer;
  v_duty_count integer;
begin

  if p_tenant_id is null then
    raise exception
      'Tenant is required';
  end if;


  if not exists (
    select 1
    from public.tenants t
    where t.id = p_tenant_id
  ) then
    raise exception
      'Tenant not found';
  end if;


  -- -------------------------------------------------------
  -- DEPARTMENTS
  -- -------------------------------------------------------

  insert into public.departments (
    tenant_id,
    site_id,
    parent_id,
    code,
    name,
    is_active
  )
  select
    p_tenant_id,
    null,
    null,
    v.code,
    v.name,
    true
  from (
    values
      ('MANAGEMENT',      'Management'),
      ('FINANCE',         'Finance'),
      ('HR_ADMIN',        'HR & Administration'),
      ('PROCUREMENT',     'Procurement'),
      ('WAREHOUSE',       'Warehouse & Inventory'),
      ('QUALITY_CONTROL', 'Quality Control'),
      ('PRODUCTION',      'Production'),
      ('SALES',           'Sales'),
      ('MAINTENANCE',     'Maintenance'),
      ('LOGISTICS',       'Logistics & Distribution')
  ) as v(
    code,
    name
  )
  on conflict (
    tenant_id,
    code
  )
  do nothing;


  -- -------------------------------------------------------
  -- STANDARD SYSTEM ROLES
  -- -------------------------------------------------------

  insert into public.roles (
    tenant_id,
    code,
    name,
    description,
    is_system_seed,
    is_active
  )
  select
    p_tenant_id,
    v.code,
    v.name,
    v.description,
    true,
    true
  from (
    values
      (
        'MD',
        'Managing Director',
        'Executive leadership and organization-wide management.'
      ),
      (
        'GENERAL_MANAGER',
        'General Manager',
        'Overall operational management across departments.'
      ),
      (
        'TENANT_ADMIN',
        'Tenant Administrator',
        'Tenant-level system administration and user access management.'
      ),
      (
        'FINANCE_MANAGER',
        'Finance Manager',
        'Financial control, receivables, payments and financial oversight.'
      ),
      (
        'FINANCE_OFFICER',
        'Finance Officer',
        'Operational finance processing and financial record control.'
      ),
      (
        'FINANCE_ASSISTANT_I',
        'Finance Assistant I',
        'Senior finance support and transaction preparation.'
      ),
      (
        'FINANCE_ASSISTANT_II',
        'Finance Assistant II',
        'Finance data entry and supporting documentation.'
      ),
      (
        'HR_ADMIN_MANAGER',
        'HR & Admin Manager',
        'Human resources and administration management.'
      ),
      (
        'HR_OFFICER',
        'HR Officer',
        'HR records and employee administration support.'
      ),
      (
        'PROCUREMENT_MANAGER',
        'Procurement Manager',
        'Procurement planning and supplier purchasing control.'
      ),
      (
        'PROCUREMENT_OFFICER',
        'Procurement Officer',
        'Purchasing documentation and procurement operations.'
      ),
      (
        'WAREHOUSE_MANAGER',
        'Warehouse Manager',
        'Warehouse, inventory and stock-control management.'
      ),
      (
        'WAREHOUSE_SUPERVISOR',
        'Warehouse Supervisor',
        'Daily warehouse operations and stock-movement supervision.'
      ),
      (
        'STOREKEEPER',
        'Storekeeper',
        'Physical stock custody, receipt and issue operations.'
      ),
      (
        'QC_MANAGER',
        'Quality Control Manager',
        'Quality policy and product quality-control management.'
      ),
      (
        'QC_SUPERVISOR',
        'QC Supervisor',
        'Quality inspection and disposition supervision.'
      ),
      (
        'QC_INSPECTOR',
        'QC Inspector',
        'Routine quality inspection and quality-record preparation.'
      ),
      (
        'SALES_MANAGER',
        'Sales Manager',
        'Sales strategy, pricing, customer and credit management.'
      ),
      (
        'SALES_SUPERVISOR',
        'Sales Supervisor',
        'Sales-team supervision and operational sales control.'
      ),
      (
        'SALES_REPRESENTATIVE',
        'Sales Representative',
        'Customer servicing and controlled sales execution.'
      ),
      (
        'PRODUCTION_MANAGER',
        'Production Manager',
        'Production planning, execution and manufacturing control.'
      ),
      (
        'PRODUCTION_SUPERVISOR',
        'Production Supervisor',
        'Production-floor supervision and production-order execution.'
      ),
      (
        'PRODUCTION_OPERATOR',
        'Production Operator',
        'Controlled production operations and production recording.'
      ),
      (
        'MAINTENANCE_MANAGER',
        'Maintenance Manager',
        'Plant and equipment maintenance management.'
      ),
      (
        'MAINTENANCE_SUPERVISOR',
        'Maintenance Supervisor',
        'Maintenance work supervision and equipment servicing.'
      ),
      (
        'MAINTENANCE_TECHNICIAN',
        'Maintenance Technician',
        'Machine inspection, repair and preventive maintenance.'
      ),
      (
        'LOGISTICS_SUPERVISOR',
        'Logistics & Distribution Supervisor',
        'Delivery, distribution and logistics supervision.'
      ),
      (
        'DRIVER_DELIVERY_STAFF',
        'Driver / Delivery Staff',
        'Controlled transport, delivery and proof-of-delivery duties.'
      )
  ) as v(
    code,
    name,
    description
  )
  on conflict (
    tenant_id,
    code
  )
  do nothing;


  -- -------------------------------------------------------
  -- STANDARD POSITIONS
  -- -------------------------------------------------------

  insert into public.positions (
    tenant_id,
    department_id,
    code,
    name,
    is_active
  )
  select
    p_tenant_id,
    d.id,
    v.code,
    v.name,
    true
  from (
    values
      ('MD',                     'Managing Director',                    'MANAGEMENT'),
      ('GENERAL_MANAGER',        'General Manager',                     'MANAGEMENT'),
      ('TENANT_ADMIN',           'Tenant Administrator',                'MANAGEMENT'),

      ('FINANCE_MANAGER',        'Finance Manager',                     'FINANCE'),
      ('FINANCE_OFFICER',        'Finance Officer',                     'FINANCE'),
      ('FINANCE_ASSISTANT_I',    'Finance Assistant I',                 'FINANCE'),
      ('FINANCE_ASSISTANT_II',   'Finance Assistant II',                'FINANCE'),

      ('HR_ADMIN_MANAGER',       'HR & Admin Manager',                  'HR_ADMIN'),
      ('HR_OFFICER',             'HR Officer',                          'HR_ADMIN'),

      ('PROCUREMENT_MANAGER',    'Procurement Manager',                 'PROCUREMENT'),
      ('PROCUREMENT_OFFICER',    'Procurement Officer',                 'PROCUREMENT'),

      ('WAREHOUSE_MANAGER',      'Warehouse Manager',                   'WAREHOUSE'),
      ('WAREHOUSE_SUPERVISOR',   'Warehouse Supervisor',                'WAREHOUSE'),
      ('STOREKEEPER',            'Storekeeper',                         'WAREHOUSE'),

      ('QC_MANAGER',             'Quality Control Manager',             'QUALITY_CONTROL'),
      ('QC_SUPERVISOR',          'QC Supervisor',                       'QUALITY_CONTROL'),
      ('QC_INSPECTOR',           'QC Inspector',                        'QUALITY_CONTROL'),

      ('SALES_MANAGER',          'Sales Manager',                       'SALES'),
      ('SALES_SUPERVISOR',       'Sales Supervisor',                    'SALES'),
      ('SALES_REPRESENTATIVE',   'Sales Representative',                'SALES'),

      ('PRODUCTION_MANAGER',     'Production Manager',                  'PRODUCTION'),
      ('PRODUCTION_SUPERVISOR',  'Production Supervisor',               'PRODUCTION'),
      ('PRODUCTION_OPERATOR',    'Production Operator',                 'PRODUCTION'),

      ('MAINTENANCE_MANAGER',    'Maintenance Manager',                 'MAINTENANCE'),
      ('MAINTENANCE_SUPERVISOR', 'Maintenance Supervisor',              'MAINTENANCE'),
      ('MAINTENANCE_TECHNICIAN', 'Maintenance Technician',              'MAINTENANCE'),

      ('LOGISTICS_SUPERVISOR',   'Logistics & Distribution Supervisor', 'LOGISTICS'),
      ('DRIVER_DELIVERY_STAFF',  'Driver / Delivery Staff',             'LOGISTICS')
  ) as v(
    code,
    name,
    department_code
  )
  join public.departments d
    on d.tenant_id = p_tenant_id
   and d.code = v.department_code
  on conflict (
    tenant_id,
    code
  )
  do nothing;


  -- -------------------------------------------------------
  -- JOB DESCRIPTION / REPORTING HIERARCHY
  -- -------------------------------------------------------

  insert into public.job_position_profiles (
    position_id,
    tenant_id,
    role_id,
    reports_to_position_id,
    level_code,
    job_description,
    approval_level,
    scope_type
  )
  select
    p.id,
    p_tenant_id,
    r.id,
    rp.id,
    v.level_code,
    v.job_description,
    v.approval_level,
    v.scope_type
  from (
    values
      (
        'MD', null, 'executive',
        'Lead the organization, approve strategic decisions and maintain overall business accountability.',
        100, 'tenant'
      ),
      (
        'GENERAL_MANAGER', 'MD', 'manager',
        'Manage cross-functional operations and execute management strategy across departments.',
        90, 'tenant'
      ),
      (
        'TENANT_ADMIN', 'MD', 'system',
        'Administer tenant users, security roles and approved MAVORA configuration.',
        95, 'tenant'
      ),

      (
        'FINANCE_MANAGER', 'GENERAL_MANAGER', 'manager',
        'Manage financial operations, receivables, payments, controls and management reporting.',
        80, 'department'
      ),
      (
        'FINANCE_OFFICER', 'FINANCE_MANAGER', 'officer',
        'Process and verify finance transactions and maintain supporting financial records.',
        50, 'department'
      ),
      (
        'FINANCE_ASSISTANT_I', 'FINANCE_OFFICER', 'officer',
        'Prepare finance transactions, reconciliations and supporting documentation.',
        30, 'self'
      ),
      (
        'FINANCE_ASSISTANT_II', 'FINANCE_OFFICER', 'staff',
        'Perform finance data entry, filing and transaction-document preparation.',
        20, 'self'
      ),

      (
        'HR_ADMIN_MANAGER', 'GENERAL_MANAGER', 'manager',
        'Manage human resources, employee administration and organizational records.',
        75, 'department'
      ),
      (
        'HR_OFFICER', 'HR_ADMIN_MANAGER', 'officer',
        'Maintain employee records and perform approved HR administration.',
        40, 'department'
      ),

      (
        'PROCUREMENT_MANAGER', 'GENERAL_MANAGER', 'manager',
        'Manage procurement planning, supplier coordination and purchasing control.',
        75, 'department'
      ),
      (
        'PROCUREMENT_OFFICER', 'PROCUREMENT_MANAGER', 'officer',
        'Prepare purchasing documents and coordinate approved procurement transactions.',
        40, 'department'
      ),

      (
        'WAREHOUSE_MANAGER', 'GENERAL_MANAGER', 'manager',
        'Manage warehouses, inventory controls, stock accuracy and physical custody.',
        80, 'department'
      ),
      (
        'WAREHOUSE_SUPERVISOR', 'WAREHOUSE_MANAGER', 'supervisor',
        'Supervise daily warehouse receiving, issue, transfer and stock-control activities.',
        55, 'team'
      ),
      (
        'STOREKEEPER', 'WAREHOUSE_SUPERVISOR', 'staff',
        'Maintain physical stock custody and execute authorized receipt and issue transactions.',
        25, 'self'
      ),

      (
        'QC_MANAGER', 'GENERAL_MANAGER', 'manager',
        'Manage quality-control standards, inspections and quality disposition authority.',
        80, 'department'
      ),
      (
        'QC_SUPERVISOR', 'QC_MANAGER', 'supervisor',
        'Supervise quality inspections and controlled product disposition activities.',
        55, 'team'
      ),
      (
        'QC_INSPECTOR', 'QC_SUPERVISOR', 'officer',
        'Perform approved quality inspections and maintain inspection records.',
        30, 'self'
      ),

      (
        'SALES_MANAGER', 'GENERAL_MANAGER', 'manager',
        'Manage sales strategy, pricing, customer relationships, credit controls and performance.',
        80, 'department'
      ),
      (
        'SALES_SUPERVISOR', 'SALES_MANAGER', 'supervisor',
        'Supervise sales representatives, customer activity and daily sales execution.',
        55, 'team'
      ),
      (
        'SALES_REPRESENTATIVE', 'SALES_SUPERVISOR', 'staff',
        'Serve assigned customers and execute authorized sales transactions.',
        25, 'self'
      ),

      (
        'PRODUCTION_MANAGER', 'GENERAL_MANAGER', 'manager',
        'Manage production planning, recipes, execution, costing and manufacturing performance.',
        80, 'department'
      ),
      (
        'PRODUCTION_SUPERVISOR', 'PRODUCTION_MANAGER', 'supervisor',
        'Supervise production orders, material consumption and production output.',
        55, 'team'
      ),
      (
        'PRODUCTION_OPERATOR', 'PRODUCTION_SUPERVISOR', 'staff',
        'Perform controlled production operations and record authorized production activity.',
        25, 'self'
      ),

      (
        'MAINTENANCE_MANAGER', 'GENERAL_MANAGER', 'manager',
        'Manage preventive maintenance, repairs and equipment reliability.',
        75, 'department'
      ),
      (
        'MAINTENANCE_SUPERVISOR', 'MAINTENANCE_MANAGER', 'supervisor',
        'Supervise maintenance schedules, repair work and technician activities.',
        50, 'team'
      ),
      (
        'MAINTENANCE_TECHNICIAN', 'MAINTENANCE_SUPERVISOR', 'staff',
        'Inspect, service and repair machinery and equipment according to approved procedures.',
        25, 'self'
      ),

      (
        'LOGISTICS_SUPERVISOR', 'GENERAL_MANAGER', 'supervisor',
        'Supervise transport, route execution, delivery and distribution activities.',
        50, 'team'
      ),
      (
        'DRIVER_DELIVERY_STAFF', 'LOGISTICS_SUPERVISOR', 'staff',
        'Execute authorized deliveries, vehicle movement and proof-of-delivery responsibilities.',
        20, 'self'
      )
  ) as v(
    code,
    reports_to_code,
    level_code,
    job_description,
    approval_level,
    scope_type
  )
  join public.positions p
    on p.tenant_id = p_tenant_id
   and p.code = v.code
  join public.roles r
    on r.tenant_id = p_tenant_id
   and r.code = v.code
  left join public.positions rp
    on rp.tenant_id = p_tenant_id
   and rp.code = v.reports_to_code
  on conflict (
    position_id
  )
  do nothing;


  -- -------------------------------------------------------
  -- DUTIES & RESPONSIBILITIES
  -- Two core duties are seeded per standard position.
  -- Tenant managers may add/edit additional duties later.
  -- -------------------------------------------------------

  insert into public.job_position_duties (
    tenant_id,
    position_id,
    duty_order,
    duty_text,
    is_critical
  )
  select
    p_tenant_id,
    p.id,
    v.duty_order,
    v.duty_text,
    v.is_critical
  from (
    values
      ('MD',1,'Approve organizational strategy, major policies and delegated authorities.',true),
      ('MD',2,'Review company-wide performance, risk and executive accountability.',true),

      ('GENERAL_MANAGER',1,'Coordinate department managers and ensure approved plans are executed.',true),
      ('GENERAL_MANAGER',2,'Review operational performance, exceptions and corrective actions.',true),

      ('TENANT_ADMIN',1,'Manage approved tenant users, roles and access assignments.',true),
      ('TENANT_ADMIN',2,'Maintain approved MAVORA tenant configuration without platform-level access.',true),

      ('FINANCE_MANAGER',1,'Review receivables, payments, reconciliations and finance controls.',true),
      ('FINANCE_MANAGER',2,'Prepare and review management financial information and exceptions.',true),

      ('FINANCE_OFFICER',1,'Verify financial documents and process authorized finance transactions.',false),
      ('FINANCE_OFFICER',2,'Maintain accurate finance records and reconciliation support.',false),

      ('FINANCE_ASSISTANT_I',1,'Prepare transaction documents and reconciliation schedules.',false),
      ('FINANCE_ASSISTANT_I',2,'Support Finance Officer with verified financial documentation.',false),

      ('FINANCE_ASSISTANT_II',1,'Enter approved finance data accurately and maintain supporting files.',false),
      ('FINANCE_ASSISTANT_II',2,'Prepare transaction documents for review by senior finance staff.',false),

      ('HR_ADMIN_MANAGER',1,'Maintain HR policies, staffing administration and employee records.',true),
      ('HR_ADMIN_MANAGER',2,'Review attendance, staffing and approved HR administrative actions.',false),

      ('HR_OFFICER',1,'Maintain employee records and approved HR documentation.',false),
      ('HR_OFFICER',2,'Support attendance, leave and employee administration processes.',false),

      ('PROCUREMENT_MANAGER',1,'Review procurement needs, suppliers and authorized purchasing plans.',true),
      ('PROCUREMENT_MANAGER',2,'Control procurement documentation and supplier performance.',false),

      ('PROCUREMENT_OFFICER',1,'Prepare purchase documentation according to approved requirements.',false),
      ('PROCUREMENT_OFFICER',2,'Coordinate supplier quotations, delivery and procurement records.',false),

      ('WAREHOUSE_MANAGER',1,'Maintain stock accuracy, warehouse controls and inventory accountability.',true),
      ('WAREHOUSE_MANAGER',2,'Review receipts, issues, transfers and inventory exceptions.',true),

      ('WAREHOUSE_SUPERVISOR',1,'Supervise receiving, issuing, transfer and stock-count operations.',true),
      ('WAREHOUSE_SUPERVISOR',2,'Verify warehouse documents and resolve daily stock discrepancies.',false),

      ('STOREKEEPER',1,'Receive, store and issue goods only against authorized documents.',true),
      ('STOREKEEPER',2,'Maintain accurate physical stock and supporting warehouse records.',true),

      ('QC_MANAGER',1,'Approve quality-control standards and controlled product dispositions.',true),
      ('QC_MANAGER',2,'Review inspection trends, nonconformance and corrective actions.',true),

      ('QC_SUPERVISOR',1,'Supervise inspections and verify quality-control records.',true),
      ('QC_SUPERVISOR',2,'Escalate quality exceptions and perform authorized dispositions.',true),

      ('QC_INSPECTOR',1,'Perform assigned inspections according to approved quality criteria.',false),
      ('QC_INSPECTOR',2,'Record inspection results accurately and report nonconformance.',true),

      ('SALES_MANAGER',1,'Manage sales targets, pricing controls, customer credit and performance.',true),
      ('SALES_MANAGER',2,'Review sales exceptions, returns and customer account performance.',true),

      ('SALES_SUPERVISOR',1,'Supervise sales representatives and daily route/customer execution.',false),
      ('SALES_SUPERVISOR',2,'Review sales transactions, returns and team performance.',true),

      ('SALES_REPRESENTATIVE',1,'Execute authorized sales and maintain accurate customer transactions.',false),
      ('SALES_REPRESENTATIVE',2,'Follow assigned routes and maintain customer service records.',false),

      ('PRODUCTION_MANAGER',1,'Approve and control production plans, recipes and manufacturing execution.',true),
      ('PRODUCTION_MANAGER',2,'Review yield, cost, wastage and production performance.',true),

      ('PRODUCTION_SUPERVISOR',1,'Supervise production orders, material use and output recording.',true),
      ('PRODUCTION_SUPERVISOR',2,'Verify production-floor compliance and production records.',true),

      ('PRODUCTION_OPERATOR',1,'Perform assigned production operations according to approved instructions.',false),
      ('PRODUCTION_OPERATOR',2,'Record material consumption and output accurately.',true),

      ('MAINTENANCE_MANAGER',1,'Plan preventive maintenance and control major repair activities.',true),
      ('MAINTENANCE_MANAGER',2,'Review equipment reliability, downtime and maintenance performance.',false),

      ('MAINTENANCE_SUPERVISOR',1,'Supervise maintenance schedules and technician work.',false),
      ('MAINTENANCE_SUPERVISOR',2,'Verify repair completion and maintenance documentation.',true),

      ('MAINTENANCE_TECHNICIAN',1,'Inspect, service and repair assigned machinery safely.',true),
      ('MAINTENANCE_TECHNICIAN',2,'Record completed maintenance and report unresolved faults.',false),

      ('LOGISTICS_SUPERVISOR',1,'Plan and supervise delivery, transport and distribution execution.',true),
      ('LOGISTICS_SUPERVISOR',2,'Review delivery completion, route exceptions and transport records.',false),

      ('DRIVER_DELIVERY_STAFF',1,'Deliver goods according to authorized delivery documents and routes.',true),
      ('DRIVER_DELIVERY_STAFF',2,'Maintain vehicle and proof-of-delivery records accurately.',false)
  ) as v(
    position_code,
    duty_order,
    duty_text,
    is_critical
  )
  join public.positions p
    on p.tenant_id = p_tenant_id
   and p.code = v.position_code
  on conflict (
    position_id,
    duty_order
  )
  do nothing;


  -- -------------------------------------------------------
  -- MD: all currently active tenant capabilities.
  -- -------------------------------------------------------

  insert into public.role_capabilities (
    role_id,
    capability_code,
    tenant_id
  )
  select
    r.id,
    c.code,
    p_tenant_id
  from public.roles r
  cross join public.capabilities c
  where r.tenant_id = p_tenant_id
    and r.code = 'MD'
    and c.is_active = true
  on conflict do nothing;


  -- -------------------------------------------------------
  -- GENERAL MANAGER:
  -- business capabilities but no tenant security administration.
  -- -------------------------------------------------------

  insert into public.role_capabilities (
    role_id,
    capability_code,
    tenant_id
  )
  select
    r.id,
    c.code,
    p_tenant_id
  from public.roles r
  cross join public.capabilities c
  where r.tenant_id = p_tenant_id
    and r.code = 'GENERAL_MANAGER'
    and c.is_active = true
    and (
      coalesce(
        c.module_code,
        ''
      ) <> 'platform'
      or c.code = 'users.view'
    )
  on conflict do nothing;


  -- -------------------------------------------------------
  -- STANDARD LEAST-PRIVILEGE ROLE CAPABILITY MATRIX
  -- Only capabilities already present in MAVORA are assigned.
  -- -------------------------------------------------------

  insert into public.role_capabilities (
    role_id,
    capability_code,
    tenant_id
  )
  select
    r.id,
    c.code,
    p_tenant_id
  from (
    values
      ('TENANT_ADMIN','roles.manage'),
      ('TENANT_ADMIN','settings.manage'),
      ('TENANT_ADMIN','users.manage'),
      ('TENANT_ADMIN','users.view'),
      ('TENANT_ADMIN','audit.view'),

      ('FINANCE_MANAGER','audit.view'),
      ('FINANCE_MANAGER','sales.view'),
      ('FINANCE_MANAGER','sales.customer_view'),
      ('FINANCE_MANAGER','sales.receivable_view'),
      ('FINANCE_MANAGER','sales.payment_post'),
      ('FINANCE_MANAGER','sales.credit_manage'),

      ('FINANCE_OFFICER','sales.view'),
      ('FINANCE_OFFICER','sales.customer_view'),
      ('FINANCE_OFFICER','sales.receivable_view'),
      ('FINANCE_OFFICER','sales.payment_post'),

      ('FINANCE_ASSISTANT_I','sales.view'),
      ('FINANCE_ASSISTANT_I','sales.customer_view'),
      ('FINANCE_ASSISTANT_I','sales.receivable_view'),

      ('FINANCE_ASSISTANT_II','sales.view'),
      ('FINANCE_ASSISTANT_II','sales.customer_view'),
      ('FINANCE_ASSISTANT_II','sales.receivable_view'),

      ('HR_ADMIN_MANAGER','users.view'),
      ('HR_OFFICER','users.view'),

      ('PROCUREMENT_MANAGER','inventory.view'),
      ('PROCUREMENT_OFFICER','inventory.view'),

      ('WAREHOUSE_MANAGER','audit.view'),
      ('WAREHOUSE_MANAGER','inventory.view'),
      ('WAREHOUSE_MANAGER','inventory.post'),
      ('WAREHOUSE_MANAGER','inventory.master_manage'),
      ('WAREHOUSE_MANAGER','inventory.lot_manage'),

      ('WAREHOUSE_SUPERVISOR','inventory.view'),
      ('WAREHOUSE_SUPERVISOR','inventory.post'),
      ('WAREHOUSE_SUPERVISOR','inventory.lot_manage'),

      ('STOREKEEPER','inventory.view'),
      ('STOREKEEPER','inventory.post'),

      ('QC_MANAGER','audit.view'),
      ('QC_MANAGER','inventory.view'),
      ('QC_MANAGER','quality.lot_disposition'),

      ('QC_SUPERVISOR','inventory.view'),
      ('QC_SUPERVISOR','quality.lot_disposition'),

      ('QC_INSPECTOR','inventory.view'),

      ('SALES_MANAGER','audit.view'),
      ('SALES_MANAGER','sales.view'),
      ('SALES_MANAGER','sales.execute'),
      ('SALES_MANAGER','sales.return'),
      ('SALES_MANAGER','sales.price_manage'),
      ('SALES_MANAGER','sales.customer_manage'),
      ('SALES_MANAGER','sales.customer_view'),
      ('SALES_MANAGER','sales.credit_manage'),
      ('SALES_MANAGER','sales.receivable_view'),
      ('SALES_MANAGER','sales.payment_post'),

      ('SALES_SUPERVISOR','sales.view'),
      ('SALES_SUPERVISOR','sales.execute'),
      ('SALES_SUPERVISOR','sales.return'),
      ('SALES_SUPERVISOR','sales.customer_manage'),
      ('SALES_SUPERVISOR','sales.customer_view'),
      ('SALES_SUPERVISOR','sales.receivable_view'),

      ('SALES_REPRESENTATIVE','sales.view'),
      ('SALES_REPRESENTATIVE','sales.execute'),
      ('SALES_REPRESENTATIVE','sales.customer_manage'),
      ('SALES_REPRESENTATIVE','sales.customer_view'),

      ('PRODUCTION_MANAGER','audit.view'),
      ('PRODUCTION_MANAGER','inventory.view'),
      ('PRODUCTION_MANAGER','production.master_manage'),
      ('PRODUCTION_MANAGER','production.recipe_manage'),
      ('PRODUCTION_MANAGER','production.order_manage'),
      ('PRODUCTION_MANAGER','production.execute'),
      ('PRODUCTION_MANAGER','production.cost_view'),
      ('PRODUCTION_MANAGER','production.cost_manage'),

      ('PRODUCTION_SUPERVISOR','inventory.view'),
      ('PRODUCTION_SUPERVISOR','production.recipe_manage'),
      ('PRODUCTION_SUPERVISOR','production.order_manage'),
      ('PRODUCTION_SUPERVISOR','production.execute'),
      ('PRODUCTION_SUPERVISOR','production.cost_view'),

      ('PRODUCTION_OPERATOR','inventory.view'),
      ('PRODUCTION_OPERATOR','production.execute'),

      ('MAINTENANCE_MANAGER','inventory.view'),
      ('MAINTENANCE_SUPERVISOR','inventory.view'),
      ('MAINTENANCE_TECHNICIAN','inventory.view'),

      ('LOGISTICS_SUPERVISOR','inventory.view'),
      ('LOGISTICS_SUPERVISOR','sales.view')
  ) as v(
    role_code,
    capability_code
  )
  join public.roles r
    on r.tenant_id = p_tenant_id
   and r.code = v.role_code
  join public.capabilities c
    on c.code = v.capability_code
   and c.is_active = true
  on conflict do nothing;


  select count(*)
  into v_department_count
  from public.departments d
  where d.tenant_id = p_tenant_id
    and d.code in (
      'MANAGEMENT',
      'FINANCE',
      'HR_ADMIN',
      'PROCUREMENT',
      'WAREHOUSE',
      'QUALITY_CONTROL',
      'PRODUCTION',
      'SALES',
      'MAINTENANCE',
      'LOGISTICS'
    );


  select count(*)
  into v_position_count
  from public.positions p
  where p.tenant_id = p_tenant_id
    and exists (
      select 1
      from public.job_position_profiles jpp
      where jpp.position_id = p.id
        and jpp.tenant_id = p_tenant_id
    );


  select count(*)
  into v_profile_count
  from public.job_position_profiles jpp
  where jpp.tenant_id = p_tenant_id;


  select count(*)
  into v_duty_count
  from public.job_position_duties jpd
  where jpd.tenant_id = p_tenant_id;


  return jsonb_build_object(
    'departments',
      v_department_count,

    'positions',
      v_position_count,

    'job_profiles',
      v_profile_count,

    'duties',
      v_duty_count
  );

end;
$function$;


revoke all
on function
app_private.seed_standard_org_structure(uuid)
from public, anon, authenticated;


grant execute
on function
app_private.seed_standard_org_structure(uuid)
to service_role;


-- =========================================================
-- 7. BOOTSTRAP EXISTING SAT SAT YO DEV TENANT
-- =========================================================
-- When this migration is eventually applied, the existing
-- pilot tenant receives the standard editable organization
-- structure. No user receives a new role assignment here.

do $bootstrap$
declare
  v_tenant_id uuid;
begin

  select t.id
  into v_tenant_id
  from public.tenants t
  where t.slug = 'sat-sat-yo'
  limit 1;


  if v_tenant_id is not null then

    perform
      app_private.seed_standard_org_structure(
        v_tenant_id
      );

  end if;

end;
$bootstrap$;


-- =========================================================
-- END PHASE 10D ROLE / JD FOUNDATION
-- =========================================================
