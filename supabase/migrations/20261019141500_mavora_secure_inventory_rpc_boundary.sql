-- MAVORA Manufacturing ERP
-- Migration 009
-- Secure Inventory RPC Boundary
--
-- Goal:
--   * move privileged SECURITY DEFINER implementations out of public API schema
--   * expose only SECURITY INVOKER wrappers in public
--   * preserve authenticated access through controlled RPC
--   * keep direct inventory ledger writes closed

-- =========================================================
-- 1. MOVE PRIVILEGED IMPLEMENTATIONS TO PRIVATE SCHEMA
-- =========================================================

alter function public.post_inventory_movement(
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
set schema app_private;

alter function app_private.post_inventory_movement(
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
rename to post_inventory_movement_impl;


alter function public.post_inventory_transfer(
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
set schema app_private;

alter function app_private.post_inventory_transfer(
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
rename to post_inventory_transfer_impl;


-- =========================================================
-- 2. HARDEN PRIVATE IMPLEMENTATIONS
-- =========================================================

revoke all
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
from public, anon;

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
to authenticated, service_role;


revoke all
on function app_private.post_inventory_transfer_impl(
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
on function app_private.post_inventory_transfer_impl(
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
to authenticated, service_role;


-- =========================================================
-- 3. PUBLIC SECURITY-INVOKER MOVEMENT WRAPPER
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
language sql
security invoker
set search_path = pg_catalog
as $function$
  select app_private.post_inventory_movement_impl(
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


-- =========================================================
-- 4. PUBLIC SECURITY-INVOKER TRANSFER WRAPPER
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
language sql
security invoker
set search_path = pg_catalog
as $function$
  select app_private.post_inventory_transfer_impl(
    p_tenant_id,
    p_source_warehouse_id,
    p_destination_warehouse_id,
    p_product_id,
    p_quantity,
    p_posting_key,
    p_lot_id,
    p_reference_type,
    p_reference_id,
    p_reason,
    p_occurred_at
  );
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
to authenticated, service_role;


-- =========================================================
-- 5. KEEP DIRECT LEDGER WRITE CLOSED
-- =========================================================

revoke insert, update, delete, truncate
on public.inventory_balances
from anon, authenticated;

revoke insert, update, delete, truncate
on public.inventory_movements
from anon, authenticated;

