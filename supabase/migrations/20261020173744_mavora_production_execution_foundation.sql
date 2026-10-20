-- MAVORA Manufacturing ERP
-- Migration 014
-- Production Execution Foundation
--
-- Goals:
--   * Introduce immutable actual material-consumption traceability
--   * Introduce immutable actual production-output traceability
--   * Link Production execution records to Inventory ledger movements
--   * Prepare controlled Draft -> Released -> In Progress -> Completed lifecycle
--   * Preserve direct-client denial for execution writes
--   * No Release / Start / Consume / Complete RPC is introduced here
--   * No inventory posting occurs in this migration

-- =========================================================
-- 1. PRODUCTION ORDER LIFECYCLE ACTOR METADATA
-- =========================================================

alter table public.production_orders
  add column started_by uuid
    references auth.users(id)
    on delete set null;

alter table public.production_orders
  add column cancelled_at timestamptz;

alter table public.production_orders
  add column cancelled_by uuid
    references auth.users(id)
    on delete set null;


-- =========================================================
-- 2. STRONGER COMPOSITE IDENTITIES FOR EXECUTION FKs
-- =========================================================

alter table public.production_order_materials
  add constraint uq_production_order_materials_execution_scope
  unique (
    id,
    tenant_id,
    production_order_id,
    site_id,
    input_product_id,
    input_unit_id
  );

alter table public.production_orders
  add constraint uq_production_orders_execution_output_scope
  unique (
    id,
    tenant_id,
    site_id,
    output_product_id,
    output_unit_id
  );


-- =========================================================
-- 3. ACTUAL MATERIAL CONSUMPTION TRACEABILITY
-- =========================================================

create table public.production_order_material_consumptions (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete cascade,

  site_id uuid not null,

  production_order_id uuid not null,

  production_order_material_id uuid not null,

  warehouse_id uuid not null,

  input_product_id uuid not null,

  input_unit_id uuid not null,

  lot_id uuid,

  actual_qty numeric(18,6) not null
    check (actual_qty > 0),

  inventory_movement_id uuid not null,

  variance_reason text,

  created_by uuid
    default auth.uid()
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  constraint production_material_consumption_reason_check
    check (
      variance_reason is null
      or length(variance_reason) <= 2000
    ),

  constraint uq_production_material_consumption_movement
    unique (inventory_movement_id),

  constraint fk_production_material_consumption_order_scope
    foreign key (
      production_order_id,
      tenant_id,
      site_id
    )
    references public.production_orders(
      id,
      tenant_id,
      site_id
    )
    on delete restrict,

  constraint fk_production_material_consumption_material_scope
    foreign key (
      production_order_material_id,
      tenant_id,
      production_order_id,
      site_id,
      input_product_id,
      input_unit_id
    )
    references public.production_order_materials(
      id,
      tenant_id,
      production_order_id,
      site_id,
      input_product_id,
      input_unit_id
    )
    on delete restrict,

  constraint fk_production_material_consumption_warehouse_scope
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

  constraint fk_production_material_consumption_lot_scope
    foreign key (
      lot_id,
      tenant_id,
      input_product_id
    )
    references public.inventory_lots(
      id,
      tenant_id,
      product_id
    )
    on delete restrict,

  constraint fk_production_material_consumption_unit_scope
    foreign key (
      input_unit_id,
      tenant_id
    )
    references public.units(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_production_material_consumption_movement_scope
    foreign key (
      inventory_movement_id,
      tenant_id
    )
    references public.inventory_movements(
      id,
      tenant_id
    )
    on delete restrict
);


-- =========================================================
-- 4. ACTUAL PRODUCTION OUTPUT TRACEABILITY
-- =========================================================

create table public.production_order_outputs (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete cascade,

  site_id uuid not null,

  production_order_id uuid not null,

  warehouse_id uuid not null,

  output_product_id uuid not null,

  output_unit_id uuid not null,

  lot_id uuid,

  actual_qty numeric(18,6) not null
    check (actual_qty > 0),

  inventory_movement_id uuid not null,

  created_by uuid
    default auth.uid()
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  constraint uq_production_output_movement
    unique (inventory_movement_id),

  constraint fk_production_output_order_scope
    foreign key (
      production_order_id,
      tenant_id,
      site_id,
      output_product_id,
      output_unit_id
    )
    references public.production_orders(
      id,
      tenant_id,
      site_id,
      output_product_id,
      output_unit_id
    )
    on delete restrict,

  constraint fk_production_output_warehouse_scope
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

  constraint fk_production_output_lot_scope
    foreign key (
      lot_id,
      tenant_id,
      output_product_id
    )
    references public.inventory_lots(
      id,
      tenant_id,
      product_id
    )
    on delete restrict,

  constraint fk_production_output_unit_scope
    foreign key (
      output_unit_id,
      tenant_id
    )
    references public.units(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_production_output_movement_scope
    foreign key (
      inventory_movement_id,
      tenant_id
    )
    references public.inventory_movements(
      id,
      tenant_id
    )
    on delete restrict
);


-- =========================================================
-- 5. EXECUTION INDEXES
-- =========================================================

create index idx_production_material_consumptions_order
  on public.production_order_material_consumptions (
    production_order_id,
    created_at
  );

create index idx_production_material_consumptions_material
  on public.production_order_material_consumptions (
    production_order_material_id,
    created_at
  );

create index idx_production_material_consumptions_lot
  on public.production_order_material_consumptions (
    tenant_id,
    lot_id
  )
  where lot_id is not null;

create index idx_production_outputs_order
  on public.production_order_outputs (
    production_order_id,
    created_at
  );

create index idx_production_outputs_lot
  on public.production_order_outputs (
    tenant_id,
    lot_id
  )
  where lot_id is not null;


-- =========================================================
-- 6. IMMUTABLE EXECUTION RECORD GUARDS
-- =========================================================

create or replace function app_private.guard_production_execution_record_immutable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  raise exception
    'Production execution records are immutable';
end;
$function$;

revoke all
on function app_private.guard_production_execution_record_immutable()
from public, anon, authenticated;

grant execute
on function app_private.guard_production_execution_record_immutable()
to service_role;

create trigger trg_production_material_consumption_immutable
before update or delete
on public.production_order_material_consumptions
for each row
execute function app_private.guard_production_execution_record_immutable();

create trigger trg_production_output_immutable
before update or delete
on public.production_order_outputs
for each row
execute function app_private.guard_production_execution_record_immutable();


-- =========================================================
-- 7. EXECUTION INSERT INTEGRITY GUARDS
-- =========================================================

create or replace function app_private.guard_production_material_consumption_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_order_status text;
  v_tracking_mode text;
  v_base_unit_id uuid;
  v_lot_status text;
  v_movement public.inventory_movements%rowtype;
begin
  select po.status
  into v_order_status
  from public.production_orders po
  where po.id = new.production_order_id
    and po.tenant_id = new.tenant_id
    and po.site_id = new.site_id;

  if v_order_status <> 'in_progress' then
    raise exception
      'Material consumption requires an In Progress Production Order';
  end if;

  select
    p.tracking_mode,
    p.base_unit_id
  into
    v_tracking_mode,
    v_base_unit_id
  from public.products p
  where p.id = new.input_product_id
    and p.tenant_id = new.tenant_id
    and p.is_active = true;

  if not found then
    raise exception
      'Active input product not found for Production consumption';
  end if;

  if new.input_unit_id <> v_base_unit_id then
    raise exception
      'Production consumption unit must match the Product base unit';
  end if;

  if v_tracking_mode in ('lot', 'batch')
     and new.lot_id is null then
    raise exception
      'Tracked Production input requires a lot/batch';
  end if;

  if v_tracking_mode = 'none'
     and new.lot_id is not null then
    raise exception
      'Non-tracked Production input cannot use a lot/batch';
  end if;

  if new.lot_id is not null then
    select il.status
    into v_lot_status
    from public.inventory_lots il
    where il.id = new.lot_id
      and il.tenant_id = new.tenant_id
      and il.product_id = new.input_product_id;

    if v_lot_status <> 'released' then
      raise exception
        'Production input lot/batch must be released';
    end if;
  end if;

  select im.*
  into v_movement
  from public.inventory_movements im
  where im.id = new.inventory_movement_id
    and im.tenant_id = new.tenant_id;

  if not found then
    raise exception
      'Production consumption inventory movement not found';
  end if;

  if v_movement.site_id <> new.site_id
     or v_movement.warehouse_id <> new.warehouse_id
     or v_movement.product_id <> new.input_product_id
     or v_movement.lot_id is distinct from new.lot_id
     or v_movement.movement_type <> 'production_consume'
     or v_movement.quantity <> -new.actual_qty
     or v_movement.reference_type <> 'production_order'
     or v_movement.reference_id <> new.production_order_id::text
  then
    raise exception
      'Production consumption record does not match its Inventory movement';
  end if;

  new.created_by := auth.uid();

  return new;
end;
$function$;


create or replace function app_private.guard_production_output_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_order_status text;
  v_tracking_mode text;
  v_base_unit_id uuid;
  v_lot_status text;
  v_warehouse_type text;
  v_movement public.inventory_movements%rowtype;
begin
  select po.status
  into v_order_status
  from public.production_orders po
  where po.id = new.production_order_id
    and po.tenant_id = new.tenant_id
    and po.site_id = new.site_id;

  if v_order_status <> 'in_progress' then
    raise exception
      'Production output requires an In Progress Production Order';
  end if;

  select w.warehouse_type
  into v_warehouse_type
  from public.warehouses w
  where w.id = new.warehouse_id
    and w.tenant_id = new.tenant_id
    and w.site_id = new.site_id
    and w.is_active = true;

  if v_warehouse_type <> 'QUARANTINE' then
    raise exception
      'Production output must first enter an active QUARANTINE warehouse';
  end if;

  select
    p.tracking_mode,
    p.base_unit_id
  into
    v_tracking_mode,
    v_base_unit_id
  from public.products p
  where p.id = new.output_product_id
    and p.tenant_id = new.tenant_id
    and p.is_active = true;

  if not found then
    raise exception
      'Active output product not found';
  end if;

  if new.output_unit_id <> v_base_unit_id then
    raise exception
      'Production output unit must match the Product base unit';
  end if;

  if v_tracking_mode in ('lot', 'batch')
     and new.lot_id is null then
    raise exception
      'Tracked Production output requires a lot/batch';
  end if;

  if v_tracking_mode = 'none'
     and new.lot_id is not null then
    raise exception
      'Non-tracked Production output cannot use a lot/batch';
  end if;

  if new.lot_id is not null then
    select il.status
    into v_lot_status
    from public.inventory_lots il
    where il.id = new.lot_id
      and il.tenant_id = new.tenant_id
      and il.product_id = new.output_product_id;

    if v_lot_status <> 'quarantine' then
      raise exception
        'New Production output lot/batch must be in quarantine';
    end if;
  end if;

  select im.*
  into v_movement
  from public.inventory_movements im
  where im.id = new.inventory_movement_id
    and im.tenant_id = new.tenant_id;

  if not found then
    raise exception
      'Production output Inventory movement not found';
  end if;

  if v_movement.site_id <> new.site_id
     or v_movement.warehouse_id <> new.warehouse_id
     or v_movement.product_id <> new.output_product_id
     or v_movement.lot_id is distinct from new.lot_id
     or v_movement.movement_type <> 'production_output'
     or v_movement.quantity <> new.actual_qty
     or v_movement.reference_type <> 'production_order'
     or v_movement.reference_id <> new.production_order_id::text
  then
    raise exception
      'Production output record does not match its Inventory movement';
  end if;

  new.created_by := auth.uid();

  return new;
end;
$function$;

revoke all
on function app_private.guard_production_material_consumption_insert()
from public, anon, authenticated;

revoke all
on function app_private.guard_production_output_insert()
from public, anon, authenticated;

grant execute
on function app_private.guard_production_material_consumption_insert()
to service_role;

grant execute
on function app_private.guard_production_output_insert()
to service_role;

create trigger trg_guard_production_material_consumption_insert
before insert
on public.production_order_material_consumptions
for each row
execute function app_private.guard_production_material_consumption_insert();

create trigger trg_guard_production_output_insert
before insert
on public.production_order_outputs
for each row
execute function app_private.guard_production_output_insert();


-- =========================================================
-- 8. CONTROLLED LIFECYCLE INVARIANT GUARD
-- =========================================================
--
-- Direct authenticated UPDATE is revoked below.
-- Future SECURITY DEFINER execution RPCs will be the only
-- client-facing path capable of lifecycle transitions.

create or replace function app_private.guard_production_order_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception
        'New Production Orders must start in draft status';
    end if;

    new.created_by := auth.uid();

    new.released_at := null;
    new.released_by := null;

    new.actual_start_at := null;
    new.started_by := null;

    new.actual_end_at := null;

    new.completed_at := null;
    new.completed_by := null;

    new.cancelled_at := null;
    new.cancelled_by := null;

    return new;
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception
      'Production Order creator cannot be changed';
  end if;

  if old.status = 'cancelled' then
    raise exception
      'Cancelled Production Orders are immutable';
  end if;

  if old.status = 'completed' then
    raise exception
      'Completed Production Orders are immutable';
  end if;

  -- Preserve the atomic planning invariant introduced before
  -- execution: once a material snapshot exists, the Draft Order
  -- basis may not silently diverge from that frozen snapshot.
  if exists (
    select 1
    from public.production_order_materials pom
    where pom.production_order_id = old.id
      and pom.tenant_id = old.tenant_id
  )
  and (
    new.tenant_id is distinct from old.tenant_id
    or new.site_id is distinct from old.site_id
    or new.recipe_version_id is distinct from old.recipe_version_id
    or new.output_product_id is distinct from old.output_product_id
    or new.output_unit_id is distinct from old.output_unit_id
    or new.planned_qty is distinct from old.planned_qty
  ) then
    raise exception
      'Production Order basis cannot change after the material snapshot is frozen';
  end if;

  -- Once released, the planning basis is frozen.
  if old.status <> 'draft'
     and (
       new.tenant_id is distinct from old.tenant_id
       or new.site_id is distinct from old.site_id
       or new.recipe_version_id is distinct from old.recipe_version_id
       or new.output_product_id is distinct from old.output_product_id
       or new.output_unit_id is distinct from old.output_unit_id
       or new.work_center_id is distinct from old.work_center_id
       or new.production_line_id is distinct from old.production_line_id
       or new.priority is distinct from old.priority
       or new.planned_qty is distinct from old.planned_qty
       or new.planned_start_at is distinct from old.planned_start_at
       or new.planned_end_at is distinct from old.planned_end_at
     )
  then
    raise exception
      'Released Production Order planning basis is immutable';
  end if;

  if new.status is not distinct from old.status then
    if new.released_at is distinct from old.released_at
       or new.released_by is distinct from old.released_by
       or new.actual_start_at is distinct from old.actual_start_at
       or new.started_by is distinct from old.started_by
       or new.actual_end_at is distinct from old.actual_end_at
       or new.completed_at is distinct from old.completed_at
       or new.completed_by is distinct from old.completed_by
       or new.cancelled_at is distinct from old.cancelled_at
       or new.cancelled_by is distinct from old.cancelled_by
    then
      raise exception
        'Production lifecycle metadata is system controlled';
    end if;

    return new;
  end if;

  if old.status = 'draft'
     and new.status = 'cancelled' then
    if new.cancelled_at is null
       or new.cancelled_by is null
       or new.cancelled_by <> auth.uid()
       or new.released_at is not null
       or new.released_by is not null
       or new.actual_start_at is not null
       or new.started_by is not null
       or new.actual_end_at is not null
       or new.completed_at is not null
       or new.completed_by is not null
    then
      raise exception
        'Controlled cancellation metadata is required';
    end if;

    return new;
  end if;

  if old.status = 'draft'
     and new.status = 'released' then
    if new.released_at is null
       or new.released_by is null
       or new.released_by <> auth.uid()
       or new.actual_start_at is not null
       or new.started_by is not null
       or new.actual_end_at is not null
       or new.completed_at is not null
       or new.completed_by is not null
       or new.cancelled_at is not null
       or new.cancelled_by is not null
    then
      raise exception
        'Invalid controlled Production release metadata';
    end if;

    return new;
  end if;

  if old.status = 'released'
     and new.status = 'in_progress' then
    if new.released_at is distinct from old.released_at
       or new.released_by is distinct from old.released_by
       or new.actual_start_at is null
       or new.started_by is null
       or new.started_by <> auth.uid()
       or new.actual_end_at is not null
       or new.completed_at is not null
       or new.completed_by is not null
       or new.cancelled_at is not null
       or new.cancelled_by is not null
    then
      raise exception
        'Invalid controlled Production start metadata';
    end if;

    return new;
  end if;

  if old.status = 'in_progress'
     and new.status = 'completed' then
    if new.released_at is distinct from old.released_at
       or new.released_by is distinct from old.released_by
       or new.actual_start_at is distinct from old.actual_start_at
       or new.started_by is distinct from old.started_by
       or new.actual_end_at is null
       or new.completed_at is null
       or new.completed_by is null
       or new.completed_by <> auth.uid()
       or new.cancelled_at is not null
       or new.cancelled_by is not null
       or exists (
         select 1
         from public.production_order_materials pom
         join public.production_recipe_components prc
           on prc.id = pom.source_component_id
          and prc.tenant_id = pom.tenant_id
         where pom.production_order_id = old.id
           and pom.tenant_id = old.tenant_id
           and prc.is_optional = false
           and not exists (
             select 1
             from public.production_order_material_consumptions poc
             where poc.production_order_material_id = pom.id
               and poc.production_order_id = old.id
               and poc.tenant_id = old.tenant_id
           )
       )
       or not exists (
         select 1
         from public.production_order_outputs poo
         where poo.production_order_id = old.id
           and poo.tenant_id = old.tenant_id
       )
    then
      raise exception
        'Invalid controlled Production completion metadata';
    end if;

    return new;
  end if;

  raise exception
    'Invalid Production Order lifecycle transition from % to %',
    old.status,
    new.status;
end;
$function$;


-- =========================================================
-- 9. RLS
-- =========================================================

alter table public.production_order_material_consumptions
  enable row level security;

alter table public.production_order_outputs
  enable row level security;

create policy production_material_consumptions_select_scoped
on public.production_order_material_consumptions
for select
to authenticated
using (
  app_private.has_site_access(site_id)
);

create policy production_outputs_select_scoped
on public.production_order_outputs
for select
to authenticated
using (
  app_private.has_site_access(site_id)
);

-- No authenticated INSERT / UPDATE / DELETE policies.
-- Future execution RPCs perform all writes.


-- =========================================================
-- 10. PRIVILEGES
-- =========================================================

revoke all
on table
  public.production_order_material_consumptions,
  public.production_order_outputs
from public, anon, authenticated;

grant select
on table
  public.production_order_material_consumptions,
  public.production_order_outputs
to authenticated;

grant select, insert, update, delete
on table
  public.production_order_material_consumptions,
  public.production_order_outputs
to service_role;

-- Lifecycle transitions must pass through future controlled RPCs.
revoke update
on table public.production_orders
from authenticated;



-- =========================================================
-- 10A. RESERVE PRODUCTION MOVEMENT TYPES FOR EXECUTION ENGINE
-- =========================================================
--
-- Generic inventory users may still post normal Inventory movements.
-- production_consume / production_output are reserved for the
-- controlled Production execution engine.
--
-- The public wrapper becomes SECURITY DEFINER only so authenticated
-- callers no longer need direct EXECUTE privilege on the private
-- inventory posting implementation. The private implementation itself
-- still performs authentication, site access, warehouse access,
-- inventory.post capability, stock, lot/batch, idempotency and audit
-- checks using auth.uid().

create or replace function public.post_inventory_movement(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_product_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_posting_key text,
  p_lot_id uuid default null,
  p_unit_cost numeric default null,
  p_reference_type text default null,
  p_reference_id text default null,
  p_reason text default null,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin

  if p_movement_type in (
    'production_consume',
    'production_output'
  ) then
    raise exception
      'Production inventory movements require the controlled Production execution workflow';
  end if;

  return app_private.post_inventory_movement_impl(
    p_tenant_id,
    p_warehouse_id,
    p_product_id,
    p_movement_type,
    p_quantity,
    p_posting_key,
    p_lot_id,
    p_unit_cost,
    p_reference_type,
    p_reference_id,
    p_reason,
    p_occurred_at
  );

end;
$function$;

revoke all
on function public.post_inventory_movement(
  uuid,
  uuid,
  uuid,
  text,
  numeric,
  text,
  uuid,
  numeric,
  text,
  text,
  text,
  timestamptz
)
from public, anon;

grant execute
on function public.post_inventory_movement(
  uuid,
  uuid,
  uuid,
  text,
  numeric,
  text,
  uuid,
  numeric,
  text,
  text,
  text,
  timestamptz
)
to authenticated, service_role;


-- Authenticated clients must not bypass the public wrapper by
-- executing the private ledger implementation directly.
revoke execute
on function app_private.post_inventory_movement_impl(
  uuid,
  uuid,
  uuid,
  text,
  numeric,
  text,
  uuid,
  numeric,
  text,
  text,
  text,
  timestamptz
)
from authenticated;

grant execute
on function app_private.post_inventory_movement_impl(
  uuid,
  uuid,
  uuid,
  text,
  numeric,
  text,
  uuid,
  numeric,
  text,
  text,
  text,
  timestamptz
)
to service_role;


-- =========================================================
-- 11. COMMENTS
-- =========================================================

comment on table public.production_order_material_consumptions is
  'Immutable actual Production material consumption trace linked to the frozen Production Order BOM line, source warehouse/lot, and Inventory production_consume movement.';

comment on table public.production_order_outputs is
  'Immutable actual Production output trace linked to the Production Order, quarantine warehouse/output lot or batch, and Inventory production_output movement.';

comment on column public.production_order_material_consumptions.actual_qty is
  'Actual consumed quantity. Planned quantity remains in production_order_materials.';

comment on column public.production_order_outputs.actual_qty is
  'Actual produced quantity. Yield is derived from actual output versus the Production Order planned quantity.';
