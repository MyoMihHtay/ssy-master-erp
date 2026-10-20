-- MAVORA Manufacturing ERP
-- Migration 015
-- Controlled Production Execution RPC
--
-- Phase 2P-6C
--
-- Initial scope in this candidate:
--   * Controlled Draft -> Released RPC
--   * Controlled Released -> In Progress RPC
--   * production.execute capability enforcement
--   * Server-side lifecycle metadata
--   * Audit log entries
--   * Row locking / retry-safe transitions
--
-- Later sections in this SAME unapplied migration will add:
--   * Material consumption
--   * Production output
--   * Completion
--
-- IMPORTANT:
--   * Migration 014 remains immutable.
--   * No inventory movement is introduced by Release / Start.
--   * Direct authenticated Production Order UPDATE remains revoked.


-- =========================================================
-- 1. PRIVATE PRODUCTION EXECUTION AUTHORIZATION HELPER
-- =========================================================

create or replace function app_private.require_production_execution_access(
  p_tenant_id uuid,
  p_site_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;

  if p_tenant_id is null
     or p_site_id is null then
    raise exception
      'Production tenant and site are required';
  end if;

  if not app_private.has_site_access(
    p_site_id
  ) then
    raise exception
      'Production site access denied';
  end if;

  if not app_private.has_capability(
    p_tenant_id,
    'production.execute',
    p_site_id
  ) then
    raise exception
      'production.execute capability required';
  end if;

end;
$function$;

revoke all
on function app_private.require_production_execution_access(
  uuid,
  uuid
)
from public, anon, authenticated;

grant execute
on function app_private.require_production_execution_access(
  uuid,
  uuid
)
to service_role;


-- =========================================================
-- 2. PRIVATE CONTROLLED RELEASE IMPLEMENTATION
-- =========================================================

create or replace function app_private.release_production_order_impl(
  p_tenant_id uuid,
  p_production_order_id uuid,
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
begin

  if v_user_id is null then
    raise exception
      'Authentication required';
  end if;

  if p_tenant_id is null
     or p_production_order_id is null then
    raise exception
      'Tenant and Production Order are required';
  end if;

  if p_reason is not null
     and length(p_reason) > 2000 then
    raise exception
      'Reason cannot exceed 2000 characters';
  end if;


  -- Serialize lifecycle changes for this order.
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


  -- Retry-safe Release.
  if v_order.status = 'released' then

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'production_order_id', v_order.id,
      'order_no', v_order.order_no,
      'status', v_order.status,
      'released_at', v_order.released_at
    );

  end if;


  if v_order.status <> 'draft' then
    raise exception
      'Only a Draft Production Order can be released';
  end if;


  -- Atomic planning snapshot must exist before execution.
  if not exists (
    select 1
    from public.production_order_materials pom
    where pom.production_order_id = v_order.id
      and pom.tenant_id = v_order.tenant_id
      and pom.site_id = v_order.site_id
  ) then
    raise exception
      'Production Order has no frozen material snapshot';
  end if;


  -- Migration 014 execution traces operate strictly in each
  -- Product base unit until a controlled unit-conversion engine
  -- is introduced.
  if exists (
    select 1
    from public.production_order_materials pom
    join public.products p
      on p.id = pom.input_product_id
     and p.tenant_id = pom.tenant_id
    where pom.production_order_id = v_order.id
      and pom.tenant_id = v_order.tenant_id
      and (
        p.is_active is not true
        or pom.input_unit_id <> p.base_unit_id
      )
  ) then
    raise exception
      'Production material execution requires active Products using their base units';
  end if;


  if not exists (
    select 1
    from public.products p
    where p.id = v_order.output_product_id
      and p.tenant_id = v_order.tenant_id
      and p.is_active = true
      and p.base_unit_id = v_order.output_unit_id
  ) then
    raise exception
      'Production output execution requires an active Product using its base unit';
  end if;


  update public.production_orders
  set
    status = 'released',
    released_at = now(),
    released_by = v_user_id
  where id = v_order.id
    and tenant_id = v_order.tenant_id
  returning *
  into v_order;


  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    reason,
    metadata
  )
  values (
    v_order.tenant_id,
    v_order.site_id,
    v_user_id,
    'production.order_release',
    'production_order',
    v_order.id,
    jsonb_build_object(
      'status',
      'draft'
    ),
    jsonb_build_object(
      'status',
      v_order.status,
      'released_at',
      v_order.released_at,
      'released_by',
      v_order.released_by
    ),
    nullif(btrim(p_reason), ''),
    jsonb_build_object(
      'order_no',
      v_order.order_no
    )
  );


  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'production_order_id', v_order.id,
    'order_no', v_order.order_no,
    'status', v_order.status,
    'released_at', v_order.released_at
  );

end;
$function$;


revoke all
on function app_private.release_production_order_impl(
  uuid,
  uuid,
  text
)
from public, anon, authenticated;

grant execute
on function app_private.release_production_order_impl(
  uuid,
  uuid,
  text
)
to service_role;


-- =========================================================
-- 3. PUBLIC CONTROLLED RELEASE RPC
-- =========================================================

create or replace function public.release_production_order(
  p_tenant_id uuid,
  p_production_order_id uuid,
  p_reason text default null
)
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $function$

  select app_private.release_production_order_impl(
    p_tenant_id,
    p_production_order_id,
    p_reason
  );

$function$;


revoke all
on function public.release_production_order(
  uuid,
  uuid,
  text
)
from public, anon;

grant execute
on function public.release_production_order(
  uuid,
  uuid,
  text
)
to authenticated, service_role;


-- =========================================================
-- 4. PRIVATE CONTROLLED START IMPLEMENTATION
-- =========================================================

create or replace function app_private.start_production_order_impl(
  p_tenant_id uuid,
  p_production_order_id uuid,
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
begin

  if v_user_id is null then
    raise exception
      'Authentication required';
  end if;

  if p_tenant_id is null
     or p_production_order_id is null then
    raise exception
      'Tenant and Production Order are required';
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


  -- Retry-safe Start.
  if v_order.status = 'in_progress' then

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'production_order_id', v_order.id,
      'order_no', v_order.order_no,
      'status', v_order.status,
      'actual_start_at', v_order.actual_start_at
    );

  end if;


  if v_order.status <> 'released' then
    raise exception
      'Only a Released Production Order can be started';
  end if;


  update public.production_orders
  set
    status = 'in_progress',
    actual_start_at = now(),
    started_by = v_user_id
  where id = v_order.id
    and tenant_id = v_order.tenant_id
  returning *
  into v_order;


  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    reason,
    metadata
  )
  values (
    v_order.tenant_id,
    v_order.site_id,
    v_user_id,
    'production.order_start',
    'production_order',
    v_order.id,
    jsonb_build_object(
      'status',
      'released'
    ),
    jsonb_build_object(
      'status',
      v_order.status,
      'actual_start_at',
      v_order.actual_start_at,
      'started_by',
      v_order.started_by
    ),
    nullif(btrim(p_reason), ''),
    jsonb_build_object(
      'order_no',
      v_order.order_no
    )
  );


  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'production_order_id', v_order.id,
    'order_no', v_order.order_no,
    'status', v_order.status,
    'actual_start_at', v_order.actual_start_at
  );

end;
$function$;


revoke all
on function app_private.start_production_order_impl(
  uuid,
  uuid,
  text
)
from public, anon, authenticated;

grant execute
on function app_private.start_production_order_impl(
  uuid,
  uuid,
  text
)
to service_role;


-- =========================================================
-- 5. PUBLIC CONTROLLED START RPC
-- =========================================================

create or replace function public.start_production_order(
  p_tenant_id uuid,
  p_production_order_id uuid,
  p_reason text default null
)
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $function$

  select app_private.start_production_order_impl(
    p_tenant_id,
    p_production_order_id,
    p_reason
  );

$function$;


revoke all
on function public.start_production_order(
  uuid,
  uuid,
  text
)
from public, anon;

grant execute
on function public.start_production_order(
  uuid,
  uuid,
  text
)
to authenticated, service_role;


-- =========================================================
-- 6. COMMENTS
-- =========================================================

comment on function public.release_production_order(
  uuid,
  uuid,
  text
) is
  'Controlled Production Order Draft-to-Released transition. Requires production.execute and creates no Inventory movement.';

comment on function public.start_production_order(
  uuid,
  uuid,
  text
) is
  'Controlled Production Order Released-to-In-Progress transition. Requires production.execute and creates no Inventory movement.';



-- =========================================================
-- 7. CONTROLLED MATERIAL CONSUMPTION IMPLEMENTATION
-- =========================================================
--
-- IMPORTANT:
-- The trusted Inventory posting engine remains authoritative.
-- Therefore production.consume requires:
--   * production.execute
--   * inventory.post
--   * site / warehouse access
--   * released input lot for tracked materials
--
-- The Inventory movement + Production trace are written
-- inside the SAME transaction.


create or replace function app_private.consume_production_material_impl(
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
  v_user_id uuid := auth.uid();

  v_order public.production_orders%rowtype;
  v_material public.production_order_materials%rowtype;

  v_movement jsonb;
  v_movement_id uuid;

  v_existing
    public.production_order_material_consumptions%rowtype;

  v_trace_id uuid;
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


  -- Serialize execution changes for this Production Order.
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


  if v_order.status <> 'in_progress' then
    raise exception
      'Material consumption requires an In Progress Production Order';
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


  -- Existing private Inventory engine remains the only stock
  -- balance / ledger posting authority.
  v_movement :=
    app_private.post_inventory_movement_impl(
      v_order.tenant_id,
      p_warehouse_id,
      v_material.input_product_id,
      'production_consume',
      p_actual_qty,
      p_posting_key,
      p_lot_id,
      null,
      'production_order',
      v_order.id::text,
      nullif(btrim(p_reason), ''),
      p_occurred_at
    );


  v_movement_id :=
    (v_movement ->> 'movement_id')::uuid;


  -- Retry-safe Production trace.
  select poc.*
  into v_existing
  from public.production_order_material_consumptions poc
  where poc.inventory_movement_id = v_movement_id
    and poc.tenant_id = v_order.tenant_id;

  if found then

    if v_existing.production_order_id <> v_order.id
       or v_existing.production_order_material_id <> v_material.id
       or v_existing.warehouse_id <> p_warehouse_id
       or v_existing.input_product_id <> v_material.input_product_id
       or v_existing.input_unit_id <> v_material.input_unit_id
       or v_existing.lot_id is distinct from p_lot_id
       or v_existing.actual_qty <> p_actual_qty
       or v_existing.variance_reason
            is distinct from nullif(btrim(p_variance_reason), '')
    then
      raise exception
        'Production consumption posting key is already linked to different trace data';
    end if;

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'production_order_id', v_order.id,
      'production_order_material_id', v_material.id,
      'consumption_id', v_existing.id,
      'inventory_movement_id', v_movement_id,
      'actual_qty', v_existing.actual_qty
    );

  end if;


  insert into public.production_order_material_consumptions (
    tenant_id,
    site_id,
    production_order_id,
    production_order_material_id,
    warehouse_id,
    input_product_id,
    input_unit_id,
    lot_id,
    actual_qty,
    inventory_movement_id,
    variance_reason
  )
  values (
    v_order.tenant_id,
    v_order.site_id,
    v_order.id,
    v_material.id,
    p_warehouse_id,
    v_material.input_product_id,
    v_material.input_unit_id,
    p_lot_id,
    p_actual_qty,
    v_movement_id,
    nullif(btrim(p_variance_reason), '')
  )
  returning id
  into v_trace_id;


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
    v_order.tenant_id,
    v_order.site_id,
    v_user_id,
    'production.material_consume',
    'production_order_material_consumption',
    v_trace_id,
    jsonb_build_object(
      'production_order_id',
      v_order.id,
      'production_order_material_id',
      v_material.id,
      'warehouse_id',
      p_warehouse_id,
      'lot_id',
      p_lot_id,
      'actual_qty',
      p_actual_qty,
      'inventory_movement_id',
      v_movement_id
    ),
    nullif(btrim(p_reason), ''),
    jsonb_build_object(
      'order_no',
      v_order.order_no,
      'planned_qty',
      v_material.planned_qty,
      'variance_reason',
      nullif(btrim(p_variance_reason), '')
    )
  );


  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'production_order_id', v_order.id,
    'production_order_material_id', v_material.id,
    'consumption_id', v_trace_id,
    'inventory_movement_id', v_movement_id,
    'actual_qty', p_actual_qty
  );

end;
$function$;


revoke all
on function app_private.consume_production_material_impl(
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
from public, anon, authenticated;

grant execute
on function app_private.consume_production_material_impl(
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
to service_role;


-- =========================================================
-- 8. PUBLIC CONTROLLED MATERIAL CONSUMPTION RPC
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
language sql
security definer
set search_path = pg_catalog
as $function$

  select app_private.consume_production_material_impl(
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
-- 9. CONTROLLED PRODUCTION OUTPUT IMPLEMENTATION
-- =========================================================
--
-- The output lot/batch must already exist in QUARANTINE.
-- Lot creation and Quality disposition remain separate
-- controlled workflows.


create or replace function app_private.record_production_output_impl(
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
  v_user_id uuid := auth.uid();

  v_order public.production_orders%rowtype;

  v_movement jsonb;
  v_movement_id uuid;

  v_existing public.production_order_outputs%rowtype;

  v_output_id uuid;
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


  if v_order.status <> 'in_progress' then
    raise exception
      'Production output requires an In Progress Production Order';
  end if;


  v_movement :=
    app_private.post_inventory_movement_impl(
      v_order.tenant_id,
      p_warehouse_id,
      v_order.output_product_id,
      'production_output',
      p_actual_qty,
      p_posting_key,
      p_lot_id,
      null,
      'production_order',
      v_order.id::text,
      nullif(btrim(p_reason), ''),
      p_occurred_at
    );


  v_movement_id :=
    (v_movement ->> 'movement_id')::uuid;


  select poo.*
  into v_existing
  from public.production_order_outputs poo
  where poo.inventory_movement_id = v_movement_id
    and poo.tenant_id = v_order.tenant_id;

  if found then

    if v_existing.production_order_id <> v_order.id
       or v_existing.warehouse_id <> p_warehouse_id
       or v_existing.output_product_id <> v_order.output_product_id
       or v_existing.output_unit_id <> v_order.output_unit_id
       or v_existing.lot_id is distinct from p_lot_id
       or v_existing.actual_qty <> p_actual_qty
    then
      raise exception
        'Production output posting key is already linked to different trace data';
    end if;

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'production_order_id', v_order.id,
      'output_id', v_existing.id,
      'inventory_movement_id', v_movement_id,
      'actual_qty', v_existing.actual_qty
    );

  end if;


  insert into public.production_order_outputs (
    tenant_id,
    site_id,
    production_order_id,
    warehouse_id,
    output_product_id,
    output_unit_id,
    lot_id,
    actual_qty,
    inventory_movement_id
  )
  values (
    v_order.tenant_id,
    v_order.site_id,
    v_order.id,
    p_warehouse_id,
    v_order.output_product_id,
    v_order.output_unit_id,
    p_lot_id,
    p_actual_qty,
    v_movement_id
  )
  returning id
  into v_output_id;


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
    v_order.tenant_id,
    v_order.site_id,
    v_user_id,
    'production.output_record',
    'production_order_output',
    v_output_id,
    jsonb_build_object(
      'production_order_id',
      v_order.id,
      'warehouse_id',
      p_warehouse_id,
      'lot_id',
      p_lot_id,
      'actual_qty',
      p_actual_qty,
      'inventory_movement_id',
      v_movement_id
    ),
    nullif(btrim(p_reason), ''),
    jsonb_build_object(
      'order_no',
      v_order.order_no,
      'planned_qty',
      v_order.planned_qty
    )
  );


  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'production_order_id', v_order.id,
    'output_id', v_output_id,
    'inventory_movement_id', v_movement_id,
    'actual_qty', p_actual_qty
  );

end;
$function$;


revoke all
on function app_private.record_production_output_impl(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  text,
  timestamptz
)
from public, anon, authenticated;

grant execute
on function app_private.record_production_output_impl(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  text,
  timestamptz
)
to service_role;


-- =========================================================
-- 10. PUBLIC CONTROLLED PRODUCTION OUTPUT RPC
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
language sql
security definer
set search_path = pg_catalog
as $function$

  select app_private.record_production_output_impl(
    p_tenant_id,
    p_production_order_id,
    p_warehouse_id,
    p_lot_id,
    p_actual_qty,
    p_posting_key,
    p_reason,
    p_occurred_at
  );

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
-- 11. CONTROLLED COMPLETION IMPLEMENTATION
-- =========================================================

create or replace function app_private.complete_production_order_impl(
  p_tenant_id uuid,
  p_production_order_id uuid,
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

  v_output_qty numeric(20,6);
  v_yield_pct numeric(20,6);
begin

  if v_user_id is null then
    raise exception
      'Authentication required';
  end if;

  if p_tenant_id is null
     or p_production_order_id is null then
    raise exception
      'Tenant and Production Order are required';
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


  -- Retry-safe Completion.
  if v_order.status = 'completed' then

    select coalesce(sum(poo.actual_qty), 0)
    into v_output_qty
    from public.production_order_outputs poo
    where poo.production_order_id = v_order.id
      and poo.tenant_id = v_order.tenant_id;

    v_yield_pct :=
      round(
        (
          v_output_qty
          / v_order.planned_qty
          * 100
        )::numeric,
        6
      );

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'production_order_id', v_order.id,
      'order_no', v_order.order_no,
      'status', v_order.status,
      'actual_output_qty', v_output_qty,
      'yield_pct', v_yield_pct,
      'completed_at', v_order.completed_at
    );

  end if;


  if v_order.status <> 'in_progress' then
    raise exception
      'Only an In Progress Production Order can be completed';
  end if;


  -- Every mandatory frozen BOM line must have at least one
  -- actual consumption trace.
  if exists (
    select 1
    from public.production_order_materials pom
    join public.production_recipe_components prc
      on prc.id = pom.source_component_id
     and prc.tenant_id = pom.tenant_id
    where pom.production_order_id = v_order.id
      and pom.tenant_id = v_order.tenant_id
      and prc.is_optional = false
      and not exists (
        select 1
        from public.production_order_material_consumptions poc
        where poc.production_order_material_id = pom.id
          and poc.production_order_id = v_order.id
          and poc.tenant_id = v_order.tenant_id
      )
  ) then
    raise exception
      'All mandatory Production materials require consumption traces before completion';
  end if;


  -- A mandatory material line may legitimately consume more
  -- or less than planned. When it does, a variance reason must
  -- be captured on at least one trace for that BOM line.
  if exists (
    select 1
    from public.production_order_materials pom
    join public.production_recipe_components prc
      on prc.id = pom.source_component_id
     and prc.tenant_id = pom.tenant_id
    cross join lateral (
      select
        coalesce(sum(poc.actual_qty), 0) as actual_qty,
        coalesce(
          bool_or(
            nullif(
              btrim(poc.variance_reason),
              ''
            ) is not null
          ),
          false
        ) as has_variance_reason
      from public.production_order_material_consumptions poc
      where poc.production_order_material_id = pom.id
        and poc.production_order_id = v_order.id
        and poc.tenant_id = v_order.tenant_id
    ) actual
    where pom.production_order_id = v_order.id
      and pom.tenant_id = v_order.tenant_id
      and prc.is_optional = false
      and abs(
        actual.actual_qty
        - pom.planned_qty
      ) > 0.000001
      and actual.has_variance_reason is not true
  ) then
    raise exception
      'Material variance reason is required when actual consumption differs from planned quantity';
  end if;


  select coalesce(sum(poo.actual_qty), 0)
  into v_output_qty
  from public.production_order_outputs poo
  where poo.production_order_id = v_order.id
    and poo.tenant_id = v_order.tenant_id;


  if v_output_qty <= 0 then
    raise exception
      'Production completion requires recorded output';
  end if;


  -- Yield variance is allowed, but must be explained.
  if abs(
       v_output_qty
       - v_order.planned_qty
     ) > 0.000001
     and (
       p_reason is null
       or btrim(p_reason) = ''
     )
  then
    raise exception
      'Completion reason is required when actual output differs from planned quantity';
  end if;


  update public.production_orders
  set
    status = 'completed',
    actual_end_at = now(),
    completed_at = now(),
    completed_by = v_user_id
  where id = v_order.id
    and tenant_id = v_order.tenant_id
  returning *
  into v_order;


  v_yield_pct :=
    round(
      (
        v_output_qty
        / v_order.planned_qty
        * 100
      )::numeric,
      6
    );


  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    reason,
    metadata
  )
  values (
    v_order.tenant_id,
    v_order.site_id,
    v_user_id,
    'production.order_complete',
    'production_order',
    v_order.id,
    jsonb_build_object(
      'status',
      'in_progress'
    ),
    jsonb_build_object(
      'status',
      v_order.status,
      'actual_end_at',
      v_order.actual_end_at,
      'completed_at',
      v_order.completed_at,
      'completed_by',
      v_order.completed_by
    ),
    nullif(btrim(p_reason), ''),
    jsonb_build_object(
      'order_no',
      v_order.order_no,
      'planned_qty',
      v_order.planned_qty,
      'actual_output_qty',
      v_output_qty,
      'yield_pct',
      v_yield_pct
    )
  );


  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'production_order_id', v_order.id,
    'order_no', v_order.order_no,
    'status', v_order.status,
    'actual_output_qty', v_output_qty,
    'yield_pct', v_yield_pct,
    'completed_at', v_order.completed_at
  );

end;
$function$;


revoke all
on function app_private.complete_production_order_impl(
  uuid,
  uuid,
  text
)
from public, anon, authenticated;

grant execute
on function app_private.complete_production_order_impl(
  uuid,
  uuid,
  text
)
to service_role;


-- =========================================================
-- 12. PUBLIC CONTROLLED COMPLETION RPC
-- =========================================================

create or replace function public.complete_production_order(
  p_tenant_id uuid,
  p_production_order_id uuid,
  p_reason text default null
)
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $function$

  select app_private.complete_production_order_impl(
    p_tenant_id,
    p_production_order_id,
    p_reason
  );

$function$;


revoke all
on function public.complete_production_order(
  uuid,
  uuid,
  text
)
from public, anon;

grant execute
on function public.complete_production_order(
  uuid,
  uuid,
  text
)
to authenticated, service_role;


-- =========================================================
-- 13. EXECUTION RPC COMMENTS
-- =========================================================

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
  'Atomically posts a production_consume Inventory movement and immutable Production material trace. Requires production.execute plus existing Inventory posting authorization.';

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
  'Atomically posts a production_output Inventory movement and immutable Production output trace into a QUARANTINE warehouse/lot.';

comment on function public.complete_production_order(
  uuid,
  uuid,
  text
) is
  'Completes an In Progress Production Order after mandatory material consumption and Production output validation.';

