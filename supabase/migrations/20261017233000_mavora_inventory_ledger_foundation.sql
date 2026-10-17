-- MAVORA Manufacturing ERP
-- Migration 006
-- Inventory / Warehouse Ledger Foundation
--
-- DEV foundation only.
-- Legacy production data is NOT modified by this migration.

-- =========================================================
-- 1. INVENTORY CAPABILITIES
-- =========================================================

insert into public.capabilities
  (
    code,
    module_code,
    action,
    description,
    risk_level,
    is_active
  )
values
  (
    'inventory.view',
    'inventory',
    'view',
    'View inventory balances, lots and movement history',
    'standard',
    true
  ),
  (
    'inventory.post',
    'inventory',
    'post',
    'Post authorized inventory movements through controlled ledger functions',
    'high',
    true
  )
on conflict (code) do update
set
  module_code = excluded.module_code,
  action = excluded.action,
  description = excluded.description,
  risk_level = excluded.risk_level,
  is_active = excluded.is_active;

-- =========================================================
-- 2. OWNER ROLE -> INVENTORY CAPABILITIES
-- =========================================================

insert into public.role_capabilities
  (
    role_id,
    capability_code,
    tenant_id
  )
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
    'inventory.view',
    'inventory.post'
  )
on conflict (role_id, capability_code) do update
set
  tenant_id = excluded.tenant_id;

-- =========================================================
-- 2A. WAREHOUSE / SITE COMPOSITE IDENTITY
-- =========================================================
-- Required so inventory movements cannot claim a site that
-- does not belong to the selected warehouse.

alter table public.warehouses
  add constraint uq_warehouses_id_tenant_site
  unique (id, tenant_id, site_id);

-- =========================================================
-- 3. PRODUCT MASTER
-- =========================================================

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete cascade,

  category_id uuid,
  base_unit_id uuid not null,

  sku text not null,
  barcode text,
  name text not null,
  description text,

  product_type text not null
    check (
      product_type in (
        'RM',
        'SFG',
        'FG',
        'PKG',
        'SPARE',
        'CONSUMABLE',
        'OTHER'
      )
    ),

  tracking_mode text not null default 'none'
    check (
      tracking_mode in (
        'none',
        'lot',
        'batch'
      )
    ),

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, sku),
  unique (id, tenant_id)
);

alter table public.products
  add constraint fk_products_category_tenant
  foreign key (category_id, tenant_id)
  references public.product_categories(id, tenant_id)
  on delete restrict;

alter table public.products
  add constraint fk_products_base_unit_tenant
  foreign key (base_unit_id, tenant_id)
  references public.units(id, tenant_id)
  on delete restrict;

create unique index if not exists uq_products_tenant_barcode
  on public.products (tenant_id, barcode)
  where barcode is not null;

create index if not exists idx_products_category_tenant
  on public.products (category_id, tenant_id);

create index if not exists idx_products_base_unit_tenant
  on public.products (base_unit_id, tenant_id);

create index if not exists idx_products_tenant_type_active
  on public.products (tenant_id, product_type, is_active);

-- =========================================================
-- 4. LOT / BATCH TRACEABILITY
-- =========================================================

create table if not exists public.inventory_lots (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete cascade,

  product_id uuid not null,

  lot_no text not null,
  batch_no text,

  manufactured_at date,
  expires_at date,

  status text not null default 'released'
    check (
      status in (
        'released',
        'quarantine',
        'blocked',
        'expired',
        'consumed'
      )
    ),

  notes text,

  constraint inventory_lots_date_order_check
    check (
      expires_at is null
      or manufactured_at is null
      or expires_at >= manufactured_at
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, product_id, lot_no),
  unique (id, tenant_id, product_id)
);

alter table public.inventory_lots
  add constraint fk_inventory_lots_product_tenant
  foreign key (product_id, tenant_id)
  references public.products(id, tenant_id)
  on delete restrict;

create index if not exists idx_inventory_lots_product_tenant
  on public.inventory_lots (product_id, tenant_id);

create index if not exists idx_inventory_lots_tenant_status
  on public.inventory_lots (tenant_id, status);

create index if not exists idx_inventory_lots_expiry
  on public.inventory_lots (tenant_id, expires_at)
  where expires_at is not null;

-- =========================================================
-- 5. CURRENT INVENTORY BALANCES
-- =========================================================
-- This is a snapshot/cache of the ledger state.
-- Clients do NOT receive direct INSERT / UPDATE / DELETE access.
-- Migration 007 will add controlled atomic posting functions.

create table if not exists public.inventory_balances (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete cascade,

  warehouse_id uuid not null,
  product_id uuid not null,
  lot_id uuid,

  quantity numeric(20,6) not null default 0
    check (quantity >= 0),

  reserved_quantity numeric(20,6) not null default 0
    check (reserved_quantity >= 0),

  average_unit_cost numeric(20,6)
    check (
      average_unit_cost is null
      or average_unit_cost >= 0
    ),

  constraint inventory_balances_reserved_not_exceed_quantity_check
    check (reserved_quantity <= quantity),

  updated_at timestamptz not null default now(),

  unique (id, tenant_id)
);

alter table public.inventory_balances
  add constraint fk_inventory_balances_warehouse_tenant
  foreign key (warehouse_id, tenant_id)
  references public.warehouses(id, tenant_id)
  on delete restrict;

alter table public.inventory_balances
  add constraint fk_inventory_balances_product_tenant
  foreign key (product_id, tenant_id)
  references public.products(id, tenant_id)
  on delete restrict;

alter table public.inventory_balances
  add constraint fk_inventory_balances_lot_product_tenant
  foreign key (lot_id, tenant_id, product_id)
  references public.inventory_lots(id, tenant_id, product_id)
  on delete restrict;

create unique index if not exists uq_inventory_balances_scope
  on public.inventory_balances (
    tenant_id,
    warehouse_id,
    product_id,
    coalesce(
      lot_id,
      '00000000-0000-0000-0000-000000000000'::uuid
    )
  );

create index if not exists idx_inventory_balances_warehouse_tenant
  on public.inventory_balances (warehouse_id, tenant_id);

create index if not exists idx_inventory_balances_product_tenant
  on public.inventory_balances (product_id, tenant_id);

create index if not exists idx_inventory_balances_lot_product_tenant
  on public.inventory_balances (
    lot_id,
    tenant_id,
    product_id
  )
  where lot_id is not null;

-- =========================================================
-- 6. APPEND-ONLY INVENTORY MOVEMENT LEDGER
-- =========================================================

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),

  movement_group_id uuid not null default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete cascade,

  site_id uuid not null,
  warehouse_id uuid not null,
  product_id uuid not null,
  lot_id uuid,

  movement_type text not null
    check (
      movement_type in (
        'opening',
        'receipt',
        'issue',
        'transfer_in',
        'transfer_out',
        'production_consume',
        'production_output',
        'adjustment_in',
        'adjustment_out',
        'return_in',
        'return_out',
        'qc_release',
        'wastage'
      )
    ),

  -- Signed quantity:
  -- positive = stock in
  -- negative = stock out
  quantity numeric(20,6) not null
    check (quantity <> 0),

  unit_cost numeric(20,6)
    check (
      unit_cost is null
      or unit_cost >= 0
    ),

  constraint inventory_movements_quantity_direction_check
    check (
      (
        movement_type in (
          'opening',
          'receipt',
          'transfer_in',
          'production_output',
          'adjustment_in',
          'return_in',
          'qc_release'
        )
        and quantity > 0
      )
      or
      (
        movement_type in (
          'issue',
          'transfer_out',
          'production_consume',
          'adjustment_out',
          'return_out',
          'wastage'
        )
        and quantity < 0
      )
    ),

  reference_type text,
  reference_id text,

  reason text,

  occurred_at timestamptz not null default now(),

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),

  unique (id, tenant_id)
);

alter table public.inventory_movements
  add constraint fk_inventory_movements_warehouse_site_tenant
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
  on delete restrict;

alter table public.inventory_movements
  add constraint fk_inventory_movements_product_tenant
  foreign key (product_id, tenant_id)
  references public.products(id, tenant_id)
  on delete restrict;

alter table public.inventory_movements
  add constraint fk_inventory_movements_lot_product_tenant
  foreign key (lot_id, tenant_id, product_id)
  references public.inventory_lots(id, tenant_id, product_id)
  on delete restrict;

create index if not exists idx_inventory_movements_group
  on public.inventory_movements (
    movement_group_id
  );

create index if not exists idx_inventory_movements_tenant_time
  on public.inventory_movements (
    tenant_id,
    occurred_at desc
  );

create index if not exists idx_inventory_movements_site_time
  on public.inventory_movements (
    site_id,
    tenant_id,
    occurred_at desc
  );

create index if not exists idx_inventory_movements_warehouse_time
  on public.inventory_movements (
    warehouse_id,
    tenant_id,
    site_id,
    occurred_at desc
  );

create index if not exists idx_inventory_movements_product_time
  on public.inventory_movements (
    product_id,
    tenant_id,
    occurred_at desc
  );

create index if not exists idx_inventory_movements_lot_time
  on public.inventory_movements (
    lot_id,
    tenant_id,
    product_id,
    occurred_at desc
  )
  where lot_id is not null;

create index if not exists idx_inventory_movements_created_by
  on public.inventory_movements (
    created_by
  );

-- =========================================================
-- 7. UPDATED_AT TRIGGERS
-- =========================================================

drop trigger if exists trg_products_set_updated_at
  on public.products;

create trigger trg_products_set_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

drop trigger if exists trg_inventory_lots_set_updated_at
  on public.inventory_lots;

create trigger trg_inventory_lots_set_updated_at
before update on public.inventory_lots
for each row
execute function public.set_updated_at();

drop trigger if exists trg_inventory_balances_set_updated_at
  on public.inventory_balances;

create trigger trg_inventory_balances_set_updated_at
before update on public.inventory_balances
for each row
execute function public.set_updated_at();

-- =========================================================
-- 8. ENABLE RLS
-- =========================================================

alter table public.products
  enable row level security;

alter table public.inventory_lots
  enable row level security;

alter table public.inventory_balances
  enable row level security;

alter table public.inventory_movements
  enable row level security;

-- =========================================================
-- 9. PRODUCT MASTER RLS
-- =========================================================

create policy products_select_member
on public.products
for select
to authenticated
using (
  app_private.is_tenant_member(tenant_id)
);

create policy products_insert_manager
on public.products
for insert
to authenticated
with check (
  app_private.has_capability(
    tenant_id,
    'masterdata.manage',
    null
  )
);

create policy products_update_manager
on public.products
for update
to authenticated
using (
  app_private.has_capability(
    tenant_id,
    'masterdata.manage',
    null
  )
)
with check (
  app_private.has_capability(
    tenant_id,
    'masterdata.manage',
    null
  )
);

-- No direct DELETE policy.
-- Deactivate products instead of deleting master records.

-- =========================================================
-- 10. LOT / BATCH RLS
-- =========================================================

create policy inventory_lots_select_member
on public.inventory_lots
for select
to authenticated
using (
  app_private.is_tenant_member(tenant_id)
);

create policy inventory_lots_insert_poster
on public.inventory_lots
for insert
to authenticated
with check (
  app_private.has_capability(
    tenant_id,
    'inventory.post',
    null
  )
);

create policy inventory_lots_update_poster
on public.inventory_lots
for update
to authenticated
using (
  app_private.has_capability(
    tenant_id,
    'inventory.post',
    null
  )
)
with check (
  app_private.has_capability(
    tenant_id,
    'inventory.post',
    null
  )
);

-- No direct DELETE policy.

-- =========================================================
-- 11. INVENTORY BALANCE RLS
-- =========================================================

create policy inventory_balances_select_scoped
on public.inventory_balances
for select
to authenticated
using (
  app_private.has_warehouse_access(warehouse_id)
);

-- Intentionally NO client INSERT / UPDATE / DELETE policies.
-- Balance changes must go through controlled posting functions.

-- =========================================================
-- 12. INVENTORY MOVEMENT RLS
-- =========================================================

create policy inventory_movements_select_scoped
on public.inventory_movements
for select
to authenticated
using (
  app_private.has_warehouse_access(warehouse_id)
);

-- Intentionally NO direct client INSERT / UPDATE / DELETE policies.
-- Migration 007 will provide SECURITY DEFINER posting functions.

-- =========================================================
-- 13. FIRST TENANT FOUNDATION UNITS
-- =========================================================

insert into public.units
  (
    tenant_id,
    code,
    name,
    symbol,
    unit_type,
    is_base_unit,
    is_active
  )
select
  t.id,
  seed.code,
  seed.name,
  seed.symbol,
  seed.unit_type,
  seed.is_base_unit,
  true
from public.tenants t
cross join (
  values
    ('PCS',  'Piece', 'pc',   'count',  true),
    ('PACK', 'Pack',  'pack', 'count',  false),
    ('KG',   'Kilogram', 'kg', 'weight', true),
    ('G',    'Gram', 'g',     'weight', false),
    ('VISS', 'Viss', 'ပိဿာ',  'weight', false),
    ('BOX',  'Box', 'box',    'count',  false)
) as seed (
  code,
  name,
  symbol,
  unit_type,
  is_base_unit
)
where t.slug = 'sat-sat-yo'
on conflict (tenant_id, code) do update
set
  name = excluded.name,
  symbol = excluded.symbol,
  unit_type = excluded.unit_type,
  is_base_unit = excluded.is_base_unit,
  is_active = excluded.is_active;

-- =========================================================
-- 14. FIRST TENANT PRODUCT CATEGORIES
-- =========================================================

insert into public.product_categories
  (
    tenant_id,
    code,
    name,
    category_type,
    is_active
  )
select
  t.id,
  seed.code,
  seed.name,
  seed.category_type,
  true
from public.tenants t
cross join (
  values
    ('RM',          'Raw Materials',       'RM'),
    ('SFG',         'Semi-Finished Goods', 'SFG'),
    ('PKG',         'Packaging Materials', 'PKG'),
    ('FG',          'Finished Goods',      'FG'),
    ('SPARE',       'Spare Parts',         'SPARE'),
    ('CONSUMABLE',  'Consumables',         'CONSUMABLE')
) as seed (
  code,
  name,
  category_type
)
where t.slug = 'sat-sat-yo'
on conflict (tenant_id, code) do update
set
  name = excluded.name,
  category_type = excluded.category_type,
  is_active = excluded.is_active;

-- =========================================================
-- 15. FIRST TENANT DEFAULT WAREHOUSES
-- =========================================================

insert into public.warehouses
  (
    tenant_id,
    site_id,
    code,
    name,
    warehouse_type,
    is_active
  )
select
  t.id,
  s.id,
  seed.code,
  seed.name,
  seed.warehouse_type,
  true
from public.tenants t
join public.sites s
  on s.tenant_id = t.id
 and s.code = 'MDY-FACTORY'
cross join (
  values
    ('RM',         'Raw Materials Warehouse',       'RM'),
    ('SFG',        'Semi-Finished Goods Warehouse', 'SFG'),
    ('PKG',        'Packaging Materials Warehouse', 'PKG'),
    ('FG',         'Finished Goods Warehouse',      'FG'),
    ('QUARANTINE', 'Quarantine Warehouse',          'QUARANTINE')
) as seed (
  code,
  name,
  warehouse_type
)
where t.slug = 'sat-sat-yo'
on conflict (tenant_id, site_id, code) do update
set
  name = excluded.name,
  warehouse_type = excluded.warehouse_type,
  is_active = excluded.is_active;

