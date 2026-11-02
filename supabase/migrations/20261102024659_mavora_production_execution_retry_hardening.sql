-- MAVORA Manufacturing ERP
-- Migration 018
-- Production Execution Retry Hardening
--
-- Goal:
--   Preserve idempotent Consume / Output retries even after
--   a Production Order has already transitioned to Completed.
--
-- Important:
--   * No historical Inventory movement is modified.
--   * No Production execution trace is modified.
--   * A retry succeeds only when the same posting key is already
--     linked to exactly the same historical request payload.
--   * Unknown/new posting keys still pass through the existing
--     controlled execution implementation and therefore cannot
--     post against a Completed Production Order.
--   * Applied migrations 015, 016 and 017 remain immutable.


-- =========================================================
-- 1. EXISTING MATERIAL-CONSUMPTION RETRY LOOKUP
-- =========================================================

create or replace function app_private.retry_existing_production_material_consumption(
  p_tenant_id uuid,
  p_production_order_id uuid,
  p_production_order_material_id uuid,
  p_warehouse_id uuid,
  p_lot_id uuid,
  p_actual_qty numeric,
  p_posting_key text,
  p_variance_reason text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();

  v_order public.production_orders%rowtype;
  v_material public.production_order_materials%rowtype;

  v_existing_count integer;
  v_movement public.inventory_movements%rowtype;
  v_trace public.production_order_material_consumptions%rowtype;

  v_warehouse_site_id uuid;
begin

  if v_user_id is null then
    raise exception
      'Authentication required';
  end if;


  if p_tenant_id is null
     or p_production_order_id is null
     or p_production_order_material_id is null
     or p_warehouse_id is null then
    raise exception
      'Production consumption scope is incomplete';
  end if;


  if p_actual_qty is null
     or p_actual_qty <= 0 then
    raise exception
      'Actual consumption quantity must be greater than zero';
  end if;

  if p_actual_qty <> round(p_actual_qty, 6) then
    raise exception
      'Actual consumption quantity cannot exceed 6 decimal places';
  end if;


  if p_posting_key is null
     or length(btrim(p_posting_key)) = 0 then
    raise exception
      'Posting key is required';
  end if;

  if length(btrim(p_posting_key)) > 200 then
    raise exception
      'Posting key cannot exceed 200 characters';
  end if;


  if p_variance_reason is not null
     and length(p_variance_reason) > 2000 then
    raise exception
      'Variance reason cannot exceed 2000 characters';
  end if;

  if p_reason is not null
     and length(p_reason) > 2000 then
    raise exception
      'Reason cannot exceed 2000 characters';
  end if;


  -- Serialize against lifecycle changes such as Completion.
  select po.*
  into v_order
  from public.production_orders po
  where po.id = p_production_order_id
    and po.tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception
      'Production Order not found';
  end if;


  perform app_private.require_production_execution_access(
    p_tenant_id,
    v_order.site_id
  );


  -- No historical posting key:
  -- return NULL and let the existing controlled implementation
  -- handle normal status, Inventory and trace validation.
  select count(*)
  into v_existing_count
  from public.inventory_movements im
  where im.tenant_id = p_tenant_id
    and im.posting_key = btrim(p_posting_key);

  if v_existing_count = 0 then
    return null;
  end if;


  if v_existing_count <> 1 then
    raise exception
      'Production consumption posting key belongs to an unexpected Inventory posting group';
  end if;


  -- A historical retry is valid only for an execution that
  -- originally reached In Progress and may now be Completed.
  if v_order.status not in (
    'in_progress',
    'completed'
  ) then
    raise exception
      'Production consumption retry is not valid for the current Production Order status';
  end if;


  -- Preserve Inventory authorization on the retry path.
  select w.site_id
  into v_warehouse_site_id
  from public.warehouses w
  where w.id = p_warehouse_id
    and w.tenant_id = p_tenant_id;

  if not found
     or v_warehouse_site_id <> v_order.site_id then
    raise exception
      'Production consumption warehouse does not belong to the Production site';
  end if;


  if not app_private.has_warehouse_access(
    p_warehouse_id
  ) then
    raise exception
      'Warehouse access denied';
  end if;


  if not app_private.has_capability(
    p_tenant_id,
    'inventory.post',
    v_order.site_id
  ) then
    raise exception
      'inventory.post capability required';
  end if;


  select pom.*
  into v_material
  from public.production_order_materials pom
  where pom.id = p_production_order_material_id
    and pom.production_order_id = v_order.id
    and pom.tenant_id = v_order.tenant_id
    and pom.site_id = v_order.site_id;

  if not found then
    raise exception
      'Frozen Production material line not found for this Order';
  end if;


  select im.*
  into v_movement
  from public.inventory_movements im
  where im.tenant_id = p_tenant_id
    and im.posting_key = btrim(p_posting_key)
  limit 1;


  if v_movement.site_id <> v_order.site_id
     or v_movement.warehouse_id <> p_warehouse_id
     or v_movement.product_id <> v_material.input_product_id
     or v_movement.lot_id is distinct from p_lot_id
     or v_movement.movement_type <> 'production_consume'
     or v_movement.quantity <> -p_actual_qty
     or v_movement.reference_type
          is distinct from 'production_order'
     or v_movement.reference_id
          is distinct from v_order.id::text
     or v_movement.reason
          is distinct from nullif(btrim(p_reason), '')
  then
    raise exception
      'Production consumption posting key has already been used for different data';
  end if;


  select poc.*
  into v_trace
  from public.production_order_material_consumptions poc
  where poc.inventory_movement_id = v_movement.id
    and poc.tenant_id = v_order.tenant_id;

  if not found then
    raise exception
      'Production consumption posting key exists without its immutable Production trace';
  end if;


  if v_trace.production_order_id <> v_order.id
     or v_trace.production_order_material_id <> v_material.id
     or v_trace.warehouse_id <> p_warehouse_id
     or v_trace.input_product_id <> v_material.input_product_id
     or v_trace.input_unit_id <> v_material.input_unit_id
     or v_trace.lot_id is distinct from p_lot_id
     or v_trace.actual_qty <> p_actual_qty
     or v_trace.variance_reason
          is distinct from nullif(btrim(p_variance_reason), '')
  then
    raise exception
      'Production consumption posting key is linked to different immutable trace data';
  end if;


  return jsonb_build_object(
    'ok', true,
    'idempotent', true,
    'production_order_id', v_order.id,
    'production_order_material_id', v_material.id,
    'consumption_id', v_trace.id,
    'inventory_movement_id', v_movement.id,
    'actual_qty', v_trace.actual_qty
  );

end;
$function$;


revoke all
on function app_private.retry_existing_production_material_consumption(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  text,
  text
)
from public, anon, authenticated;

grant execute
on function app_private.retry_existing_production_material_consumption(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  text,
  text
)
to service_role;


-- =========================================================
-- 2. EXISTING PRODUCTION-OUTPUT RETRY LOOKUP
-- =========================================================

create or replace function app_private.retry_existing_production_output(
  p_tenant_id uuid,
  p_production_order_id uuid,
  p_warehouse_id uuid,
  p_lot_id uuid,
  p_actual_qty numeric,
  p_posting_key text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();

  v_order public.production_orders%rowtype;

  v_existing_count integer;
  v_movement public.inventory_movements%rowtype;
  v_trace public.production_order_outputs%rowtype;

  v_warehouse_site_id uuid;
begin

  if v_user_id is null then
    raise exception
      'Authentication required';
  end if;


  if p_tenant_id is null
     or p_production_order_id is null
     or p_warehouse_id is null then
    raise exception
      'Production output scope is incomplete';
  end if;


  if p_actual_qty is null
     or p_actual_qty <= 0 then
    raise exception
      'Actual output quantity must be greater than zero';
  end if;

  if p_actual_qty <> round(p_actual_qty, 6) then
    raise exception
      'Actual output quantity cannot exceed 6 decimal places';
  end if;


  if p_posting_key is null
     or length(btrim(p_posting_key)) = 0 then
    raise exception
      'Posting key is required';
  end if;

  if length(btrim(p_posting_key)) > 200 then
    raise exception
      'Posting key cannot exceed 200 characters';
  end if;


  if p_reason is not null
     and length(p_reason) > 2000 then
    raise exception
      'Reason cannot exceed 2000 characters';
  end if;


  select po.*
  into v_order
  from public.production_orders po
  where po.id = p_production_order_id
    and po.tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception
      'Production Order not found';
  end if;


  perform app_private.require_production_execution_access(
    p_tenant_id,
    v_order.site_id
  );


  select count(*)
  into v_existing_count
  from public.inventory_movements im
  where im.tenant_id = p_tenant_id
    and im.posting_key = btrim(p_posting_key);

  if v_existing_count = 0 then
    return null;
  end if;


  if v_existing_count <> 1 then
    raise exception
      'Production output posting key belongs to an unexpected Inventory posting group';
  end if;


  if v_order.status not in (
    'in_progress',
    'completed'
  ) then
    raise exception
      'Production output retry is not valid for the current Production Order status';
  end if;


  select w.site_id
  into v_warehouse_site_id
  from public.warehouses w
  where w.id = p_warehouse_id
    and w.tenant_id = p_tenant_id;

  if not found
     or v_warehouse_site_id <> v_order.site_id then
    raise exception
      'Production output warehouse does not belong to the Production site';
  end if;


  if not app_private.has_warehouse_access(
    p_warehouse_id
  ) then
    raise exception
      'Warehouse access denied';
  end if;


  if not app_private.has_capability(
    p_tenant_id,
    'inventory.post',
    v_order.site_id
  ) then
    raise exception
      'inventory.post capability required';
  end if;


  select im.*
  into v_movement
  from public.inventory_movements im
  where im.tenant_id = p_tenant_id
    and im.posting_key = btrim(p_posting_key)
  limit 1;


  if v_movement.site_id <> v_order.site_id
     or v_movement.warehouse_id <> p_warehouse_id
     or v_movement.product_id <> v_order.output_product_id
     or v_movement.lot_id is distinct from p_lot_id
     or v_movement.movement_type <> 'production_output'
     or v_movement.quantity <> p_actual_qty
     or v_movement.reference_type
          is distinct from 'production_order'
     or v_movement.reference_id
          is distinct from v_order.id::text
     or v_movement.reason
          is distinct from nullif(btrim(p_reason), '')
  then
    raise exception
      'Production output posting key has already been used for different data';
  end if;


  select poo.*
  into v_trace
  from public.production_order_outputs poo
  where poo.inventory_movement_id = v_movement.id
    and poo.tenant_id = v_order.tenant_id;

  if not found then
    raise exception
      'Production output posting key exists without its immutable Production trace';
  end if;


  if v_trace.production_order_id <> v_order.id
     or v_trace.warehouse_id <> p_warehouse_id
     or v_trace.output_product_id <> v_order.output_product_id
     or v_trace.output_unit_id <> v_order.output_unit_id
     or v_trace.lot_id is distinct from p_lot_id
     or v_trace.actual_qty <> p_actual_qty
  then
    raise exception
      'Production output posting key is linked to different immutable trace data';
  end if;


  return jsonb_build_object(
    'ok', true,
    'idempotent', true,
    'production_order_id', v_order.id,
    'output_id', v_trace.id,
    'inventory_movement_id', v_movement.id,
    'actual_qty', v_trace.actual_qty
  );

end;
$function$;


revoke all
on function app_private.retry_existing_production_output(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  text
)
from public, anon, authenticated;

grant execute
on function app_private.retry_existing_production_output(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  text
)
to service_role;


-- =========================================================
-- 3. HARDEN PUBLIC MATERIAL-CONSUMPTION RPC
-- =========================================================

create or replace function public.consume_production_material(
  p_tenant_id uuid,
  p_production_order_id uuid,
  p_production_order_material_id uuid,
  p_warehouse_id uuid,
  p_lot_id uuid,
  p_actual_qty numeric,
  p_posting_key text,
  p_variance_reason text default null,
  p_reason text default null,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_retry jsonb;
begin

  v_retry :=
    app_private.retry_existing_production_material_consumption(
      p_tenant_id,
      p_production_order_id,
      p_production_order_material_id,
      p_warehouse_id,
      p_lot_id,
      p_actual_qty,
      p_posting_key,
      p_variance_reason,
      p_reason
    );

  if v_retry is not null then
    return v_retry;
  end if;


  return app_private.consume_production_material_impl(
    p_tenant_id,
    p_production_order_id,
    p_production_order_material_id,
    p_warehouse_id,
    p_lot_id,
    p_actual_qty,
    p_posting_key,
    p_variance_reason,
    p_reason,
    p_occurred_at
  );

end;
$function$;


revoke all
on function public.consume_production_material(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  text,
  text,
  timestamptz
)
from public, anon;

grant execute
on function public.consume_production_material(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  text,
  text,
  timestamptz
)
to authenticated, service_role;


-- =========================================================
-- 4. HARDEN PUBLIC PRODUCTION-OUTPUT RPC
-- =========================================================

create or replace function public.record_production_output(
  p_tenant_id uuid,
  p_production_order_id uuid,
  p_warehouse_id uuid,
  p_lot_id uuid,
  p_actual_qty numeric,
  p_posting_key text,
  p_reason text default null,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_retry jsonb;
begin

  v_retry :=
    app_private.retry_existing_production_output(
      p_tenant_id,
      p_production_order_id,
      p_warehouse_id,
      p_lot_id,
      p_actual_qty,
      p_posting_key,
      p_reason
    );

  if v_retry is not null then
    return v_retry;
  end if;


  return app_private.record_production_output_impl(
    p_tenant_id,
    p_production_order_id,
    p_warehouse_id,
    p_lot_id,
    p_actual_qty,
    p_posting_key,
    p_reason,
    p_occurred_at
  );

end;
$function$;


revoke all
on function public.record_production_output(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  text,
  timestamptz
)
from public, anon;

grant execute
on function public.record_production_output(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  text,
  timestamptz
)
to authenticated, service_role;


-- =========================================================
-- 5. COMMENTS
-- =========================================================

comment on function app_private.retry_existing_production_material_consumption(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  text,
  text
) is
  'Returns the immutable prior Production material-consumption result for an exact same-posting-key retry, including after Production completion. Returns NULL when no prior posting exists.';


comment on function app_private.retry_existing_production_output(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  text
) is
  'Returns the immutable prior Production output result for an exact same-posting-key retry, including after Production completion. Returns NULL when no prior posting exists.';


comment on function public.consume_production_material(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  text,
  text,
  timestamptz
) is
  'Controlled Production material consumption with exact posting-key retry recovery before lifecycle rejection.';


comment on function public.record_production_output(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  text,
  timestamptz
) is
  'Controlled Production output posting with exact posting-key retry recovery before lifecycle rejection.';
