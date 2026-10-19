-- MAVORA Manufacturing ERP
-- Migration 008
-- Atomic Inventory Posting Foundation
--
-- Controlled stock posting engine:
--   * atomic balance + ledger posting
--   * capability / warehouse authorization
--   * concurrency protection
--   * negative-stock prevention
--   * weighted-average-cost foundation
--   * idempotency / duplicate-post prevention
--   * audit logging
--
-- No legacy MRS / D-Mo production data is modified.

-- =========================================================
-- 1. POSTING KEY / IDEMPOTENCY
-- =========================================================

alter table public.inventory_movements
  add column posting_key text;

alter table public.inventory_movements
  add constraint inventory_movements_posting_key_not_blank
  check (
    posting_key is null
    or length(btrim(posting_key)) between 1 and 200
  );

create unique index uq_inventory_movements_posting_line
  on public.inventory_movements (
    tenant_id,
    posting_key,
    movement_type,
    warehouse_id
  )
  where posting_key is not null;

create index idx_inventory_movements_posting_key
  on public.inventory_movements (
    tenant_id,
    posting_key
  )
  where posting_key is not null;

-- =========================================================
-- 2. PRIVATE BALANCE LOCK / ENSURE HELPER
-- =========================================================
-- Serializes stock changes for the same:
-- tenant + warehouse + product + lot.
--
-- Not exposed as application RPC.

create or replace function app_private.lock_inventory_balance(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_product_id uuid,
  p_lot_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_balance_id uuid;
  v_lock_key bigint;
begin
  v_lock_key :=
    pg_catalog.hashtextextended(
      p_tenant_id::text
      || '|'
      || p_warehouse_id::text
      || '|'
      || p_product_id::text
      || '|'
      || coalesce(p_lot_id::text, '-'),
      0
    );

  perform pg_catalog.pg_advisory_xact_lock(v_lock_key);

  insert into public.inventory_balances (
    tenant_id,
    warehouse_id,
    product_id,
    lot_id,
    quantity,
    reserved_quantity,
    average_unit_cost
  )
  values (
    p_tenant_id,
    p_warehouse_id,
    p_product_id,
    p_lot_id,
    0,
    0,
    null
  )
  on conflict do nothing;

  select ib.id
    into v_balance_id
  from public.inventory_balances ib
  where ib.tenant_id = p_tenant_id
    and ib.warehouse_id = p_warehouse_id
    and ib.product_id = p_product_id
    and ib.lot_id is not distinct from p_lot_id
  for update;

  if v_balance_id is null then
    raise exception 'Unable to lock inventory balance';
  end if;

  return v_balance_id;
end;
$function$;

revoke all
on function app_private.lock_inventory_balance(
  uuid,
  uuid,
  uuid,
  uuid
)
from public, anon, authenticated;

-- =========================================================
-- 3. SINGLE INVENTORY MOVEMENT RPC
-- =========================================================

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
declare
  v_user_id uuid;
  v_site_id uuid;

  v_tracking_mode text;
  v_lot_status text;

  v_balance_id uuid;
  v_current_qty numeric(20,6);
  v_reserved_qty numeric(20,6);
  v_current_avg numeric(20,6);

  v_delta numeric(20,6);
  v_new_qty numeric(20,6);
  v_new_avg numeric(20,6);
  v_movement_cost numeric(20,6);

  v_group_id uuid;
  v_movement_id uuid;

  v_existing_count integer;
  v_existing public.inventory_movements%rowtype;
begin
  -- -------------------------------------------------------
  -- Authentication
  -- -------------------------------------------------------

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- -------------------------------------------------------
  -- Basic input validation
  -- -------------------------------------------------------

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  if p_quantity <> round(p_quantity, 6) then
    raise exception
      'Quantity cannot exceed 6 decimal places';
  end if;

  if p_quantity > 99999999999999.999999 then
    raise exception
      'Quantity exceeds supported numeric range';
  end if;

  if p_posting_key is null
     or length(btrim(p_posting_key)) = 0 then
    raise exception 'Posting key is required';
  end if;

  if length(btrim(p_posting_key)) > 200 then
    raise exception 'Posting key cannot exceed 200 characters';
  end if;

  if p_unit_cost is not null and p_unit_cost < 0 then
    raise exception 'Unit cost cannot be negative';
  end if;

  if p_unit_cost is not null
     and p_unit_cost <> round(p_unit_cost, 6) then
    raise exception
      'Unit cost cannot exceed 6 decimal places';
  end if;

  if p_unit_cost is not null
     and p_unit_cost > 99999999999999.999999 then
    raise exception
      'Unit cost exceeds supported numeric range';
  end if;

  if p_movement_type not in (
    'opening',
    'receipt',
    'issue',
    'production_consume',
    'production_output',
    'adjustment_in',
    'adjustment_out',
    'return_in',
    'return_out',
    'wastage'
  ) then
    raise exception
      'Unsupported single movement type: %',
      p_movement_type;
  end if;

  if p_movement_type in (
    'adjustment_in',
    'adjustment_out',
    'wastage',
    'opening'
  )
  and (
    p_reason is null
    or length(btrim(p_reason)) = 0
  ) then
    raise exception
      'Reason is required for movement type %',
      p_movement_type;
  end if;

  -- -------------------------------------------------------
  -- Warehouse / site validation
  -- -------------------------------------------------------

  select w.site_id
    into v_site_id
  from public.warehouses w
  where w.id = p_warehouse_id
    and w.tenant_id = p_tenant_id
    and w.is_active = true;

  if v_site_id is null then
    raise exception
      'Active warehouse not found for tenant';
  end if;

  if not app_private.has_site_access(v_site_id) then
    raise exception 'Site access denied';
  end if;

  if not app_private.has_warehouse_access(p_warehouse_id) then
    raise exception 'Warehouse access denied';
  end if;

  if not app_private.has_capability(
    p_tenant_id,
    'inventory.post',
    v_site_id
  ) then
    raise exception
      'inventory.post capability required';
  end if;

  -- -------------------------------------------------------
  -- Product validation
  -- -------------------------------------------------------

  select p.tracking_mode
    into v_tracking_mode
  from public.products p
  where p.id = p_product_id
    and p.tenant_id = p_tenant_id
    and p.is_active = true;

  if v_tracking_mode is null then
    raise exception
      'Active product not found for tenant';
  end if;

  -- -------------------------------------------------------
  -- Lot / batch validation
  -- -------------------------------------------------------

  if v_tracking_mode in ('lot', 'batch')
     and p_lot_id is null then
    raise exception
      'Lot/batch is required for tracked product';
  end if;

  if v_tracking_mode = 'none'
     and p_lot_id is not null then
    raise exception
      'Lot/batch is not allowed for non-tracked product';
  end if;

  if p_lot_id is not null then
    select il.status
      into v_lot_status
    from public.inventory_lots il
    where il.id = p_lot_id
      and il.tenant_id = p_tenant_id
      and il.product_id = p_product_id;

    if v_lot_status is null then
      raise exception
        'Lot/batch does not belong to product and tenant';
    end if;

    if v_lot_status = 'consumed' then
      raise exception
        'Consumed lot/batch cannot receive or issue stock';
    end if;

    if p_movement_type in (
      'issue',
      'production_consume',
      'return_out'
    )
    and v_lot_status <> 'released' then
      raise exception
        'Lot/batch must be released for movement type %',
        p_movement_type;
    end if;
  end if;

  -- -------------------------------------------------------
  -- Idempotency / duplicate-request serialization
  -- -------------------------------------------------------

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'posting|'
      || p_tenant_id::text
      || '|'
      || btrim(p_posting_key),
      0
    )
  );

  select count(*)
    into v_existing_count
  from public.inventory_movements im
  where im.tenant_id = p_tenant_id
    and im.posting_key = btrim(p_posting_key);

  if v_existing_count > 0 then
    if v_existing_count <> 1 then
      raise exception
        'Posting key already belongs to another posting group';
    end if;

    select im.*
      into v_existing
    from public.inventory_movements im
    where im.tenant_id = p_tenant_id
      and im.posting_key = btrim(p_posting_key)
    limit 1;

    if v_existing.warehouse_id <> p_warehouse_id
       or v_existing.product_id <> p_product_id
       or v_existing.lot_id is distinct from p_lot_id
       or v_existing.movement_type <> p_movement_type
       or abs(v_existing.quantity) <> p_quantity

       or (
         p_movement_type in (
           'opening',
           'receipt',
           'production_output',
           'adjustment_in',
           'return_in'
         )
         and v_existing.unit_cost is distinct from p_unit_cost
       )

       or v_existing.reference_type
            is distinct from nullif(btrim(p_reference_type), '')

       or v_existing.reference_id
            is distinct from nullif(btrim(p_reference_id), '')

       or v_existing.reason
            is distinct from nullif(btrim(p_reason), '')
    then
      raise exception
        'Posting key has already been used for different data';
    end if;

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'movement_id', v_existing.id,
      'movement_group_id', v_existing.movement_group_id,
      'posting_key', v_existing.posting_key
    );
  end if;

  -- -------------------------------------------------------
  -- Balance lock
  -- -------------------------------------------------------

  v_balance_id :=
    app_private.lock_inventory_balance(
      p_tenant_id,
      p_warehouse_id,
      p_product_id,
      p_lot_id
    );

  select
    ib.quantity,
    ib.reserved_quantity,
    ib.average_unit_cost
  into
    v_current_qty,
    v_reserved_qty,
    v_current_avg
  from public.inventory_balances ib
  where ib.id = v_balance_id
  for update;

  -- -------------------------------------------------------
  -- Direction
  -- -------------------------------------------------------

  if p_movement_type in (
    'opening',
    'receipt',
    'production_output',
    'adjustment_in',
    'return_in'
  ) then
    v_delta := p_quantity;
  else
    v_delta := -p_quantity;
  end if;

  -- Opening stock must truly be initial.
  if p_movement_type = 'opening'
     and exists (
       select 1
       from public.inventory_movements im
       where im.tenant_id = p_tenant_id
         and im.warehouse_id = p_warehouse_id
         and im.product_id = p_product_id
         and im.lot_id is not distinct from p_lot_id
     ) then
    raise exception
      'Opening stock can only be posted before movement history exists';
  end if;

  -- -------------------------------------------------------
  -- Stock availability
  -- -------------------------------------------------------

  if v_delta < 0
     and (v_current_qty - v_reserved_qty) < p_quantity then
    raise exception
      'Insufficient available stock. On hand: %, Reserved: %, Requested: %',
      v_current_qty,
      v_reserved_qty,
      p_quantity;
  end if;

  v_new_qty := v_current_qty + v_delta;

  -- -------------------------------------------------------
  -- Weighted average cost
  -- -------------------------------------------------------

  if v_delta > 0 then
    v_movement_cost := p_unit_cost;

    if p_unit_cost is null then
      v_new_avg := v_current_avg;

    elsif v_current_qty = 0
       or v_current_avg is null then
      v_new_avg := p_unit_cost;

    else
      v_new_avg :=
        (
          (v_current_qty * v_current_avg)
          +
          (p_quantity * p_unit_cost)
        )
        /
        (v_current_qty + p_quantity);
    end if;

  else
    -- Outgoing stock always uses current inventory average cost.
    v_movement_cost := v_current_avg;
    v_new_avg := v_current_avg;
  end if;

  -- -------------------------------------------------------
  -- Update balance
  -- -------------------------------------------------------

  update public.inventory_balances
  set
    quantity = v_new_qty,
    average_unit_cost = v_new_avg,
    updated_at = now()
  where id = v_balance_id;

  -- -------------------------------------------------------
  -- Append ledger
  -- -------------------------------------------------------

  v_group_id := gen_random_uuid();
  v_movement_id := gen_random_uuid();

  insert into public.inventory_movements (
    id,
    movement_group_id,
    tenant_id,
    site_id,
    warehouse_id,
    product_id,
    lot_id,
    movement_type,
    quantity,
    unit_cost,
    posting_key,
    reference_type,
    reference_id,
    reason,
    occurred_at,
    created_by
  )
  values (
    v_movement_id,
    v_group_id,
    p_tenant_id,
    v_site_id,
    p_warehouse_id,
    p_product_id,
    p_lot_id,
    p_movement_type,
    v_delta,
    v_movement_cost,
    btrim(p_posting_key),
    nullif(btrim(p_reference_type), ''),
    nullif(btrim(p_reference_id), ''),
    nullif(btrim(p_reason), ''),
    coalesce(p_occurred_at, now()),
    v_user_id
  );

  -- -------------------------------------------------------
  -- Audit
  -- -------------------------------------------------------

  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_data,
    reason,
    metadata
  )
  values (
    p_tenant_id,
    v_site_id,
    v_user_id,
    'inventory.post',
    'inventory_movement',
    v_movement_id,
    jsonb_build_object(
      'warehouse_id', p_warehouse_id,
      'product_id', p_product_id,
      'lot_id', p_lot_id,
      'movement_type', p_movement_type,
      'quantity', v_delta,
      'unit_cost', v_movement_cost,
      'balance_before', v_current_qty,
      'balance_after', v_new_qty
    ),
    nullif(btrim(p_reason), ''),
    jsonb_build_object(
      'movement_group_id', v_group_id,
      'posting_key', btrim(p_posting_key),
      'reference_type', nullif(btrim(p_reference_type), ''),
      'reference_id', nullif(btrim(p_reference_id), '')
    )
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'movement_id', v_movement_id,
    'movement_group_id', v_group_id,
    'posting_key', btrim(p_posting_key),
    'quantity_before', v_current_qty,
    'quantity_after', v_new_qty,
    'average_unit_cost', v_new_avg
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
to authenticated;

-- =========================================================
-- 4. ATOMIC WAREHOUSE TRANSFER RPC
-- =========================================================

create or replace function public.post_inventory_transfer(
  p_tenant_id uuid,
  p_source_warehouse_id uuid,
  p_destination_warehouse_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_posting_key text,
  p_lot_id uuid default null,
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
declare
  v_user_id uuid;

  v_source_site_id uuid;
  v_destination_site_id uuid;

  v_tracking_mode text;
  v_lot_status text;

  v_source_balance_id uuid;
  v_destination_balance_id uuid;

  v_source_qty numeric(20,6);
  v_source_reserved numeric(20,6);
  v_source_avg numeric(20,6);

  v_destination_qty numeric(20,6);
  v_destination_avg numeric(20,6);
  v_destination_new_avg numeric(20,6);

  v_group_id uuid;
  v_out_id uuid;
  v_in_id uuid;

  v_existing_count integer;
  v_existing_group uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  if p_quantity <> round(p_quantity, 6) then
    raise exception
      'Quantity cannot exceed 6 decimal places';
  end if;

  if p_quantity > 99999999999999.999999 then
    raise exception
      'Quantity exceeds supported numeric range';
  end if;

  if p_posting_key is null
     or length(btrim(p_posting_key)) = 0 then
    raise exception 'Posting key is required';
  end if;

  if length(btrim(p_posting_key)) > 200 then
    raise exception 'Posting key cannot exceed 200 characters';
  end if;

  if p_source_warehouse_id = p_destination_warehouse_id then
    raise exception
      'Source and destination warehouses must be different';
  end if;

  -- -------------------------------------------------------
  -- Warehouse / site validation
  -- -------------------------------------------------------

  select w.site_id
    into v_source_site_id
  from public.warehouses w
  where w.id = p_source_warehouse_id
    and w.tenant_id = p_tenant_id
    and w.is_active = true;

  select w.site_id
    into v_destination_site_id
  from public.warehouses w
  where w.id = p_destination_warehouse_id
    and w.tenant_id = p_tenant_id
    and w.is_active = true;

  if v_source_site_id is null
     or v_destination_site_id is null then
    raise exception
      'Source or destination warehouse is invalid/inactive';
  end if;

  if not app_private.has_warehouse_access(
    p_source_warehouse_id
  )
  or not app_private.has_warehouse_access(
    p_destination_warehouse_id
  ) then
    raise exception 'Warehouse access denied';
  end if;

  if not app_private.has_capability(
    p_tenant_id,
    'inventory.post',
    v_source_site_id
  )
  or not app_private.has_capability(
    p_tenant_id,
    'inventory.post',
    v_destination_site_id
  ) then
    raise exception
      'inventory.post capability required for both sites';
  end if;

  -- -------------------------------------------------------
  -- Product / lot validation
  -- -------------------------------------------------------

  select p.tracking_mode
    into v_tracking_mode
  from public.products p
  where p.id = p_product_id
    and p.tenant_id = p_tenant_id
    and p.is_active = true;

  if v_tracking_mode is null then
    raise exception
      'Active product not found for tenant';
  end if;

  if v_tracking_mode in ('lot', 'batch')
     and p_lot_id is null then
    raise exception
      'Lot/batch is required for tracked product';
  end if;

  if v_tracking_mode = 'none'
     and p_lot_id is not null then
    raise exception
      'Lot/batch is not allowed for non-tracked product';
  end if;

  if p_lot_id is not null then
    select il.status
      into v_lot_status
    from public.inventory_lots il
    where il.id = p_lot_id
      and il.tenant_id = p_tenant_id
      and il.product_id = p_product_id;

    if v_lot_status is null then
      raise exception
        'Lot/batch does not belong to product and tenant';
    end if;

    if v_lot_status <> 'released' then
      raise exception
        'Only released lot/batch may be transferred';
    end if;
  end if;

  -- -------------------------------------------------------
  -- Idempotency / duplicate-request serialization
  -- -------------------------------------------------------

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'posting|'
      || p_tenant_id::text
      || '|'
      || btrim(p_posting_key),
      0
    )
  );

  select count(*)
    into v_existing_count
  from public.inventory_movements im
  where im.tenant_id = p_tenant_id
    and im.posting_key = btrim(p_posting_key);

  if v_existing_count > 0 then

    select im.movement_group_id
      into v_existing_group
    from public.inventory_movements im
    where im.tenant_id = p_tenant_id
      and im.posting_key = btrim(p_posting_key)
    order by im.created_at, im.id
    limit 1;

    if v_existing_count = 2
       and (
         select count(distinct im.movement_group_id)
         from public.inventory_movements im
         where im.tenant_id = p_tenant_id
           and im.posting_key = btrim(p_posting_key)
       ) = 1
       and exists (
         select 1
         from public.inventory_movements im
         where im.tenant_id = p_tenant_id
           and im.posting_key = btrim(p_posting_key)
           and im.warehouse_id = p_source_warehouse_id
           and im.product_id = p_product_id
           and im.lot_id is not distinct from p_lot_id
           and im.movement_type = 'transfer_out'
           and im.quantity = -p_quantity
       )
       and exists (
         select 1
         from public.inventory_movements im
         where im.tenant_id = p_tenant_id
           and im.posting_key = btrim(p_posting_key)
           and im.warehouse_id = p_destination_warehouse_id
           and im.product_id = p_product_id
           and im.lot_id is not distinct from p_lot_id
           and im.movement_type = 'transfer_in'
           and im.quantity = p_quantity
       )
       and not exists (
         select 1
         from public.inventory_movements im
         where im.tenant_id = p_tenant_id
           and im.posting_key = btrim(p_posting_key)
           and (
             im.reference_type
               is distinct from nullif(btrim(p_reference_type), '')
             or im.reference_id
               is distinct from nullif(btrim(p_reference_id), '')
             or im.reason
               is distinct from nullif(btrim(p_reason), '')
           )
       ) then

      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'movement_group_id', v_existing_group,
        'posting_key', btrim(p_posting_key)
      );
    end if;

    raise exception
      'Posting key has already been used for different data';
  end if;

  -- -------------------------------------------------------
  -- Deterministic lock order prevents transfer deadlocks.
  -- -------------------------------------------------------

  if p_source_warehouse_id::text
     < p_destination_warehouse_id::text then

    v_source_balance_id :=
      app_private.lock_inventory_balance(
        p_tenant_id,
        p_source_warehouse_id,
        p_product_id,
        p_lot_id
      );

    v_destination_balance_id :=
      app_private.lock_inventory_balance(
        p_tenant_id,
        p_destination_warehouse_id,
        p_product_id,
        p_lot_id
      );

  else

    v_destination_balance_id :=
      app_private.lock_inventory_balance(
        p_tenant_id,
        p_destination_warehouse_id,
        p_product_id,
        p_lot_id
      );

    v_source_balance_id :=
      app_private.lock_inventory_balance(
        p_tenant_id,
        p_source_warehouse_id,
        p_product_id,
        p_lot_id
      );
  end if;

  select
    ib.quantity,
    ib.reserved_quantity,
    ib.average_unit_cost
  into
    v_source_qty,
    v_source_reserved,
    v_source_avg
  from public.inventory_balances ib
  where ib.id = v_source_balance_id
  for update;

  select
    ib.quantity,
    ib.average_unit_cost
  into
    v_destination_qty,
    v_destination_avg
  from public.inventory_balances ib
  where ib.id = v_destination_balance_id
  for update;

  -- -------------------------------------------------------
  -- Source availability
  -- -------------------------------------------------------

  if (v_source_qty - v_source_reserved) < p_quantity then
    raise exception
      'Insufficient available source stock. On hand: %, Reserved: %, Requested: %',
      v_source_qty,
      v_source_reserved,
      p_quantity;
  end if;

  -- -------------------------------------------------------
  -- Destination weighted average
  -- -------------------------------------------------------

  if v_source_avg is null then
    v_destination_new_avg := v_destination_avg;

  elsif v_destination_qty = 0
     or v_destination_avg is null then
    v_destination_new_avg := v_source_avg;

  else
    v_destination_new_avg :=
      (
        (v_destination_qty * v_destination_avg)
        +
        (p_quantity * v_source_avg)
      )
      /
      (v_destination_qty + p_quantity);
  end if;

  -- -------------------------------------------------------
  -- Atomic balance updates
  -- -------------------------------------------------------

  update public.inventory_balances
  set
    quantity = quantity - p_quantity,
    updated_at = now()
  where id = v_source_balance_id;

  update public.inventory_balances
  set
    quantity = quantity + p_quantity,
    average_unit_cost = v_destination_new_avg,
    updated_at = now()
  where id = v_destination_balance_id;

  -- -------------------------------------------------------
  -- Paired transfer ledger
  -- -------------------------------------------------------

  v_group_id := gen_random_uuid();
  v_out_id := gen_random_uuid();
  v_in_id := gen_random_uuid();

  insert into public.inventory_movements (
    id,
    movement_group_id,
    tenant_id,
    site_id,
    warehouse_id,
    product_id,
    lot_id,
    movement_type,
    quantity,
    unit_cost,
    posting_key,
    reference_type,
    reference_id,
    reason,
    occurred_at,
    created_by
  )
  values
  (
    v_out_id,
    v_group_id,
    p_tenant_id,
    v_source_site_id,
    p_source_warehouse_id,
    p_product_id,
    p_lot_id,
    'transfer_out',
    -p_quantity,
    v_source_avg,
    btrim(p_posting_key),
    nullif(btrim(p_reference_type), ''),
    nullif(btrim(p_reference_id), ''),
    nullif(btrim(p_reason), ''),
    coalesce(p_occurred_at, now()),
    v_user_id
  ),
  (
    v_in_id,
    v_group_id,
    p_tenant_id,
    v_destination_site_id,
    p_destination_warehouse_id,
    p_product_id,
    p_lot_id,
    'transfer_in',
    p_quantity,
    v_source_avg,
    btrim(p_posting_key),
    nullif(btrim(p_reference_type), ''),
    nullif(btrim(p_reference_id), ''),
    nullif(btrim(p_reason), ''),
    coalesce(p_occurred_at, now()),
    v_user_id
  );

  -- -------------------------------------------------------
  -- Transfer audit
  -- -------------------------------------------------------

  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_data,
    reason,
    metadata
  )
  values (
    p_tenant_id,
    v_source_site_id,
    v_user_id,
    'inventory.transfer',
    'inventory_transfer',
    v_group_id,
    jsonb_build_object(
      'source_warehouse_id', p_source_warehouse_id,
      'destination_warehouse_id', p_destination_warehouse_id,
      'product_id', p_product_id,
      'lot_id', p_lot_id,
      'quantity', p_quantity,
      'unit_cost', v_source_avg,
      'source_balance_before', v_source_qty,
      'source_balance_after', v_source_qty - p_quantity,
      'destination_balance_before', v_destination_qty,
      'destination_balance_after', v_destination_qty + p_quantity
    ),
    nullif(btrim(p_reason), ''),
    jsonb_build_object(
      'movement_group_id', v_group_id,
      'posting_key', btrim(p_posting_key),
      'transfer_out_id', v_out_id,
      'transfer_in_id', v_in_id,
      'reference_type', nullif(btrim(p_reference_type), ''),
      'reference_id', nullif(btrim(p_reference_id), '')
    )
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'movement_group_id', v_group_id,
    'transfer_out_id', v_out_id,
    'transfer_in_id', v_in_id,
    'posting_key', btrim(p_posting_key),
    'source_quantity_after', v_source_qty - p_quantity,
    'destination_quantity_after', v_destination_qty + p_quantity,
    'transfer_unit_cost', v_source_avg
  );
end;
$function$;

revoke all
on function public.post_inventory_transfer(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  uuid,
  text,
  text,
  text,
  timestamptz
)
from public, anon;

grant execute
on function public.post_inventory_transfer(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  uuid,
  text,
  text,
  text,
  timestamptz
)
to authenticated;

-- =========================================================
-- 5. KEEP DIRECT LEDGER WRITE CLOSED
-- =========================================================

revoke insert, update, delete, truncate
on public.inventory_balances
from anon, authenticated;

revoke insert, update, delete, truncate
on public.inventory_movements
from anon, authenticated;

