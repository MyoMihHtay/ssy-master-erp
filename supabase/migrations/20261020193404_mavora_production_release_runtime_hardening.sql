-- MAVORA Manufacturing ERP
-- Migration 016
-- Production Release Runtime Resource Hardening
--
-- Goals:
--   * Keep Migration 015 immutable
--   * Revalidate active Site at Release time
--   * Revalidate active Work Center when assigned
--   * Revalidate active Production Line when assigned
--   * Revalidate Production Line / Work Center relationship
--   * Preserve all existing Release authorization,
--     BOM, Product, base-unit, audit and retry behavior

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
  v_line_work_center_id uuid;
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


  -- Release-time runtime resource validation.
  if not exists (
    select 1
    from public.sites s
    where s.id = v_order.site_id
      and s.tenant_id = v_order.tenant_id
      and s.is_active = true
  ) then
    raise exception
      'Production Order Site must be active at Release time';
  end if;


  if v_order.work_center_id is not null then
    if not exists (
      select 1
      from public.work_centers wc
      where wc.id = v_order.work_center_id
        and wc.tenant_id = v_order.tenant_id
        and wc.site_id = v_order.site_id
        and wc.is_active = true
    ) then
      raise exception
        'Production Order Work Center must be active and belong to the same Site at Release time';
    end if;
  end if;


  if v_order.production_line_id is not null then
    select pl.work_center_id
    into v_line_work_center_id
    from public.production_lines pl
    where pl.id = v_order.production_line_id
      and pl.tenant_id = v_order.tenant_id
      and pl.site_id = v_order.site_id
      and pl.is_active = true;

    if not found then
      raise exception
        'Production Order Production Line must be active and belong to the same Site at Release time';
    end if;

    if v_order.work_center_id is not null
       and v_line_work_center_id is not null
       and v_line_work_center_id <> v_order.work_center_id then
      raise exception
        'Production Line does not belong to the selected Work Center at Release time';
    end if;
  end if;


  -- Frozen planning snapshot must exist.
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


  -- Production execution currently operates in Product base units.
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

comment on function app_private.release_production_order_impl(
  uuid,
  uuid,
  text
) is
  'Controlled Production Order Release implementation with runtime Site, Work Center and Production Line revalidation.';
