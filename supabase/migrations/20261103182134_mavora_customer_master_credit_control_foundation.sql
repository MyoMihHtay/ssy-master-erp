-- =========================================================
-- MAVORA ERP
-- Customer Master + Credit Control Foundation
--
-- Phase 2P-6N-6D
--
-- Design boundaries:
--   * Customer Master is the current source of customer data.
--   * Sales Orders retain immutable customer snapshots.
--   * Historical Sales Orders are not backfilled automatically.
--   * Customer credit policy is stored on Customer Master.
--   * Outstanding Balance is NOT manually stored or editable.
--   * Outstanding Balance will later derive from:
--       Credit Sales
--       - Credit Notes / Returns
--       - Payments / Collections
--   * invoice_remark is customer-visible and invoice-specific.
--   * internal_note is staff/admin internal information.
--   * Checkout credit enforcement is intentionally out of scope
--     for this foundation migration.
-- =========================================================


-- =========================================================
-- 1. CUSTOMER / CREDIT CAPABILITIES
-- =========================================================

insert into public.capabilities (
  code,
  module_code,
  action,
  description,
  risk_level,
  is_active
)
values
  (
    'sales.customer_view',
    'sales',
    'customer_view',
    'View controlled Sales Customer Master records',
    'standard',
    true
  ),
  (
    'sales.customer_manage',
    'sales',
    'customer_manage',
    'Create and maintain controlled Sales Customer Master records',
    'high',
    true
  ),
  (
    'sales.credit_manage',
    'sales',
    'credit_manage',
    'Maintain customer credit policy including limit, days and hold',
    'critical',
    true
  )
on conflict (code) do update
set
  module_code = excluded.module_code,
  action = excluded.action,
  description = excluded.description,
  risk_level = excluded.risk_level,
  is_active = excluded.is_active;


-- OWNER receives the new Customer / Credit capabilities.
insert into public.role_capabilities (
  role_id,
  capability_code,
  tenant_id,
  created_at
)
select
  r.id,
  c.code,
  r.tenant_id,
  now()
from public.roles r
join public.capabilities c
  on c.code in (
    'sales.customer_view',
    'sales.customer_manage',
    'sales.credit_manage'
  )
where r.code = 'OWNER'
  and r.is_active = true
on conflict (role_id, capability_code)
do nothing;


-- =========================================================
-- 2. CUSTOMER MASTER
-- =========================================================

create table public.sales_customers (
  id uuid primary key
    default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete restrict,

  customer_code text not null,

  name text not null,

  phone text,

  address text,

  shop_type text,

  gps text,

  is_active boolean not null
    default true,

  -- -------------------------------------------------------
  -- CREDIT POLICY
  -- -------------------------------------------------------

  credit_enabled boolean not null
    default false,

  -- Maximum open credit permitted for this customer.
  -- Currency handling will follow the tenant Sales /
  -- Receivable accounting currency in the AR phase.
  credit_limit numeric(20,6) not null
    default 0,

  credit_days integer not null
    default 0,

  -- When true, new CREDIT Sales must later be rejected
  -- regardless of remaining credit limit.
  credit_hold boolean not null
    default false,

  -- Internal staff/admin note.
  -- This is not an Invoice Remark.
  internal_note text,

  created_by uuid
    references auth.users(id)
    on delete set null,

  updated_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint sales_customers_customer_code_not_blank
    check (
      length(btrim(customer_code)) > 0
    ),

  constraint sales_customers_customer_code_length
    check (
      length(btrim(customer_code)) <= 100
    ),

  constraint sales_customers_name_not_blank
    check (
      length(btrim(name)) > 0
    ),

  constraint sales_customers_name_length
    check (
      length(btrim(name)) <= 300
    ),

  constraint sales_customers_phone_length
    check (
      phone is null
      or length(btrim(phone)) <= 100
    ),

  constraint sales_customers_address_length
    check (
      address is null
      or length(address) <= 1000
    ),

  constraint sales_customers_shop_type_length
    check (
      shop_type is null
      or length(btrim(shop_type)) <= 120
    ),

  constraint sales_customers_gps_length
    check (
      gps is null
      or length(btrim(gps)) <= 255
    ),

  constraint sales_customers_credit_limit_check
    check (
      credit_limit >= 0
    ),

  constraint sales_customers_credit_days_check
    check (
      credit_days >= 0
      and credit_days <= 3650
    ),

  constraint sales_customers_internal_note_length
    check (
      internal_note is null
      or length(internal_note) <= 4000
    ),

  constraint sales_customers_id_tenant_key
    unique (id, tenant_id)
);


-- Customer Code is tenant-local and case-insensitive.
create unique index
sales_customers_tenant_customer_code_uq
on public.sales_customers (
  tenant_id,
  upper(btrim(customer_code))
);


create index
sales_customers_tenant_active_idx
on public.sales_customers (
  tenant_id,
  is_active
);


create index
sales_customers_tenant_name_idx
on public.sales_customers (
  tenant_id,
  lower(name)
);


create index
sales_customers_tenant_phone_idx
on public.sales_customers (
  tenant_id,
  phone
)
where phone is not null;


-- =========================================================
-- 3. UPDATED_AT CONTROL
-- =========================================================

create trigger trg_sales_customers_set_updated_at
before update
on public.sales_customers
for each row
execute function public.set_updated_at();


-- =========================================================
-- 4. SALES ORDER CUSTOMER LINK + INVOICE REMARK
-- =========================================================

alter table public.sales_orders
  add column customer_id uuid,
  add column invoice_remark text;


-- Tenant-aware Customer Master linkage.
--
-- Existing historical Sales Orders remain valid because
-- customer_id is nullable and snapshots are retained.
alter table public.sales_orders
  add constraint sales_orders_customer_tenant_fk
  foreign key (
    customer_id,
    tenant_id
  )
  references public.sales_customers (
    id,
    tenant_id
  )
  on delete restrict;


alter table public.sales_orders
  add constraint sales_orders_invoice_remark_length_check
  check (
    invoice_remark is null
    or length(invoice_remark) <= 500
  );


create index
sales_orders_tenant_customer_idx
on public.sales_orders (
  tenant_id,
  customer_id
)
where customer_id is not null;


-- =========================================================
-- 5. SECURITY BOUNDARY
-- =========================================================

alter table public.sales_customers
enable row level security;


-- Customer Master is controlled through RPC boundaries.
--
-- No direct anonymous/authenticated table mutation or read
-- is granted by this foundation migration.
revoke all
on table public.sales_customers
from public, anon, authenticated;


grant all
on table public.sales_customers
to service_role;


-- =========================================================
-- 6. COMMENTS / CONTRACT
-- =========================================================

comment on table public.sales_customers is
  'Controlled tenant-scoped Sales Customer Master. Stores current customer identity and credit policy. Outstanding Balance is intentionally not stored as an editable master value.';


comment on column public.sales_customers.customer_code is
  'Tenant-local Customer Code. Uniqueness is case-insensitive within one tenant.';


comment on column public.sales_customers.credit_enabled is
  'Whether this customer is eligible for CREDIT Sales. Checkout enforcement is added in a later controlled phase.';


comment on column public.sales_customers.credit_limit is
  'Maximum permitted open customer credit. Outstanding exposure is derived later from controlled AR transactions, not manually maintained here.';


comment on column public.sales_customers.credit_days is
  'Configured customer credit term in days.';


comment on column public.sales_customers.credit_hold is
  'Administrative credit hold. When true, later controlled checkout must reject new CREDIT Sales.';


comment on column public.sales_customers.internal_note is
  'Internal staff/admin Customer Master note. Not customer-facing and not intended for Invoice/PDF output.';


comment on column public.sales_orders.customer_id is
  'Optional tenant-safe link to current Sales Customer Master. Historical customer snapshot columns remain authoritative for the issued Sales Order / Invoice.';


comment on column public.sales_orders.invoice_remark is
  'Customer-visible Invoice-specific remark. Intended for Sales Invoice screen and Invoice/PDF output. Maximum 500 characters.';


-- =========================================================
-- END
-- =========================================================
