-- MAVORA Manufacturing ERP
-- Migration 017
-- Production Cost Roll-up / WIP Costing Foundation
--
-- Goals:
--   * derive Production cost from immutable actual material consumption
--   * preserve append-only Inventory movement history
--   * finalize Production output inventory valuation atomically at Completion
--   * prevent QC release of Production output before costing is finalized
--   * support controlled backfill for eligible historical completed Orders
--   * expose read-only WIP cost visibility
--
-- Costing method v1:
--   Actual Material Weighted-Average Cost
--
-- Conversion / Labor / Overhead are reserved as zero-value columns
-- for later controlled costing phases.
--
-- Existing applied migrations remain immutable.


-- =========================================================
-- 1. FINAL PRODUCTION ORDER COST SNAPSHOT
-- =========================================================

create table public.production_order_costs (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete restrict,

  site_id uuid not null,

  production_order_id uuid not null,

  costing_method text not null
    default 'actual_material_wac_v1'
    check (
      costing_method in (
        'actual_material_wac_v1'
      )
    ),

  material_cost numeric(28,6) not null
    check (material_cost >= 0),

  conversion_cost numeric(28,6) not null
    default 0
    check (conversion_cost >= 0),

  overhead_cost numeric(28,6) not null
    default 0
    check (overhead_cost >= 0),

  total_cost numeric(28,6) not null
    check (total_cost >= 0),

  actual_output_qty numeric(20,6) not null
    check (actual_output_qty > 0),

  output_unit_cost numeric(20,6) not null
    check (output_unit_cost >= 0),

  is_backfill boolean not null default false,

  finalized_by uuid
    references auth.users(id)
    on delete set null,

  finalized_at timestamptz not null default now(),

  created_at timestamptz not null default now(),

  constraint production_order_costs_total_check
    check (
      abs(
        total_cost
        -
        (
          material_cost
          + conversion_cost
          + overhead_cost
        )
      ) <= 0.000001
    ),

  constraint fk_production_order_costs_order_scope
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

  constraint uq_production_order_costs_order
    unique (
      production_order_id,
      tenant_id
    ),

  unique (
    id,
    tenant_id
  )
);

create index idx_production_order_costs_tenant_site
  on public.production_order_costs (
    tenant_id,
    site_id,
    finalized_at desc
  );


-- =========================================================
-- 2. COST SNAPSHOT IMMUTABILITY
-- =========================================================

create or replace function app_private.guard_production_order_cost_immutable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  raise exception
    'Finalized Production cost records are immutable';
end;
$function$;

revoke all
on function app_private.guard_production_order_cost_immutable()
from public, anon, authenticated;

grant execute
on function app_private.guard_production_order_cost_immutable()
to service_role;


create trigger trg_production_order_costs_immutable
before update or delete
on public.production_order_costs
for each row
execute function app_private.guard_production_order_cost_immutable();


-- =========================================================
-- 3. RLS / CLIENT BOUNDARY
-- =========================================================

alter table public.production_order_costs
  enable row level security;

create policy production_order_costs_select_scoped
on public.production_order_costs
for select
to authenticated
using (
  app_private.is_tenant_member(tenant_id)
  and app_private.has_site_access(site_id)
);

revoke insert, update, delete
on public.production_order_costs
from anon, authenticated;

grant select
on public.production_order_costs
to authenticated;


-- =========================================================
-- 4. PRODUCTION OUTPUT COST-SCOPE GUARD
-- =========================================================
-- Tracked output:
--   a Lot / Batch belongs to one Production Order only.
--
-- Non-tracked output:
--   another uncosted Production Order may not overlap the same
--   warehouse + product balance.

create or replace function app_private.guard_production_output_cost_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin

  if new.lot_id is not null then

    if exists (
      select 1
      from public.production_order_outputs poo
      where poo.tenant_id = new.tenant_id
        and poo.output_product_id = new.output_product_id
        and poo.lot_id = new.lot_id
        and poo.production_order_id <> new.production_order_id
    ) then
      raise exception
        'Production output Lot/Batch is already linked to another Production Order';
    end if;

  else

    if exists (
      select 1
      from public.production_order_outputs poo
      join public.production_orders po
        on po.id = poo.production_order_id
       and po.tenant_id = poo.tenant_id
      left join public.production_order_costs poc
        on poc.production_order_id = poo.production_order_id
       and poc.tenant_id = poo.tenant_id
      where poo.tenant_id = new.tenant_id
        and poo.site_id = new.site_id
        and poo.warehouse_id = new.warehouse_id
        and poo.output_product_id = new.output_product_id
        and poo.lot_id is null
        and poo.production_order_id <> new.production_order_id
        and poc.id is null
    ) then
      raise exception
        'Another uncosted Production Order already uses this non-tracked output balance';
    end if;

  end if;

  return new;
end;
$function$;

revoke all
on function app_private.guard_production_output_cost_scope()
from public, anon, authenticated;

grant execute
on function app_private.guard_production_output_cost_scope()
to service_role;


create trigger trg_guard_production_output_cost_scope
before insert
on public.production_order_outputs
for each row
execute function app_private.guard_production_output_cost_scope();


-- =========================================================
-- 5. PRODUCTION OUTPUT LOT QC-RELEASE GUARD
-- =========================================================
-- A Production output Lot/Batch cannot leave Quarantine until:
--   * Production Order = completed
--   * Production cost snapshot exists

create or replace function app_private.guard_production_output_lot_release()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin

  if old.status = 'quarantine'
     and new.status = 'released'
     and exists (
       select 1
       from public.production_order_outputs poo
       where poo.tenant_id = new.tenant_id
         and poo.output_product_id = new.product_id
         and poo.lot_id = new.id
     )
  then

    if exists (
      select 1
      from public.production_order_outputs poo
      join public.production_orders po
        on po.id = poo.production_order_id
       and po.tenant_id = poo.tenant_id
      left join public.production_order_costs poc
        on poc.production_order_id = po.id
       and poc.tenant_id = po.tenant_id
      where poo.tenant_id = new.tenant_id
        and poo.output_product_id = new.product_id
        and poo.lot_id = new.id
        and (
          po.status <> 'completed'
          or poc.id is null
        )
    ) then
      raise exception
        'Production output Lot/Batch cannot be released before Production completion and cost finalization';
    end if;

  end if;

  return new;
end;
$function$;

revoke all
on function app_private.guard_production_output_lot_release()
from public, anon, authenticated;

grant execute
on function app_private.guard_production_output_lot_release()
to service_role;


create trigger trg_guard_production_output_lot_release
before update of status
on public.inventory_lots
for each row
execute function app_private.guard_production_output_lot_release();


-- =========================================================
-- 6. PRIVATE PRODUCTION COST FINALIZER
-- =========================================================

create or replace function app_private.finalize_production_order_cost_impl(
  p_tenant_id uuid,
  p_production_order_id uuid,
  p_is_backfill boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();

  v_order public.production_orders%rowtype;
  v_existing public.production_order_costs%rowtype;

  v_tracking_mode text;

  v_material_cost numeric(28,6);
  v_conversion_cost numeric(28,6) := 0;
  v_overhead_cost numeric(28,6) := 0;
  v_total_cost numeric(28,6);

  v_output_qty numeric(20,6);
  v_unit_cost numeric(20,6);

  v_cost_id uuid;

  v_scope record;
  v_balance record;

  v_prior_qty numeric(20,6);
  v_new_avg numeric(20,6);

  v_revaluation_count integer := 0;
begin

  -- -------------------------------------------------------
  -- Authentication
  -- -------------------------------------------------------

  if v_user_id is null then
    raise exception
      'Authentication required';
  end if;

  if p_tenant_id is null
     or p_production_order_id is null then
    raise exception
      'Tenant and Production Order are required';
  end if;


  -- -------------------------------------------------------
  -- Serialize Cost Finalization
  -- -------------------------------------------------------

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'production-cost|'
      || p_tenant_id::text
      || '|'
      || p_production_order_id::text,
      0
    )
  );


  -- -------------------------------------------------------
  -- Production Order
  -- -------------------------------------------------------

  select po.*
  into v_order
  from public.production_orders po
  where po.id = p_production_order_id
    and po.tenant_id = p_tenant_id;

  if not found then
    raise exception
      'Production Order not found';
  end if;


  perform app_private.require_production_execution_access(
    p_tenant_id,
    v_order.site_id
  );


  if v_order.status <> 'completed' then
    raise exception
      'Production cost can only be finalized for a Completed Production Order';
  end if;


  -- -------------------------------------------------------
  -- Retry-safe immutable cost snapshot
  -- -------------------------------------------------------

  select poc.*
  into v_existing
  from public.production_order_costs poc
  where poc.production_order_id = v_order.id
    and poc.tenant_id = v_order.tenant_id;

  if found then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'production_order_id', v_order.id,
      'order_no', v_order.order_no,
      'cost_id', v_existing.id,
      'material_cost', v_existing.material_cost,
      'total_cost', v_existing.total_cost,
      'actual_output_qty', v_existing.actual_output_qty,
      'output_unit_cost', v_existing.output_unit_cost,
      'is_backfill', v_existing.is_backfill
    );
  end if;


  -- -------------------------------------------------------
  -- Output Product / Tracking Mode
  -- -------------------------------------------------------

  select p.tracking_mode
  into v_tracking_mode
  from public.products p
  where p.id = v_order.output_product_id
    and p.tenant_id = v_order.tenant_id
    and p.is_active = true;

  if not found then
    raise exception
      'Active Production output product not found';
  end if;


  -- Historical backfill is intentionally limited to
  -- tracked output because Lot/Batch identity allows safe,
  -- auditable valuation after warehouse transfers.
  if p_is_backfill
     and v_tracking_mode not in ('lot', 'batch') then
    raise exception
      'Historical Production cost backfill currently requires Lot/Batch tracked output';
  end if;


  -- -------------------------------------------------------
  -- Output Trace Validation
  -- -------------------------------------------------------

  if not exists (
    select 1
    from public.production_order_outputs poo
    where poo.production_order_id = v_order.id
      and poo.tenant_id = v_order.tenant_id
  ) then
    raise exception
      'Production cost finalization requires recorded output';
  end if;


  if v_tracking_mode in ('lot', 'batch')
     and exists (
       select 1
       from public.production_order_outputs poo
       where poo.production_order_id = v_order.id
         and poo.tenant_id = v_order.tenant_id
         and poo.lot_id is null
     )
  then
    raise exception
      'Tracked Production output requires Lot/Batch identity';
  end if;


  if exists (
    select 1
    from public.production_order_outputs current_output
    join public.production_order_outputs other_output
      on other_output.tenant_id = current_output.tenant_id
     and other_output.output_product_id =
           current_output.output_product_id
     and other_output.lot_id = current_output.lot_id
     and other_output.production_order_id <>
           current_output.production_order_id
    where current_output.production_order_id = v_order.id
      and current_output.tenant_id = v_order.tenant_id
      and current_output.lot_id is not null
  ) then
    raise exception
      'Production output Lot/Batch is shared by more than one Production Order';
  end if;


  -- -------------------------------------------------------
  -- Material Cost Integrity
  -- -------------------------------------------------------
  -- Consumption movement unit_cost is the Inventory WAC at
  -- the moment material left stock.

  if exists (
    select 1
    from public.production_order_material_consumptions poc
    join public.inventory_movements im
      on im.id = poc.inventory_movement_id
     and im.tenant_id = poc.tenant_id
    where poc.production_order_id = v_order.id
      and poc.tenant_id = v_order.tenant_id
      and im.unit_cost is null
  ) then
    raise exception
      'Production material cost is incomplete because a consumption movement has no unit cost';
  end if;


  select
    round(
      coalesce(
        sum(
          poc.actual_qty
          *
          im.unit_cost
        ),
        0
      )::numeric,
      6
    )
  into v_material_cost
  from public.production_order_material_consumptions poc
  join public.inventory_movements im
    on im.id = poc.inventory_movement_id
   and im.tenant_id = poc.tenant_id
  where poc.production_order_id = v_order.id
    and poc.tenant_id = v_order.tenant_id;


  -- -------------------------------------------------------
  -- Actual Output / Unit Cost
  -- -------------------------------------------------------

  select
    round(
      coalesce(sum(poo.actual_qty), 0)::numeric,
      6
    )
  into v_output_qty
  from public.production_order_outputs poo
  where poo.production_order_id = v_order.id
    and poo.tenant_id = v_order.tenant_id;


  if v_output_qty <= 0 then
    raise exception
      'Actual Production output must be greater than zero';
  end if;


  v_total_cost :=
    round(
      (
        v_material_cost
        + v_conversion_cost
        + v_overhead_cost
      )::numeric,
      6
    );


  v_unit_cost :=
    round(
      (
        v_total_cost
        /
        v_output_qty
      )::numeric,
      6
    );


  -- =======================================================
  -- 6A. CONTROLLED HISTORICAL BACKFILL
  -- =======================================================
  -- Only tracked Lot/Batch output is eligible.
  --
  -- Transfers are allowed because Lot identity preserves
  -- traceability. Issue / consumption / wastage and foreign
  -- inbound stock make historical revaluation unsafe.

  if p_is_backfill then

    if exists (
      select 1
      from public.production_order_outputs poo
      join public.inventory_movements im
        on im.tenant_id = poo.tenant_id
       and im.product_id = poo.output_product_id
       and im.lot_id = poo.lot_id
      where poo.production_order_id = v_order.id
        and poo.tenant_id = v_order.tenant_id
        and (
          im.movement_type in (
            'opening',
            'receipt',
            'adjustment_in',
            'return_in',
            'qc_release'
          )
          or (
            im.movement_type = 'production_output'
            and (
              im.reference_type is distinct from 'production_order'
              or im.reference_id is distinct from v_order.id::text
            )
          )
        )
    ) then
      raise exception
        'Historical Production cost backfill is unsafe because the output Lot/Batch contains foreign inbound stock';
    end if;


    if exists (
      select 1
      from public.production_order_outputs poo
      join public.inventory_movements im
        on im.tenant_id = poo.tenant_id
       and im.product_id = poo.output_product_id
       and im.lot_id = poo.lot_id
      where poo.production_order_id = v_order.id
        and poo.tenant_id = v_order.tenant_id
        and im.movement_type in (
          'issue',
          'production_consume',
          'adjustment_out',
          'return_out',
          'wastage'
        )
    ) then
      raise exception
        'Historical Production cost backfill is unsafe after output stock has been issued, consumed, adjusted out, returned out or wasted';
    end if;


    for v_balance in
      select
        ib.id,
        ib.warehouse_id,
        ib.product_id,
        ib.lot_id,
        ib.quantity,
        ib.average_unit_cost
      from public.inventory_balances ib
      where ib.tenant_id = v_order.tenant_id
        and exists (
          select 1
          from public.production_order_outputs poo
          where poo.production_order_id = v_order.id
            and poo.tenant_id = v_order.tenant_id
            and poo.tenant_id = ib.tenant_id
            and poo.output_product_id = ib.product_id
            and poo.lot_id = ib.lot_id
        )
      order by ib.warehouse_id, ib.id
      for update of ib
    loop

      update public.inventory_balances
      set
        average_unit_cost = v_unit_cost,
        updated_at = now()
      where id = v_balance.id;


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
        'inventory.cost_revalue',
        'inventory_balance',
        v_balance.id,
        jsonb_build_object(
          'quantity',
          v_balance.quantity,
          'average_unit_cost',
          v_balance.average_unit_cost
        ),
        jsonb_build_object(
          'quantity',
          v_balance.quantity,
          'average_unit_cost',
          v_unit_cost
        ),
        'Controlled Production cost historical backfill',
        jsonb_build_object(
          'production_order_id',
          v_order.id,
          'order_no',
          v_order.order_no,
          'warehouse_id',
          v_balance.warehouse_id,
          'product_id',
          v_balance.product_id,
          'lot_id',
          v_balance.lot_id
        )
      );

      v_revaluation_count :=
        v_revaluation_count + 1;

    end loop;


    if v_revaluation_count = 0 then
      raise exception
        'No Inventory balance exists for Production output Lot/Batch';
    end if;


  -- =======================================================
  -- 6B. NORMAL COMPLETION COST FINALIZATION
  -- =======================================================

  else

    -- Tracked Production output must still be quarantined.
    if v_tracking_mode in ('lot', 'batch')
       and exists (
         select 1
         from public.production_order_outputs poo
         join public.inventory_lots il
           on il.id = poo.lot_id
          and il.tenant_id = poo.tenant_id
          and il.product_id = poo.output_product_id
         where poo.production_order_id = v_order.id
           and poo.tenant_id = v_order.tenant_id
           and il.status <> 'quarantine'
       )
    then
      raise exception
        'Production output must remain in Quarantine until Production cost is finalized';
    end if;


    -- Every recorded output was created in QUARANTINE.
    -- Re-check runtime warehouse state before valuation.
    if exists (
      select 1
      from public.production_order_outputs poo
      join public.warehouses w
        on w.id = poo.warehouse_id
       and w.tenant_id = poo.tenant_id
       and w.site_id = poo.site_id
      where poo.production_order_id = v_order.id
        and poo.tenant_id = v_order.tenant_id
        and (
          w.is_active is not true
          or w.warehouse_type <> 'QUARANTINE'
        )
    ) then
      raise exception
        'Production output costing requires an active QUARANTINE warehouse';
    end if;


    for v_scope in
      select
        poo.warehouse_id,
        poo.output_product_id,
        poo.lot_id,
        round(sum(poo.actual_qty)::numeric, 6)
          as order_output_qty,
        min(im.created_at)
          as first_output_created_at
      from public.production_order_outputs poo
      join public.inventory_movements im
        on im.id = poo.inventory_movement_id
       and im.tenant_id = poo.tenant_id
      where poo.production_order_id = v_order.id
        and poo.tenant_id = v_order.tenant_id
      group by
        poo.warehouse_id,
        poo.output_product_id,
        poo.lot_id
      order by
        poo.warehouse_id,
        poo.lot_id nulls first
    loop

      -- No other stock movement may interleave with this
      -- uncosted output balance before Completion.
      if exists (
        select 1
        from public.inventory_movements im
        where im.tenant_id = v_order.tenant_id
          and im.warehouse_id = v_scope.warehouse_id
          and im.product_id = v_scope.output_product_id
          and im.lot_id is not distinct from v_scope.lot_id
          and im.created_at >= v_scope.first_output_created_at
          and not (
            im.movement_type = 'production_output'
            and im.reference_type = 'production_order'
            and im.reference_id = v_order.id::text
          )
      ) then
        raise exception
          'Production output balance changed before cost finalization';
      end if;


      select
        ib.id,
        ib.quantity,
        ib.average_unit_cost
      into v_balance
      from public.inventory_balances ib
      where ib.tenant_id = v_order.tenant_id
        and ib.warehouse_id = v_scope.warehouse_id
        and ib.product_id = v_scope.output_product_id
        and ib.lot_id is not distinct from v_scope.lot_id
      for update;


      if not found then
        raise exception
          'Production output Inventory balance not found';
      end if;


      v_prior_qty :=
        round(
          (
            v_balance.quantity
            - v_scope.order_output_qty
          )::numeric,
          6
        );


      if v_prior_qty < -0.000001 then
        raise exception
          'Production output balance quantity is inconsistent';
      end if;


      -- A tracked output Lot/Batch is dedicated to one Order.
      if v_tracking_mode in ('lot', 'batch')
         and abs(v_prior_qty) > 0.000001 then
        raise exception
          'Production output Lot/Batch contains stock not created by this Production Order';
      end if;


      if v_balance.quantity <= 0 then
        raise exception
          'Production output balance must be greater than zero during cost finalization';
      end if;


      if v_prior_qty <= 0.000001 then

        v_new_avg := v_unit_cost;

      else

        if v_balance.average_unit_cost is null then
          raise exception
            'Existing output balance has no prior cost basis';
        end if;

        v_new_avg :=
          round(
            (
              (
                v_prior_qty
                * v_balance.average_unit_cost
              )
              +
              (
                v_scope.order_output_qty
                * v_unit_cost
              )
            )
            /
            v_balance.quantity,
            6
          );

      end if;


      update public.inventory_balances
      set
        average_unit_cost = v_new_avg,
        updated_at = now()
      where id = v_balance.id;


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
        'inventory.cost_revalue',
        'inventory_balance',
        v_balance.id,
        jsonb_build_object(
          'quantity',
          v_balance.quantity,
          'average_unit_cost',
          v_balance.average_unit_cost
        ),
        jsonb_build_object(
          'quantity',
          v_balance.quantity,
          'average_unit_cost',
          v_new_avg
        ),
        'Automatic Production cost finalization',
        jsonb_build_object(
          'production_order_id',
          v_order.id,
          'order_no',
          v_order.order_no,
          'warehouse_id',
          v_scope.warehouse_id,
          'product_id',
          v_scope.output_product_id,
          'lot_id',
          v_scope.lot_id,
          'order_output_qty',
          v_scope.order_output_qty,
          'production_unit_cost',
          v_unit_cost
        )
      );


      v_revaluation_count :=
        v_revaluation_count + 1;

    end loop;


    if v_revaluation_count = 0 then
      raise exception
        'No Production output balance was available for cost finalization';
    end if;

  end if;


  -- -------------------------------------------------------
  -- Immutable Final Cost Snapshot
  -- -------------------------------------------------------

  insert into public.production_order_costs (
    tenant_id,
    site_id,
    production_order_id,
    costing_method,
    material_cost,
    conversion_cost,
    overhead_cost,
    total_cost,
    actual_output_qty,
    output_unit_cost,
    is_backfill,
    finalized_by
  )
  values (
    v_order.tenant_id,
    v_order.site_id,
    v_order.id,
    'actual_material_wac_v1',
    v_material_cost,
    v_conversion_cost,
    v_overhead_cost,
    v_total_cost,
    v_output_qty,
    v_unit_cost,
    p_is_backfill,
    v_user_id
  )
  returning id
  into v_cost_id;


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
    'production.cost_finalize',
    'production_order_cost',
    v_cost_id,
    jsonb_build_object(
      'production_order_id',
      v_order.id,
      'order_no',
      v_order.order_no,
      'costing_method',
      'actual_material_wac_v1',
      'material_cost',
      v_material_cost,
      'conversion_cost',
      v_conversion_cost,
      'overhead_cost',
      v_overhead_cost,
      'total_cost',
      v_total_cost,
      'actual_output_qty',
      v_output_qty,
      'output_unit_cost',
      v_unit_cost,
      'is_backfill',
      p_is_backfill
    ),
    case
      when p_is_backfill
        then 'Controlled historical Production cost backfill'
      else 'Automatic Production cost finalization at Completion'
    end,
    jsonb_build_object(
      'revalued_balance_count',
      v_revaluation_count
    )
  );


  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'production_order_id', v_order.id,
    'order_no', v_order.order_no,
    'cost_id', v_cost_id,
    'costing_method', 'actual_material_wac_v1',
    'material_cost', v_material_cost,
    'conversion_cost', v_conversion_cost,
    'overhead_cost', v_overhead_cost,
    'total_cost', v_total_cost,
    'actual_output_qty', v_output_qty,
    'output_unit_cost', v_unit_cost,
    'is_backfill', p_is_backfill,
    'revalued_balance_count', v_revaluation_count
  );

end;
$function$;


revoke all
on function app_private.finalize_production_order_cost_impl(
  uuid,
  uuid,
  boolean
)
from public, anon, authenticated;

grant execute
on function app_private.finalize_production_order_cost_impl(
  uuid,
  uuid,
  boolean
)
to service_role;


-- =========================================================
-- 7. AUTOMATIC COST FINALIZATION AT COMPLETION
-- =========================================================
-- Runs inside the same transaction as Production completion.
-- Any costing failure rolls back the Completion transition.

create or replace function app_private.finalize_production_cost_after_completion()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin

  if old.status is distinct from new.status
     and new.status = 'completed' then

    perform app_private.finalize_production_order_cost_impl(
      new.tenant_id,
      new.id,
      false
    );

  end if;

  return new;
end;
$function$;


revoke all
on function app_private.finalize_production_cost_after_completion()
from public, anon, authenticated;

grant execute
on function app_private.finalize_production_cost_after_completion()
to service_role;


create trigger trg_finalize_production_cost_after_completion
after update of status
on public.production_orders
for each row
when (
  old.status is distinct from new.status
  and new.status = 'completed'
)
execute function app_private.finalize_production_cost_after_completion();


-- =========================================================
-- 8. CONTROLLED HISTORICAL BACKFILL RPC
-- =========================================================
-- Intended for eligible completed tracked Production Orders
-- created before Migration 017.
--
-- No arbitrary cost input is accepted.
-- Cost is derived only from immutable execution traces.

create or replace function public.finalize_completed_production_order_cost(
  p_tenant_id uuid,
  p_production_order_id uuid
)
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $function$
  select app_private.finalize_production_order_cost_impl(
    p_tenant_id,
    p_production_order_id,
    true
  );
$function$;


revoke all
on function public.finalize_completed_production_order_cost(
  uuid,
  uuid
)
from public, anon;

grant execute
on function public.finalize_completed_production_order_cost(
  uuid,
  uuid
)
to authenticated, service_role;


-- =========================================================
-- 9. READ-ONLY WIP COST VIEW
-- =========================================================

create or replace view public.production_order_wip_costs
with (security_invoker = true)
as
select
  po.id as production_order_id,
  po.tenant_id,
  po.site_id,
  po.order_no,
  po.status,
  po.output_product_id,
  po.output_unit_id,
  po.planned_qty,

  coalesce(
    material.actual_material_cost_to_date,
    0
  )::numeric(28,6)
    as actual_material_cost_to_date,

  coalesce(
    material.missing_cost_trace_count,
    0
  )::bigint
    as missing_cost_trace_count,

  coalesce(
    output.actual_output_qty_to_date,
    0
  )::numeric(20,6)
    as actual_output_qty_to_date,

  final_cost.material_cost
    as finalized_material_cost,

  final_cost.total_cost
    as finalized_total_cost,

  final_cost.output_unit_cost
    as finalized_output_unit_cost,

  final_cost.finalized_at
    as cost_finalized_at

from public.production_orders po

left join lateral (
  select
    round(
      coalesce(
        sum(
          case
            when im.unit_cost is null
              then 0
            else
              poc.actual_qty * im.unit_cost
          end
        ),
        0
      )::numeric,
      6
    ) as actual_material_cost_to_date,

    count(*) filter (
      where im.unit_cost is null
    ) as missing_cost_trace_count

  from public.production_order_material_consumptions poc
  join public.inventory_movements im
    on im.id = poc.inventory_movement_id
   and im.tenant_id = poc.tenant_id
  where poc.production_order_id = po.id
    and poc.tenant_id = po.tenant_id
) material
on true

left join lateral (
  select
    round(
      coalesce(
        sum(poo.actual_qty),
        0
      )::numeric,
      6
    ) as actual_output_qty_to_date
  from public.production_order_outputs poo
  where poo.production_order_id = po.id
    and poo.tenant_id = po.tenant_id
) output
on true

left join public.production_order_costs final_cost
  on final_cost.production_order_id = po.id
 and final_cost.tenant_id = po.tenant_id;


revoke all
on public.production_order_wip_costs
from anon;

grant select
on public.production_order_wip_costs
to authenticated;



-- =========================================================
-- 10. EFFECTIVE INVENTORY MOVEMENT COST VIEW
-- =========================================================
-- Inventory movements remain append-only / immutable.
--
-- Production output movements created before cost finalization
-- may have raw unit_cost = NULL.
--
-- This view overlays the finalized Production Order output
-- unit cost without rewriting historical Inventory movement rows.

create or replace view public.inventory_movement_effective_costs
with (security_invoker = true)
as
select
  im.id as inventory_movement_id,
  im.movement_group_id,
  im.tenant_id,
  im.site_id,
  im.warehouse_id,
  im.product_id,
  im.lot_id,
  im.movement_type,
  im.quantity,

  im.unit_cost
    as posted_unit_cost,

  case
    when im.unit_cost is not null then
      im.unit_cost

    when im.movement_type = 'production_output'
         and im.reference_type = 'production_order'
    then
      poc.output_unit_cost

    else
      null
  end::numeric(20,6)
    as effective_unit_cost,

  case
    when im.unit_cost is not null then
      'inventory_movement'

    when im.movement_type = 'production_output'
         and im.reference_type = 'production_order'
         and poc.id is not null
    then
      'production_order_cost'

    else
      'unvalued'
  end::text
    as cost_source,

  poc.id
    as production_order_cost_id,

  case
    when im.unit_cost is not null then
      round(
        abs(im.quantity) * im.unit_cost,
        6
      )

    when im.movement_type = 'production_output'
         and im.reference_type = 'production_order'
         and poc.output_unit_cost is not null
    then
      round(
        abs(im.quantity) * poc.output_unit_cost,
        6
      )

    else
      null
  end::numeric(28,6)
    as effective_movement_value,

  im.reference_type,
  im.reference_id,
  im.reason,
  im.occurred_at,
  im.created_at

from public.inventory_movements im

left join public.production_order_outputs poo
  on poo.inventory_movement_id = im.id
 and poo.tenant_id = im.tenant_id

left join public.production_order_costs poc
  on poc.production_order_id = poo.production_order_id
 and poc.tenant_id = poo.tenant_id;


revoke all
on public.inventory_movement_effective_costs
from anon;

grant select
on public.inventory_movement_effective_costs
to authenticated;


-- =========================================================
-- 11. COMMENTS
-- =========================================================

comment on view public.inventory_movement_effective_costs is
  'Read-only effective Inventory movement valuation. Preserves immutable posted movements while overlaying finalized Production output unit cost from Production Order costing.';

comment on table public.production_order_costs is
  'Immutable finalized Production Order costing snapshot. Migration 017 starts with actual material WAC; conversion and overhead are reserved for later controlled costing phases.';

comment on function app_private.finalize_production_order_cost_impl(
  uuid,
  uuid,
  boolean
) is
  'Server-controlled Production cost roll-up from immutable material consumption movements with output Inventory cost finalization.';

comment on function public.finalize_completed_production_order_cost(
  uuid,
  uuid
) is
  'Controlled historical Production cost backfill for eligible completed tracked Production Orders. No arbitrary cost input is accepted.';

comment on view public.production_order_wip_costs is
  'Read-only WIP / Production cost visibility derived from actual material consumption and finalized Production cost snapshots.';
