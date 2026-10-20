-- MAVORA Manufacturing ERP
-- Migration 013
-- Atomic Production Order Planning
--
-- Goals:
--   * Create Draft Production Order + frozen BOM material snapshot atomically
--   * Require approved Recipe Version
--   * Scale BOM quantities from standard output to planned output
--   * Preserve existing tenant/site/capability security
--   * Close authenticated direct INSERT paths for Production Order planning
--   * No release/start/complete workflow
--   * No inventory consumption/output posting


-- =========================================================
-- 1. PRIVATE ATOMIC IMPLEMENTATION
-- =========================================================

create or replace function app_private.create_production_order_plan_impl(
  p_tenant_id uuid,
  p_site_id uuid,
  p_order_no text,
  p_recipe_version_id uuid,
  p_planned_qty numeric,
  p_work_center_id uuid default null,
  p_production_line_id uuid default null,
  p_priority text default 'normal',
  p_planned_start_at timestamptz default null,
  p_planned_end_at timestamptz default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_order_id uuid;

  v_recipe_status text;
  v_recipe_active boolean;
  v_output_product_id uuid;
  v_output_unit_id uuid;
  v_standard_output_qty numeric(18,6);

  v_material_count integer := 0;
begin

  -- -------------------------------------------------------
  -- Authentication / capability boundary
  -- -------------------------------------------------------

  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;

  if not app_private.has_capability(
    p_tenant_id,
    'production.order_manage',
    p_site_id
  ) then
    raise exception
      'Production Order management permission denied';
  end if;


  -- -------------------------------------------------------
  -- Input validation
  -- -------------------------------------------------------

  if p_order_no is null
     or length(btrim(p_order_no)) < 1
     or length(btrim(p_order_no)) > 100 then
    raise exception
      'Production Order number must contain 1 to 100 characters';
  end if;

  if p_planned_qty is null
     or p_planned_qty <= 0 then
    raise exception
      'Planned Production quantity must be greater than zero';
  end if;

  if p_priority not in (
    'low',
    'normal',
    'high',
    'urgent'
  ) then
    raise exception
      'Invalid Production Order priority';
  end if;

  if p_planned_end_at is not null
     and p_planned_start_at is not null
     and p_planned_end_at < p_planned_start_at then
    raise exception
      'Planned end time cannot be earlier than planned start time';
  end if;

  if p_notes is not null
     and length(p_notes) > 4000 then
    raise exception
      'Production Order notes cannot exceed 4000 characters';
  end if;


  -- -------------------------------------------------------
  -- Approved Recipe Version + output identity
  -- -------------------------------------------------------

  select
    prv.status,
    pr.is_active,
    pr.output_product_id,
    prv.output_unit_id,
    prv.standard_output_qty
  into
    v_recipe_status,
    v_recipe_active,
    v_output_product_id,
    v_output_unit_id,
    v_standard_output_qty
  from public.production_recipe_versions prv
  join public.production_recipes pr
    on pr.id = prv.recipe_id
   and pr.tenant_id = prv.tenant_id
  where prv.id = p_recipe_version_id
    and prv.tenant_id = p_tenant_id;

  if not found then
    raise exception
      'Recipe Version not found for Production Order tenant';
  end if;

  if v_recipe_status <> 'approved' then
    raise exception
      'Production Order requires an approved Recipe Version';
  end if;

  if v_recipe_active is not true then
    raise exception
      'Production Order requires an active Recipe';
  end if;

  if v_standard_output_qty is null
     or v_standard_output_qty <= 0 then
    raise exception
      'Recipe Version standard output quantity is invalid';
  end if;


  -- -------------------------------------------------------
  -- Approved BOM must exist
  -- -------------------------------------------------------

  if not exists (
    select 1
    from public.production_recipe_components prc
    where prc.recipe_version_id = p_recipe_version_id
      and prc.tenant_id = p_tenant_id
  ) then
    raise exception
      'Approved Recipe Version has no BOM components';
  end if;


  -- Prevent scaled quantities from rounding to zero.
  if exists (
    select 1
    from public.production_recipe_components prc
    where prc.recipe_version_id = p_recipe_version_id
      and prc.tenant_id = p_tenant_id
      and round(
        (
          prc.required_qty
          * p_planned_qty
          / v_standard_output_qty
        )::numeric,
        6
      ) <= 0
  ) then
    raise exception
      'One or more scaled BOM quantities round to zero';
  end if;


  -- -------------------------------------------------------
  -- Create Draft Production Order
  -- Existing server triggers remain authoritative.
  -- -------------------------------------------------------

  insert into public.production_orders (
    tenant_id,
    site_id,
    order_no,
    recipe_version_id,
    output_product_id,
    output_unit_id,
    work_center_id,
    production_line_id,
    status,
    priority,
    planned_qty,
    planned_start_at,
    planned_end_at,
    notes
  )
  values (
    p_tenant_id,
    p_site_id,
    btrim(p_order_no),
    p_recipe_version_id,
    v_output_product_id,
    v_output_unit_id,
    p_work_center_id,
    p_production_line_id,
    'draft',
    p_priority,
    p_planned_qty,
    p_planned_start_at,
    p_planned_end_at,
    p_notes
  )
  returning id
  into v_order_id;


  -- -------------------------------------------------------
  -- Freeze scaled BOM snapshot atomically
  -- -------------------------------------------------------

  insert into public.production_order_materials (
    tenant_id,
    site_id,
    production_order_id,
    line_no,
    source_component_id,
    input_product_id,
    input_unit_id,
    planned_qty,
    wastage_allowance_pct,
    notes
  )
  select
    p_tenant_id,
    p_site_id,
    v_order_id,
    prc.line_no,
    prc.id,
    prc.input_product_id,
    prc.input_unit_id,
    round(
      (
        prc.required_qty
        * p_planned_qty
        / v_standard_output_qty
      )::numeric,
      6
    ),
    prc.wastage_allowance_pct,
    prc.notes
  from public.production_recipe_components prc
  where prc.recipe_version_id = p_recipe_version_id
    and prc.tenant_id = p_tenant_id
  order by prc.line_no;

  get diagnostics
    v_material_count = row_count;


  if v_material_count < 1 then
    raise exception
      'Production Order material snapshot was not created';
  end if;


  return jsonb_build_object(
    'production_order_id', v_order_id,
    'order_no', btrim(p_order_no),
    'status', 'draft',
    'planned_qty', p_planned_qty,
    'material_count', v_material_count
  );

end;
$function$;


revoke all
on function app_private.create_production_order_plan_impl(
  uuid,
  uuid,
  text,
  uuid,
  numeric,
  uuid,
  uuid,
  text,
  timestamptz,
  timestamptz,
  text
)
from public, anon;

grant execute
on function app_private.create_production_order_plan_impl(
  uuid,
  uuid,
  text,
  uuid,
  numeric,
  uuid,
  uuid,
  text,
  timestamptz,
  timestamptz,
  text
)
to authenticated, service_role;


-- =========================================================
-- 2. PUBLIC SECURITY-INVOKER RPC
-- =========================================================

create or replace function public.create_production_order_plan(
  p_tenant_id uuid,
  p_site_id uuid,
  p_order_no text,
  p_recipe_version_id uuid,
  p_planned_qty numeric,
  p_work_center_id uuid default null,
  p_production_line_id uuid default null,
  p_priority text default 'normal',
  p_planned_start_at timestamptz default null,
  p_planned_end_at timestamptz default null,
  p_notes text default null
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$
  select app_private.create_production_order_plan_impl(
    p_tenant_id,
    p_site_id,
    p_order_no,
    p_recipe_version_id,
    p_planned_qty,
    p_work_center_id,
    p_production_line_id,
    p_priority,
    p_planned_start_at,
    p_planned_end_at,
    p_notes
  );
$function$;


revoke all
on function public.create_production_order_plan(
  uuid,
  uuid,
  text,
  uuid,
  numeric,
  uuid,
  uuid,
  text,
  timestamptz,
  timestamptz,
  text
)
from public, anon;

grant execute
on function public.create_production_order_plan(
  uuid,
  uuid,
  text,
  uuid,
  numeric,
  uuid,
  uuid,
  text,
  timestamptz,
  timestamptz,
  text
)
to authenticated, service_role;


-- =========================================================
-- 3. CLOSE DIRECT AUTHENTICATED INSERT PATH
-- =========================================================
--
-- Production Order + material snapshot creation must now
-- go through the atomic RPC above.
--
-- Existing SELECT / UPDATE controls remain unchanged.
-- Lifecycle advancement remains blocked by Migration 012.

revoke insert
on table public.production_orders
from authenticated;

-- The material rows are a frozen BOM snapshot.
-- Direct client mutation would break the atomic planning invariant.
revoke insert, update, delete
on table public.production_order_materials
from authenticated;


-- =========================================================
-- 4. COMMENTS
-- =========================================================

comment on function public.create_production_order_plan(
  uuid,
  uuid,
  text,
  uuid,
  numeric,
  uuid,
  uuid,
  text,
  timestamptz,
  timestamptz,
  text
) is
  'Atomically creates one Draft Production Order and its frozen scaled BOM material snapshot. Does not release, start, complete, or post inventory.';

comment on function app_private.create_production_order_plan_impl(
  uuid,
  uuid,
  text,
  uuid,
  numeric,
  uuid,
  uuid,
  text,
  timestamptz,
  timestamptz,
  text
) is
  'Privileged implementation for atomic Production Order planning. Enforces authentication, production.order_manage capability, approved Recipe Version, and scaled BOM snapshot creation.';
