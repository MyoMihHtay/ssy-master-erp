-- MAVORA Manufacturing ERP
-- Migration 010
-- Controlled Lot / Batch / Expiry / Quarantine Workflow

-- =========================================================
-- 1. LOT DATA QUALITY
-- =========================================================

alter table public.inventory_lots
  add constraint inventory_lots_lot_no_format_check
  check (
    length(btrim(lot_no)) between 1 and 200
  );

alter table public.inventory_lots
  add constraint inventory_lots_batch_no_format_check
  check (
    batch_no is null
    or length(btrim(batch_no)) between 1 and 200
  );

create index if not exists idx_inventory_lots_batch_lookup
  on public.inventory_lots (
    tenant_id,
    product_id,
    batch_no
  )
  where batch_no is not null;


-- =========================================================
-- 2. LOT / QUALITY CAPABILITY SEPARATION
-- =========================================================

insert into public.capabilities (
  code,
  module_code,
  action,
  description,
  risk_level,
  is_active
)
values
  (
    'inventory.lot_manage',
    'inventory',
    'lot_manage',
    'Create and manage inventory lot/batch master records',
    'high',
    true
  ),
  (
    'quality.lot_disposition',
    'quality',
    'lot_disposition',
    'Release, quarantine, block or expire inventory lots/batches',
    'critical',
    true
  )
on conflict (code) do nothing;

insert into public.role_capabilities (
  role_id,
  capability_code,
  tenant_id
)
select
  r.id,
  c.code,
  r.tenant_id
from public.roles r
join public.capabilities c
  on c.code in (
    'inventory.lot_manage',
    'quality.lot_disposition'
  )
where r.code = 'OWNER'
on conflict (role_id, capability_code)
do nothing;


-- =========================================================
-- 3. PROTECT PRODUCT TRACKING MODE AFTER LOT USAGE
-- =========================================================

create or replace function app_private.guard_product_tracking_mode()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if new.tracking_mode is distinct from old.tracking_mode
     and (
       exists (
         select 1
         from public.inventory_lots il
         where il.tenant_id = old.tenant_id
           and il.product_id = old.id
       )
       or exists (
         select 1
         from public.inventory_movements im
         where im.tenant_id = old.tenant_id
           and im.product_id = old.id
           and im.lot_id is not null
       )
     ) then
    raise exception
      'Tracking mode cannot be changed after lot/batch usage exists';
  end if;

  return new;
end;
$function$;

revoke all
on function app_private.guard_product_tracking_mode()
from public, anon, authenticated, service_role;

drop trigger if exists trg_products_guard_tracking_mode
  on public.products;

create trigger trg_products_guard_tracking_mode
before update of tracking_mode
on public.products
for each row
execute function app_private.guard_product_tracking_mode();


-- =========================================================
-- 3. PRIVATE CREATE LOT/BATCH IMPLEMENTATION
-- =========================================================

create or replace function app_private.create_inventory_lot_impl(
  p_tenant_id uuid,
  p_product_id uuid,
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
  v_tracking_mode text;
  v_existing public.inventory_lots%rowtype;
  v_lot public.inventory_lots%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not app_private.has_capability(
    p_tenant_id,
    'inventory.lot_manage',
    null
  ) then
    raise exception
      'Inventory lot management permission is required';
  end if;

  if p_lot_no is null
     or btrim(p_lot_no) = '' then
    raise exception 'Lot number is required';
  end if;

  if length(btrim(p_lot_no)) > 200 then
    raise exception
      'Lot number cannot exceed 200 characters';
  end if;

  if p_batch_no is not null
     and btrim(p_batch_no) = '' then
    raise exception
      'Batch number cannot be blank';
  end if;

  if p_batch_no is not null
     and length(btrim(p_batch_no)) > 200 then
    raise exception
      'Batch number cannot exceed 200 characters';
  end if;

  if p_notes is not null
     and length(p_notes) > 2000 then
    raise exception
      'Notes cannot exceed 2000 characters';
  end if;

  if p_expires_at is not null
     and p_manufactured_at is not null
     and p_expires_at < p_manufactured_at then
    raise exception
      'Expiry date cannot be earlier than manufacture date';
  end if;

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

  if v_tracking_mode = 'none' then
    raise exception
      'Product is not configured for lot/batch tracking';
  end if;

  if v_tracking_mode = 'batch'
     and (
       p_batch_no is null
       or btrim(p_batch_no) = ''
     ) then
    raise exception
      'Batch number is required for batch-tracked products';
  end if;

  -- Serialize create/retry requests for the same tenant/product/lot.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'lot-create|'
      || p_tenant_id::text
      || '|'
      || p_product_id::text
      || '|'
      || btrim(p_lot_no),
      0
    )
  );

  select il.*
    into v_existing
  from public.inventory_lots il
  where il.tenant_id = p_tenant_id
    and il.product_id = p_product_id
    and il.lot_no = btrim(p_lot_no);

  if found then
    if v_existing.batch_no
         is distinct from nullif(btrim(p_batch_no), '')
       or v_existing.manufactured_at
         is distinct from p_manufactured_at
       or v_existing.expires_at
         is distinct from p_expires_at
       or v_existing.notes
         is distinct from nullif(btrim(p_notes), '') then
      raise exception
        'Lot number already exists with different data';
    end if;

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'lot_id', v_existing.id,
      'product_id', v_existing.product_id,
      'lot_no', v_existing.lot_no,
      'batch_no', v_existing.batch_no,
      'manufactured_at', v_existing.manufactured_at,
      'expires_at', v_existing.expires_at,
      'status', v_existing.status
    );
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
    p_tenant_id,
    p_product_id,
    btrim(p_lot_no),
    nullif(btrim(p_batch_no), ''),
    p_manufactured_at,
    p_expires_at,
    'quarantine',
    nullif(btrim(p_notes), '')
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
    p_tenant_id,
    null,
    v_user_id,
    'inventory.lot_create',
    'inventory_lot',
    v_lot.id,
    jsonb_build_object(
      'product_id', v_lot.product_id,
      'lot_no', v_lot.lot_no,
      'batch_no', v_lot.batch_no,
      'manufactured_at', v_lot.manufactured_at,
      'expires_at', v_lot.expires_at,
      'status', v_lot.status
    ),
    null,
    jsonb_build_object(
      'tracking_mode', v_tracking_mode
    )
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'lot_id', v_lot.id,
    'product_id', v_lot.product_id,
    'lot_no', v_lot.lot_no,
    'batch_no', v_lot.batch_no,
    'manufactured_at', v_lot.manufactured_at,
    'expires_at', v_lot.expires_at,
    'status', v_lot.status
  );

exception
  when unique_violation then
    raise exception
      'Lot number already exists for this product';
end;
$function$;


-- =========================================================
-- 4. PUBLIC CREATE LOT/BATCH WRAPPER
-- =========================================================

create or replace function public.create_inventory_lot(
  p_tenant_id uuid,
  p_product_id uuid,
  p_lot_no text,
  p_batch_no text default null,
  p_manufactured_at date default null,
  p_expires_at date default null,
  p_notes text default null
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$
  select app_private.create_inventory_lot_impl(
    p_tenant_id,
    p_product_id,
    p_lot_no,
    p_batch_no,
    p_manufactured_at,
    p_expires_at,
    p_notes
  );
$function$;


-- =========================================================
-- 5. PRIVATE LOT STATUS WORKFLOW
-- =========================================================

create or replace function app_private.change_inventory_lot_status_impl(
  p_tenant_id uuid,
  p_lot_id uuid,
  p_new_status text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_lot public.inventory_lots%rowtype;
  v_old_status text;
  v_new_status text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not app_private.has_capability(
    p_tenant_id,
    'quality.lot_disposition',
    null
  ) then
    raise exception
      'Quality lot disposition permission is required';
  end if;

  if p_new_status is null
     or btrim(p_new_status) = '' then
    raise exception
      'New lot status is required';
  end if;

  v_new_status := lower(btrim(p_new_status));

  if v_new_status not in (
    'quarantine',
    'released',
    'blocked',
    'expired'
  ) then
    raise exception
      'Invalid lot status transition target';
  end if;

  if p_reason is null
     or btrim(p_reason) = '' then
    raise exception
      'Reason is required for lot status changes';
  end if;

  if length(btrim(p_reason)) > 1000 then
    raise exception
      'Reason cannot exceed 1000 characters';
  end if;

  select il.*
    into v_lot
  from public.inventory_lots il
  where il.id = p_lot_id
    and il.tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception
      'Inventory lot not found for tenant';
  end if;

  v_old_status := v_lot.status;

  if v_old_status = v_new_status then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'lot_id', v_lot.id,
      'status', v_lot.status
    );
  end if;

  if v_old_status in ('expired', 'consumed') then
    raise exception
      'Lot status % is terminal and cannot be changed',
      v_old_status;
  end if;

  if v_old_status = 'quarantine'
     and v_new_status not in (
       'released',
       'blocked',
       'expired'
     ) then
    raise exception
      'Invalid transition from quarantine to %',
      v_new_status;
  end if;

  if v_old_status = 'released'
     and v_new_status not in (
       'quarantine',
       'blocked',
       'expired'
     ) then
    raise exception
      'Invalid transition from released to %',
      v_new_status;
  end if;

  if v_old_status = 'blocked'
     and v_new_status not in (
       'quarantine',
       'expired'
     ) then
    raise exception
      'Invalid transition from blocked to %',
      v_new_status;
  end if;

  if v_lot.expires_at is not null
     and v_lot.expires_at <= current_date
     and v_new_status <> 'expired' then
    raise exception
      'Expired lot must be moved to expired status';
  end if;

  if v_new_status = 'expired'
     and (
       v_lot.expires_at is null
       or v_lot.expires_at > current_date
     ) then
    raise exception
      'Lot cannot be marked expired before its expiry date';
  end if;

  update public.inventory_lots
  set status = v_new_status
  where id = v_lot.id;

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
    p_tenant_id,
    null,
    v_user_id,
    'inventory.lot_status_change',
    'inventory_lot',
    v_lot.id,
    jsonb_build_object(
      'status', v_old_status
    ),
    jsonb_build_object(
      'status', v_new_status
    ),
    btrim(p_reason),
    jsonb_build_object(
      'product_id', v_lot.product_id,
      'lot_no', v_lot.lot_no,
      'batch_no', v_lot.batch_no,
      'expires_at', v_lot.expires_at
    )
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'lot_id', v_lot.id,
    'previous_status', v_old_status,
    'status', v_new_status
  );
end;
$function$;


-- =========================================================
-- 6. PUBLIC LOT STATUS WRAPPER
-- =========================================================

create or replace function public.change_inventory_lot_status(
  p_tenant_id uuid,
  p_lot_id uuid,
  p_new_status text,
  p_reason text
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$
  select app_private.change_inventory_lot_status_impl(
    p_tenant_id,
    p_lot_id,
    p_new_status,
    p_reason
  );
$function$;


-- =========================================================
-- 7. FUNCTION ACCESS
-- =========================================================

revoke all
on function app_private.create_inventory_lot_impl(
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
on function app_private.create_inventory_lot_impl(
  uuid,
  uuid,
  text,
  text,
  date,
  date,
  text
)
to authenticated, service_role;


revoke all
on function app_private.change_inventory_lot_status_impl(
  uuid,
  uuid,
  text,
  text
)
from public, anon;

grant execute
on function app_private.change_inventory_lot_status_impl(
  uuid,
  uuid,
  text,
  text
)
to authenticated, service_role;


revoke all
on function public.create_inventory_lot(
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
on function public.create_inventory_lot(
  uuid,
  uuid,
  text,
  text,
  date,
  date,
  text
)
to authenticated, service_role;


revoke all
on function public.change_inventory_lot_status(
  uuid,
  uuid,
  text,
  text
)
from public, anon;

grant execute
on function public.change_inventory_lot_status(
  uuid,
  uuid,
  text,
  text
)
to authenticated, service_role;


-- =========================================================
-- 8. CLOSE DIRECT LOT MUTATION
-- =========================================================

drop policy if exists inventory_lots_insert_poster
  on public.inventory_lots;

drop policy if exists inventory_lots_update_poster
  on public.inventory_lots;

revoke insert, update, delete, truncate
on public.inventory_lots
from anon, authenticated;

