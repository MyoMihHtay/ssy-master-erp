-- MAVORA Manufacturing ERP
-- Migration 020
-- Controlled Production Output Lot Creation
--
-- Purpose:
--   Allow a Production execution user to create the tracked
--   output Lot / Batch required by a Production Order without
--   granting broad inventory.lot_manage capability.
--
-- Scope:
--   * Production Order output product only
--   * production.execute authorization
--   * New Lots always start in QUARANTINE
--   * New creation allowed only while Order is IN PROGRESS
--   * Exact retry is allowed only when the existing Lot was
--     previously created for the same Production Order
--   * Generic Lot Management workflow remains unchanged


-- =========================================================
-- 1. PRIVATE CONTROLLED OUTPUT LOT CREATION
-- =========================================================

create or replace function app_private.create_production_output_lot_impl(
  p_tenant_id uuid,
  p_production_order_id uuid,
  p_lot_no text,
  p_batch_no text default null,
  p_manufactured_at date default null,
  p_expires_at date default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();

  v_order public.production_orders%rowtype;
  v_product public.products%rowtype;

  v_lot_no text;
  v_batch_no text;
  v_notes text;

  v_existing public.inventory_lots%rowtype;
  v_lot public.inventory_lots%rowtype;
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


  v_lot_no :=
    nullif(
      btrim(p_lot_no),
      ''
    );

  v_batch_no :=
    nullif(
      btrim(p_batch_no),
      ''
    );

  v_notes :=
    nullif(
      btrim(p_notes),
      ''
    );


  if v_lot_no is null then
    raise exception
      'Output Lot number is required';
  end if;


  if length(v_lot_no) > 200 then
    raise exception
      'Output Lot number cannot exceed 200 characters';
  end if;


  if v_batch_no is not null
     and length(v_batch_no) > 200 then
    raise exception
      'Output Batch number cannot exceed 200 characters';
  end if;


  if v_notes is not null
     and length(v_notes) > 2000 then
    raise exception
      'Output Lot notes cannot exceed 2000 characters';
  end if;


  if p_expires_at is not null
     and p_manufactured_at is not null
     and p_expires_at < p_manufactured_at then
    raise exception
      'Expiry date cannot be earlier than manufacture date';
  end if;


  -- Lock the Production Order so lifecycle cannot change while
  -- the output Lot is being validated / created.
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
    v_order.tenant_id,
    v_order.site_id
  );


  select p.*
  into v_product
  from public.products p
  where p.id = v_order.output_product_id
    and p.tenant_id = v_order.tenant_id
    and p.is_active = true;


  if not found then
    raise exception
      'Active Production output product not found';
  end if;


  if v_product.tracking_mode = 'none' then
    raise exception
      'Production output product is not configured for Lot / Batch tracking';
  end if;


  if v_product.tracking_mode = 'batch'
     and v_batch_no is null then
    raise exception
      'Batch number is required for this Production output product';
  end if;


  -- Serialize create / retry requests for the same output Lot.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'production-output-lot|'
      || v_order.tenant_id::text
      || '|'
      || v_order.output_product_id::text
      || '|'
      || v_lot_no,
      0
    )
  );


  select il.*
  into v_existing
  from public.inventory_lots il
  where il.tenant_id = v_order.tenant_id
    and il.product_id = v_order.output_product_id
    and il.lot_no = v_lot_no;


  if found then

    -- Never adopt an unrelated Lot merely because the number
    -- happens to match. It must have been created by this exact
    -- controlled Production Order workflow.
    if not exists (
      select 1
      from public.audit_logs al
      where al.tenant_id = v_order.tenant_id
        and al.action = 'production.output_lot_create'
        and al.entity_type = 'inventory_lot'
        and al.entity_id = v_existing.id
        and al.metadata ->> 'production_order_id'
              = v_order.id::text
    ) then
      raise exception
        'Output Lot number already exists outside this Production Order';
    end if;


    if v_existing.batch_no
         is distinct from v_batch_no
       or v_existing.manufactured_at
         is distinct from p_manufactured_at
       or v_existing.expires_at
         is distinct from p_expires_at
       or v_existing.notes
         is distinct from v_notes then
      raise exception
        'Output Lot number already exists with different data';
    end if;


    if v_order.status not in (
      'in_progress',
      'completed'
    ) then
      raise exception
        'Existing Production output Lot retry is not valid for the current Order status';
    end if;


    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'production_order_id', v_order.id,
      'order_no', v_order.order_no,
      'lot_id', v_existing.id,
      'product_id', v_existing.product_id,
      'tracking_mode', v_product.tracking_mode,
      'lot_no', v_existing.lot_no,
      'batch_no', v_existing.batch_no,
      'manufactured_at', v_existing.manufactured_at,
      'expires_at', v_existing.expires_at,
      'status', v_existing.status
    );

  end if;


  -- A NEW output Lot may only be created for an Order that is
  -- actively executing. Draft / Released / Completed / Cancelled
  -- Orders cannot generate new Production output Lots.
  if v_order.status <> 'in_progress' then
    raise exception
      'New Production output Lot can only be created for an In Progress Order';
  end if;


  insert into public.inventory_lots (
    tenant_id,
    product_id,
    lot_no,
    batch_no,
    manufactured_at,
    expires_at,
    status,
    notes
  )
  values (
    v_order.tenant_id,
    v_order.output_product_id,
    v_lot_no,
    v_batch_no,
    p_manufactured_at,
    p_expires_at,
    'quarantine',
    v_notes
  )
  returning *
  into v_lot;


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
    'production.output_lot_create',
    'inventory_lot',
    v_lot.id,
    jsonb_build_object(
      'product_id',
      v_lot.product_id,
      'lot_no',
      v_lot.lot_no,
      'batch_no',
      v_lot.batch_no,
      'manufactured_at',
      v_lot.manufactured_at,
      'expires_at',
      v_lot.expires_at,
      'status',
      v_lot.status
    ),
    'Controlled Production output Lot creation',
    jsonb_build_object(
      'production_order_id',
      v_order.id,
      'order_no',
      v_order.order_no,
      'output_product_id',
      v_order.output_product_id,
      'tracking_mode',
      v_product.tracking_mode
    )
  );


  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'production_order_id', v_order.id,
    'order_no', v_order.order_no,
    'lot_id', v_lot.id,
    'product_id', v_lot.product_id,
    'tracking_mode', v_product.tracking_mode,
    'lot_no', v_lot.lot_no,
    'batch_no', v_lot.batch_no,
    'manufactured_at', v_lot.manufactured_at,
    'expires_at', v_lot.expires_at,
    'status', v_lot.status
  );

end;
$function$;


revoke all
on function app_private.create_production_output_lot_impl(
  uuid,
  uuid,
  text,
  text,
  date,
  date,
  text
)
from public, anon, authenticated;


grant execute
on function app_private.create_production_output_lot_impl(
  uuid,
  uuid,
  text,
  text,
  date,
  date,
  text
)
to service_role;


-- =========================================================
-- 2. PUBLIC CONTROLLED RPC
-- =========================================================

create or replace function public.create_production_output_lot(
  p_tenant_id uuid,
  p_production_order_id uuid,
  p_lot_no text,
  p_batch_no text default null,
  p_manufactured_at date default null,
  p_expires_at date default null,
  p_notes text default null
)
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $function$

  select app_private.create_production_output_lot_impl(
    p_tenant_id,
    p_production_order_id,
    p_lot_no,
    p_batch_no,
    p_manufactured_at,
    p_expires_at,
    p_notes
  );

$function$;


revoke all
on function public.create_production_output_lot(
  uuid,
  uuid,
  text,
  text,
  date,
  date,
  text
)
from public, anon;


grant execute
on function public.create_production_output_lot(
  uuid,
  uuid,
  text,
  text,
  date,
  date,
  text
)
to authenticated, service_role;


-- =========================================================
-- 3. COMMENTS
-- =========================================================

comment on function app_private.create_production_output_lot_impl(
  uuid,
  uuid,
  text,
  text,
  date,
  date,
  text
) is
  'Creates only the tracked output Lot/Batch belonging to an authorized In Progress Production Order. New Lots always start in Quarantine and retries require an existing Production Order audit linkage.';


comment on function public.create_production_output_lot(
  uuid,
  uuid,
  text,
  text,
  date,
  date,
  text
) is
  'Controlled Production output Lot/Batch creation RPC. Uses production.execute authorization and does not grant generic inventory.lot_manage permission.';
