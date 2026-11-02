-- MAVORA Manufacturing ERP
-- Controlled Sales Foundation
--
-- Scope:
--   * Sales platform module
--   * Controlled Sales capabilities
--   * Price Lists / Product Prices
--   * Sales Orders / Sales Order Lines
--   * Lot / Batch inventory allocation trace
--   * OWNER bootstrap only
--   * No checkout RPC yet
--   * No return RPC yet
--   * No direct authenticated writes
--
-- IMPORTANT:
--   Sales inventory deduction will be introduced separately
--   through a controlled atomic RPC after this foundation is
--   compiled and security reviewed.


-- =========================================================
-- 1. SALES PLATFORM MODULE
-- =========================================================

insert into public.platform_modules (
  code,
  name,
  description,
  is_active
)
values (
  'sales',
  'Sales',
  'Controlled sales, pricing, invoicing and finished-goods issue',
  true
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;


-- =========================================================
-- 2. SALES CAPABILITIES
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
    'sales.view',
    'sales',
    'view',
    'View controlled sales records and sales pricing',
    'standard',
    true
  ),
  (
    'sales.price_manage',
    'sales',
    'price_manage',
    'Manage controlled sales price lists and product prices',
    'high',
    true
  ),
  (
    'sales.execute',
    'sales',
    'execute',
    'Execute controlled sales checkout and finished-goods issue',
    'critical',
    true
  ),
  (
    'sales.return',
    'sales',
    'return',
    'Execute controlled sales return workflow',
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


-- OWNER receives the new capabilities first.
-- Sales Rep / other roles are intentionally NOT broadened yet.

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
    'sales.view',
    'sales.price_manage',
    'sales.execute',
    'sales.return'
  )
where r.code = 'OWNER'
  and r.is_active = true
on conflict (role_id, capability_code)
do nothing;


-- =========================================================
-- 3. SALES PRICE LISTS
-- =========================================================

create table public.sales_price_lists (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete restrict,

  code text not null,
  name text not null,
  description text,

  currency_code text not null default 'MMK',

  is_default boolean not null default false,
  is_active boolean not null default true,

  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sales_price_lists_code_not_blank
    check (length(btrim(code)) > 0),

  constraint sales_price_lists_name_not_blank
    check (length(btrim(name)) > 0),

  constraint sales_price_lists_currency_not_blank
    check (length(btrim(currency_code)) > 0),

  constraint sales_price_lists_tenant_code_key
    unique (tenant_id, code),

  constraint sales_price_lists_id_tenant_key
    unique (id, tenant_id)
);

create unique index sales_price_lists_one_default_active_idx
on public.sales_price_lists (tenant_id)
where is_default = true
  and is_active = true;


-- =========================================================
-- 4. PRODUCT SALES PRICES
-- =========================================================

create table public.sales_product_prices (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,

  price_list_id uuid not null,
  product_id uuid not null,

  unit_price numeric(20,6) not null,

  min_quantity numeric(20,6) not null default 1,

  effective_from date not null default current_date,
  effective_to date,

  is_active boolean not null default true,

  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sales_product_prices_unit_price_check
    check (
      unit_price >= 0
      and unit_price <= 99999999999999.999999
    ),

  constraint sales_product_prices_min_quantity_check
    check (
      min_quantity > 0
      and min_quantity <= 99999999999999.999999
    ),

  constraint sales_product_prices_date_order_check
    check (
      effective_to is null
      or effective_to >= effective_from
    ),

  constraint fk_sales_product_prices_price_list
    foreign key (price_list_id, tenant_id)
    references public.sales_price_lists(id, tenant_id)
    on delete restrict,

  constraint fk_sales_product_prices_product
    foreign key (product_id, tenant_id)
    references public.products(id, tenant_id)
    on delete restrict,

  constraint sales_product_prices_id_tenant_key
    unique (id, tenant_id)
);

create index sales_product_prices_lookup_idx
on public.sales_product_prices (
  tenant_id,
  price_list_id,
  product_id,
  is_active
);

create unique index sales_product_prices_current_unique_idx
on public.sales_product_prices (
  tenant_id,
  price_list_id,
  product_id
)
where is_active = true
  and effective_to is null;


-- =========================================================
-- 5. SALES ORDERS
-- =========================================================

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete restrict,

  site_id uuid not null,
  warehouse_id uuid not null,

  price_list_id uuid,

  invoice_no text not null,
  posting_key text not null,

  customer_ref text,
  customer_name text not null,
  customer_phone text,
  customer_address text,

  payment_method text not null default 'CASH',
  credit_terms text,
  is_paid boolean not null default true,

  status text not null default 'posted',

  subtotal numeric(20,6) not null default 0,
  discount_amount numeric(20,6) not null default 0,
  tax_amount numeric(20,6) not null default 0,
  grand_total numeric(20,6) not null default 0,

  sold_at timestamptz not null default now(),

  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sales_orders_invoice_not_blank
    check (length(btrim(invoice_no)) > 0),

  constraint sales_orders_posting_key_not_blank
    check (length(btrim(posting_key)) > 0),

  constraint sales_orders_customer_name_not_blank
    check (length(btrim(customer_name)) > 0),

  constraint sales_orders_status_check
    check (
      status in (
        'draft',
        'posted',
        'partially_returned',
        'returned',
        'cancelled'
      )
    ),

  constraint sales_orders_amounts_check
    check (
      subtotal >= 0
      and discount_amount >= 0
      and tax_amount >= 0
      and grand_total >= 0
    ),

  constraint fk_sales_orders_site
    foreign key (site_id, tenant_id)
    references public.sites(id, tenant_id)
    on delete restrict,

  constraint fk_sales_orders_warehouse
    foreign key (
      warehouse_id,
      tenant_id,
      site_id
    )
    references public.warehouses(
      id,
      tenant_id,
      site_id
    )
    on delete restrict,

  constraint fk_sales_orders_price_list
    foreign key (price_list_id, tenant_id)
    references public.sales_price_lists(id, tenant_id)
    on delete restrict,

  constraint sales_orders_tenant_invoice_key
    unique (tenant_id, invoice_no),

  constraint sales_orders_tenant_posting_key_key
    unique (tenant_id, posting_key),

  constraint sales_orders_id_tenant_key
    unique (id, tenant_id)
);

create index sales_orders_tenant_sold_at_idx
on public.sales_orders (
  tenant_id,
  sold_at desc
);

create index sales_orders_site_status_idx
on public.sales_orders (
  tenant_id,
  site_id,
  status
);


-- =========================================================
-- 6. SALES ORDER LINES
-- =========================================================

create table public.sales_order_lines (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,

  sales_order_id uuid not null,
  product_id uuid not null,

  line_no integer not null,

  quantity numeric(20,6) not null,
  unit_price numeric(20,6) not null,

  discount_amount numeric(20,6) not null default 0,
  tax_amount numeric(20,6) not null default 0,

  line_total numeric(20,6) not null,

  cogs_total numeric(20,6),

  created_at timestamptz not null default now(),

  constraint sales_order_lines_line_no_check
    check (line_no > 0),

  constraint sales_order_lines_quantity_check
    check (
      quantity > 0
      and quantity <= 99999999999999.999999
    ),

  constraint sales_order_lines_unit_price_check
    check (
      unit_price >= 0
      and unit_price <= 99999999999999.999999
    ),

  constraint sales_order_lines_amounts_check
    check (
      discount_amount >= 0
      and tax_amount >= 0
      and line_total >= 0
      and (
        cogs_total is null
        or cogs_total >= 0
      )
    ),

  constraint fk_sales_order_lines_order
    foreign key (sales_order_id, tenant_id)
    references public.sales_orders(id, tenant_id)
    on delete restrict,

  constraint fk_sales_order_lines_product
    foreign key (product_id, tenant_id)
    references public.products(id, tenant_id)
    on delete restrict,

  constraint sales_order_lines_order_line_key
    unique (sales_order_id, line_no),

  constraint sales_order_lines_id_tenant_key
    unique (id, tenant_id)
);

create index sales_order_lines_product_idx
on public.sales_order_lines (
  tenant_id,
  product_id
);


-- =========================================================
-- 7. SALES INVENTORY ALLOCATIONS
-- =========================================================
--
-- One Sales line may consume more than one Lot / Batch.
-- This table preserves exact traceability for later Returns.

create table public.sales_inventory_allocations (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,

  sales_order_id uuid not null,
  sales_order_line_id uuid not null,

  warehouse_id uuid not null,
  product_id uuid not null,
  lot_id uuid,

  inventory_movement_id uuid,

  quantity numeric(20,6) not null,
  unit_cost numeric(20,6),
  cogs_amount numeric(20,6),

  created_at timestamptz not null default now(),

  constraint sales_inventory_allocations_quantity_check
    check (
      quantity > 0
      and quantity <= 99999999999999.999999
    ),

  constraint sales_inventory_allocations_cost_check
    check (
      unit_cost is null
      or unit_cost >= 0
    ),

  constraint sales_inventory_allocations_cogs_check
    check (
      cogs_amount is null
      or cogs_amount >= 0
    ),

  constraint fk_sales_inventory_allocations_order
    foreign key (sales_order_id, tenant_id)
    references public.sales_orders(id, tenant_id)
    on delete restrict,

  constraint fk_sales_inventory_allocations_line
    foreign key (sales_order_line_id, tenant_id)
    references public.sales_order_lines(id, tenant_id)
    on delete restrict,

  constraint fk_sales_inventory_allocations_warehouse
    foreign key (warehouse_id, tenant_id)
    references public.warehouses(id, tenant_id)
    on delete restrict,

  constraint fk_sales_inventory_allocations_product
    foreign key (product_id, tenant_id)
    references public.products(id, tenant_id)
    on delete restrict,

  constraint fk_sales_inventory_allocations_lot
    foreign key (lot_id, tenant_id, product_id)
    references public.inventory_lots(
      id,
      tenant_id,
      product_id
    )
    on delete restrict
);

create index sales_inventory_allocations_order_idx
on public.sales_inventory_allocations (
  tenant_id,
  sales_order_id
);

create index sales_inventory_allocations_lot_idx
on public.sales_inventory_allocations (
  tenant_id,
  product_id,
  lot_id
);


-- =========================================================
-- 8. RLS — DENY DIRECT CLIENT WRITES
-- =========================================================

alter table public.sales_price_lists
  enable row level security;

alter table public.sales_product_prices
  enable row level security;

alter table public.sales_orders
  enable row level security;

alter table public.sales_order_lines
  enable row level security;

alter table public.sales_inventory_allocations
  enable row level security;


-- No direct browser-table access in this foundation.
-- Later controlled RPCs will provide authorized read/write paths.

revoke all
on table public.sales_price_lists
from public, anon, authenticated;

revoke all
on table public.sales_product_prices
from public, anon, authenticated;

revoke all
on table public.sales_orders
from public, anon, authenticated;

revoke all
on table public.sales_order_lines
from public, anon, authenticated;

revoke all
on table public.sales_inventory_allocations
from public, anon, authenticated;


grant select, insert, update, delete
on table public.sales_price_lists
to service_role;

grant select, insert, update, delete
on table public.sales_product_prices
to service_role;

grant select, insert, update, delete
on table public.sales_orders
to service_role;

grant select, insert, update, delete
on table public.sales_order_lines
to service_role;

grant select, insert, update, delete
on table public.sales_inventory_allocations
to service_role;


-- =========================================================
-- 9. COMMENTS
-- =========================================================

comment on table public.sales_price_lists is
  'Controlled tenant sales price-list master. Direct authenticated writes are disabled.';

comment on table public.sales_product_prices is
  'Controlled product prices by tenant and price list. Direct authenticated writes are disabled.';

comment on table public.sales_orders is
  'Controlled Sales transaction header. Inventory deduction will be performed only through a later atomic Sales RPC.';

comment on table public.sales_order_lines is
  'Controlled Sales transaction lines with server-validated product and price snapshots.';

comment on table public.sales_inventory_allocations is
  'Traceability bridge between Sales lines and exact FG warehouse Lot/Batch inventory consumption.';
