-- MAVORA Manufacturing ERP
-- Migration 019
-- Controlled Production Cancellation
--
-- Scope:
--   * Draft -> Cancelled only
--   * production.execute capability required
--   * Mandatory cancellation reason
--   * Server-controlled lifecycle metadata
--   * Audit trail
--   * Retry-safe cancellation
--
-- Explicitly NOT included:
--   * Released Order cancellation
--   * In Progress Order cancellation
--   * Inventory reversal
--   * Consumption reversal
--   * Output reversal
--   * Cost reversal
--
-- Existing lifecycle guard remains authoritative.


-- =========================================================
-- 1. PRIVATE CONTROLLED CANCELLATION IMPLEMENTATION
-- =========================================================

create or replace function app_private.cancel_production_order_impl(
  p_tenant_id uuid,
  p_production_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_order public.production_orders%rowtype;
  v_reason text;
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


  v_reason := nullif(
    btrim(p_reason),
    ''
  );


  if v_reason is null then
    raise exception
      'Cancellation reason is required';
  end if;


  if length(v_reason) > 2000 then
    raise exception
      'Cancellation reason cannot exceed 2000 characters';
  end if;


  -- Serialize lifecycle changes for this Production Order.
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


  -- Retry-safe cancellation.
  --
  -- Once cancelled, the Order is immutable. Repeating the same
  -- cancellation action therefore returns the existing terminal
  -- lifecycle state without creating another Audit Log row.
  if v_order.status = 'cancelled' then

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'production_order_id', v_order.id,
      'order_no', v_order.order_no,
      'status', v_order.status,
      'cancelled_at', v_order.cancelled_at,
      'cancelled_by', v_order.cancelled_by
    );

  end if;


  if v_order.status <> 'draft' then
    raise exception
      'Only a Draft Production Order can be cancelled';
  end if;


  -- Existing lifecycle trigger validates:
  --   draft -> cancelled
  --   cancelled_at populated
  --   cancelled_by = auth.uid()
  --   no Release / Start / Complete metadata present.
  update public.production_orders
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = v_user_id
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
    'production.order_cancel',
    'production_order',
    v_order.id,
    jsonb_build_object(
      'status',
      'draft'
    ),
    jsonb_build_object(
      'status',
      v_order.status,
      'cancelled_at',
      v_order.cancelled_at,
      'cancelled_by',
      v_order.cancelled_by
    ),
    v_reason,
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
    'order_no', v_order.order_no,
    'status', v_order.status,
    'cancelled_at', v_order.cancelled_at,
    'cancelled_by', v_order.cancelled_by
  );

end;
$function$;


revoke all
on function app_private.cancel_production_order_impl(
  uuid,
  uuid,
  text
)
from public, anon, authenticated;


grant execute
on function app_private.cancel_production_order_impl(
  uuid,
  uuid,
  text
)
to service_role;


-- =========================================================
-- 2. PUBLIC CONTROLLED CANCELLATION RPC
-- =========================================================

create or replace function public.cancel_production_order(
  p_tenant_id uuid,
  p_production_order_id uuid,
  p_reason text
)
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $function$

  select app_private.cancel_production_order_impl(
    p_tenant_id,
    p_production_order_id,
    p_reason
  );

$function$;


revoke all
on function public.cancel_production_order(
  uuid,
  uuid,
  text
)
from public, anon;


grant execute
on function public.cancel_production_order(
  uuid,
  uuid,
  text
)
to authenticated, service_role;


-- =========================================================
-- 3. COMMENTS
-- =========================================================

comment on function app_private.cancel_production_order_impl(
  uuid,
  uuid,
  text
) is
  'Private controlled Draft-to-Cancelled Production Order transition with mandatory reason, production.execute authorization, audit logging and retry-safe terminal-state handling.';


comment on function public.cancel_production_order(
  uuid,
  uuid,
  text
) is
  'Controlled Draft-to-Cancelled Production Order RPC. Requires production.execute. Released, In Progress and Completed Orders cannot be cancelled.';
