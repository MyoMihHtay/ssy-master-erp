-- MAVORA Manufacturing ERP
-- Migration 011
-- Simple Inventory Receive Workflow
--
-- User goal:
--   One Receive action from the UI.
--
-- Backend guarantees:
--   * tracked products create/reuse Lot/Batch
--   * tracked receipts enter Quarantine warehouse
--   * stock receipt uses the atomic ledger engine
--   * lot + receipt happen in one database transaction
--   * permissions and audit controls remain enforced
--
-- This does NOT weaken existing inventory or QC controls.


-- =========================================================
-- 1. PRIVATE SIMPLE RECEIVE IMPLEMENTATION
-- =========================================================

create or replace function app_private.receive_inventory_impl(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_unit_cost numeric,
  p_posting_key text,
  p_lot_no text default null,
  p_batch_no text default null,
  p_manufactured_at date default null,
  p_expires_at date default null,
  p_reference_id text default null,
  p_notes text default null,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();

  v_tracking_mode text;
  v_warehouse_type text;

  v_lot_result jsonb;
  v_move_result jsonb;

  v_lot_id uuid;
  v_lot_status text;
  v_lot_create_idempotent boolean := false;
  v_existing_receive_count integer := 0;

  v_auto_token text;
  v_effective_lot_no text;
  v_effective_batch_no text;
begin
  -- -------------------------------------------------------
  -- Authentication
  -- -------------------------------------------------------

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;


  -- -------------------------------------------------------
  -- Simple Receive input validation
  -- -------------------------------------------------------

  if p_quantity is null
     or p_quantity <= 0 then
    raise exception
      'Quantity must be greater than zero';
  end if;

  if p_unit_cost is null
     or p_unit_cost < 0 then
    raise exception
      'Unit cost is required and cannot be negative';
  end if;

  if p_posting_key is null
     or btrim(p_posting_key) = '' then
    raise exception
      'Posting key is required';
  end if;

  if p_notes is not null
     and length(p_notes) > 2000 then
    raise exception
      'Notes cannot exceed 2000 characters';
  end if;

  if p_manufactured_at is not null
     and p_manufactured_at > current_date then
    raise exception
      'Manufacture date cannot be in the future';
  end if;

  if p_expires_at is not null
     and p_expires_at <= current_date then
    raise exception
      'Expired stock cannot be received through Simple Receive';
  end if;


  -- -------------------------------------------------------
  -- Product
  -- -------------------------------------------------------

  select p.tracking_mode
    into v_tracking_mode
  from public.products p
  where p.id = p_product_id
    and p.tenant_id = p_tenant_id
    and p.is_active = true;

  if not found then
    raise exception
      'Active product not found for tenant';
  end if;


  -- -------------------------------------------------------
  -- Warehouse
  -- -------------------------------------------------------

  select w.warehouse_type
    into v_warehouse_type
  from public.warehouses w
  where w.id = p_warehouse_id
    and w.tenant_id = p_tenant_id
    and w.is_active = true;

  if not found then
    raise exception
      'Active warehouse not found for tenant';
  end if;


  -- -------------------------------------------------------
  -- TRACKED PRODUCT
  -- Create/reuse Lot/Batch first.
  -- New tracked stock must physically enter Quarantine.
  -- -------------------------------------------------------

  if v_tracking_mode in ('lot', 'batch') then

    if v_warehouse_type <> 'QUARANTINE' then
      raise exception
        'Tracked product receipts must enter a Quarantine warehouse';
    end if;

    -- Users may provide supplier/production identifiers.
    -- Otherwise MAVORA creates deterministic identifiers from
    -- the posting key, so an exact retry generates the same Lot.
    v_auto_token :=
      upper(
        substr(
          pg_catalog.md5(
            p_tenant_id::text
            || '|'
            || p_product_id::text
            || '|'
            || btrim(p_posting_key)
          ),
          1,
          12
        )
      );

    v_effective_lot_no :=
      coalesce(
        nullif(btrim(p_lot_no), ''),
        'LOT-' || v_auto_token
      );

    if v_tracking_mode = 'batch' then
      v_effective_batch_no :=
        coalesce(
          nullif(btrim(p_batch_no), ''),
          'BAT-' || v_auto_token
        );
    else
      v_effective_batch_no :=
        nullif(btrim(p_batch_no), '');
    end if;

    select app_private.create_inventory_lot_impl(
      p_tenant_id,
      p_product_id,
      v_effective_lot_no,
      v_effective_batch_no,
      p_manufactured_at,
      p_expires_at,
      p_notes
    )
    into v_lot_result;

    v_lot_id :=
      (v_lot_result ->> 'lot_id')::uuid;

    v_lot_status :=
      v_lot_result ->> 'status';

    v_lot_create_idempotent :=
      coalesce(
        (v_lot_result ->> 'idempotent')::boolean,
        false
      );

    -- New receipts may only enter an actively quarantined lot.
    --
    -- Exception:
    -- an exact retry of an already-posted receive is allowed
    -- even if QC changed the lot status afterwards.
    if v_lot_status <> 'quarantine' then

      if not v_lot_create_idempotent then
        raise exception
          'Tracked receipt requires a Quarantine lot/batch';
      end if;

      select count(*)
        into v_existing_receive_count
      from public.inventory_movements im
      where im.tenant_id = p_tenant_id
        and im.warehouse_id = p_warehouse_id
        and im.product_id = p_product_id
        and im.lot_id = v_lot_id
        and im.posting_key = btrim(p_posting_key)
        and im.movement_type = 'receipt';

      if v_existing_receive_count = 0 then
        raise exception
          'Existing lot/batch must return to Quarantine before receiving additional stock';
      end if;

    end if;


  -- -------------------------------------------------------
  -- NON-TRACKED PRODUCT
  -- Lot fields are not allowed.
  -- -------------------------------------------------------

  else

    if nullif(btrim(p_lot_no), '') is not null
       or nullif(btrim(p_batch_no), '') is not null
       or p_manufactured_at is not null
       or p_expires_at is not null then
      raise exception
        'Lot/Batch fields are not allowed for non-tracked products';
    end if;

    v_lot_id := null;
    v_lot_result := null;

  end if;


  -- -------------------------------------------------------
  -- ATOMIC INVENTORY RECEIPT
  -- Existing controlled posting engine performs:
  -- authorization, warehouse access, balance locking,
  -- weighted average costing, ledger and audit.
  -- -------------------------------------------------------

  select app_private.post_inventory_movement_impl(
    p_tenant_id,
    p_warehouse_id,
    p_product_id,
    'receipt',
    p_quantity,
    p_posting_key,
    v_lot_id,
    p_unit_cost,
    'simple_receive',
    nullif(btrim(p_reference_id), ''),
    nullif(btrim(p_notes), ''),
    coalesce(p_occurred_at, now())
  )
  into v_move_result;


  -- -------------------------------------------------------
  -- RESPONSE
  -- -------------------------------------------------------

  return jsonb_build_object(
    'ok', true,
    'workflow', 'simple_receive',
    'tracked', v_tracking_mode in ('lot', 'batch'),
    'tracking_mode', v_tracking_mode,
    'warehouse_type', v_warehouse_type,
    'lot_id', v_lot_id,
    'lot_no',
      case
        when v_lot_id is null then null
        else v_effective_lot_no
      end,
    'batch_no',
      case
        when v_lot_id is null then null
        else v_effective_batch_no
      end,
    'lot_status', v_lot_status,
    'lot', v_lot_result,
    'movement', v_move_result,
    'idempotent',
      coalesce(
        (v_move_result ->> 'idempotent')::boolean,
        false
      )
  );
end;
$function$;


-- =========================================================
-- 2. PUBLIC SECURITY-INVOKER WRAPPER
-- =========================================================

create or replace function public.receive_inventory(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_unit_cost numeric,
  p_posting_key text,
  p_lot_no text default null,
  p_batch_no text default null,
  p_manufactured_at date default null,
  p_expires_at date default null,
  p_reference_id text default null,
  p_notes text default null,
  p_occurred_at timestamptz default now()
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$
  select app_private.receive_inventory_impl(
    p_tenant_id,
    p_warehouse_id,
    p_product_id,
    p_quantity,
    p_unit_cost,
    p_posting_key,
    p_lot_no,
    p_batch_no,
    p_manufactured_at,
    p_expires_at,
    p_reference_id,
    p_notes,
    p_occurred_at
  );
$function$;


-- =========================================================
-- 3. FUNCTION ACCESS
-- =========================================================

revoke all
on function app_private.receive_inventory_impl(
  uuid,
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  text,
  text,
  date,
  date,
  text,
  text,
  timestamptz
)
from public, anon;

grant execute
on function app_private.receive_inventory_impl(
  uuid,
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  text,
  text,
  date,
  date,
  text,
  text,
  timestamptz
)
to authenticated, service_role;


revoke all
on function public.receive_inventory(
  uuid,
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  text,
  text,
  date,
  date,
  text,
  text,
  timestamptz
)
from public, anon;

grant execute
on function public.receive_inventory(
  uuid,
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  text,
  text,
  date,
  date,
  text,
  text,
  timestamptz
)
to authenticated, service_role;

