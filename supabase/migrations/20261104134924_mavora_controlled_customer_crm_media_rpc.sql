-- =========================================================
-- MAVORA ERP
-- Controlled Customer CRM + Media RPC
--
-- Phase 2P-6N-7
--
-- Security model:
--   * Customer CRM read:
--       sales.customer_view
--   * Customer CRM write / Customer media:
--       sales.customer_manage
--   * Product media read:
--       active tenant membership
--   * Product media write:
--       masterdata.manage
--   * Public RPC wrappers:
--       SECURITY INVOKER
--   * Privileged implementations:
--       app_private + SECURITY DEFINER
--   * No direct authenticated access to media/activity tables.
--   * Storage object upload/delete is NOT implemented here.
--   * Fixed future private bucket contract:
--       mavora-media
-- =========================================================


-- =========================================================
-- 1. PRIVATE PRODUCT MEDIA AUTH HELPERS
-- =========================================================

create or replace function
app_private.require_product_media_read(
  p_tenant_id uuid
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

  if p_tenant_id is null then
    raise exception
      'Tenant is required';
  end if;

  if not app_private.is_tenant_member(
    p_tenant_id
  ) then
    raise exception
      'Active tenant membership required';
  end if;

end;
$function$;


revoke all
on function app_private.require_product_media_read(
  uuid
)
from public, anon;


grant execute
on function app_private.require_product_media_read(
  uuid
)
to authenticated, service_role;


create or replace function
app_private.require_product_media_manage(
  p_tenant_id uuid
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

  if p_tenant_id is null then
    raise exception
      'Tenant is required';
  end if;

  if not app_private.has_capability(
    p_tenant_id,
    'masterdata.manage',
    null
  ) then
    raise exception
      'masterdata.manage capability required';
  end if;

end;
$function$;


revoke all
on function app_private.require_product_media_manage(
  uuid
)
from public, anon;


grant execute
on function app_private.require_product_media_manage(
  uuid
)
to authenticated, service_role;


-- =========================================================
-- 2. CUSTOMER CRM DETAIL
-- =========================================================

create or replace function
app_private.get_sales_customer_crm_impl(
  p_tenant_id uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_customer public.sales_customers%rowtype;
begin

  if p_customer_id is null then
    raise exception
      'Customer is required';
  end if;

  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.customer_view',
    null
  );

  select *
  into v_customer
  from public.sales_customers
  where tenant_id = p_tenant_id
    and id = p_customer_id;

  if not found then
    raise exception
      'Customer not found';
  end if;

  return jsonb_build_object(
    'ok', true,
    'customer', to_jsonb(v_customer)
  );

end;
$function$;


revoke all
on function app_private.get_sales_customer_crm_impl(
  uuid,
  uuid
)
from public, anon;


grant execute
on function app_private.get_sales_customer_crm_impl(
  uuid,
  uuid
)
to authenticated, service_role;


create or replace function
public.get_sales_customer_crm(
  p_tenant_id uuid,
  p_customer_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $function$

  select app_private.get_sales_customer_crm_impl(
    p_tenant_id,
    p_customer_id
  );

$function$;


revoke all
on function public.get_sales_customer_crm(
  uuid,
  uuid
)
from public, anon;


grant execute
on function public.get_sales_customer_crm(
  uuid,
  uuid
)
to authenticated, service_role;


-- =========================================================
-- 3. CUSTOMER CRM UPDATE
-- =========================================================

create or replace function
app_private.update_sales_customer_crm_impl(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_contact_person text default null,
  p_email text default null,
  p_township text default null,
  p_area text default null,
  p_route_code text default null,
  p_customer_segment text default null,
  p_assigned_sales_user_id uuid default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_gps_accuracy_m numeric default null,
  p_gps_source text default null,
  p_gps_captured_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();

  v_before public.sales_customers%rowtype;
  v_result public.sales_customers%rowtype;

  v_contact_person text :=
    nullif(btrim(p_contact_person), '');

  v_email text :=
    nullif(btrim(p_email), '');

  v_township text :=
    nullif(btrim(p_township), '');

  v_area text :=
    nullif(btrim(p_area), '');

  v_route_code text :=
    nullif(btrim(p_route_code), '');

  v_customer_segment text :=
    nullif(btrim(p_customer_segment), '');

  v_gps_source text :=
    nullif(lower(btrim(p_gps_source)), '');

  v_legacy_gps text;
begin

  if p_customer_id is null then
    raise exception
      'Customer is required';
  end if;

  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.customer_manage',
    null
  );

  select *
  into v_before
  from public.sales_customers
  where tenant_id = p_tenant_id
    and id = p_customer_id
  for update;

  if not found then
    raise exception
      'Customer not found';
  end if;

  if (
    p_latitude is null
    and p_longitude is not null
  )
  or (
    p_latitude is not null
    and p_longitude is null
  ) then
    raise exception
      'Latitude and longitude must be supplied together';
  end if;

  if p_assigned_sales_user_id is not null
     and not exists (
       select 1
       from public.tenant_memberships tm
       where tm.tenant_id = p_tenant_id
         and tm.user_id =
             p_assigned_sales_user_id
         and tm.status = 'active'
     )
  then
    raise exception
      'Assigned Sales user must be an active tenant member';
  end if;

  if p_latitude is not null then
    v_legacy_gps :=
      p_latitude::text
      || ', '
      || p_longitude::text;
  else
    v_legacy_gps :=
      v_before.gps;
  end if;

  update public.sales_customers
  set
    contact_person =
      v_contact_person,

    email =
      v_email,

    township =
      v_township,

    area =
      v_area,

    route_code =
      v_route_code,

    customer_segment =
      v_customer_segment,

    assigned_sales_user_id =
      p_assigned_sales_user_id,

    latitude =
      case
        when p_latitude is null
          then v_before.latitude
        else p_latitude
      end,

    longitude =
      case
        when p_latitude is null
          then v_before.longitude
        else p_longitude
      end,

    gps_accuracy_m =
      case
        when p_latitude is null
          then v_before.gps_accuracy_m
        else p_gps_accuracy_m
      end,

    gps_source =
      case
        when p_latitude is null
          then v_before.gps_source
        else coalesce(
          v_gps_source,
          'manual'
        )
      end,

    gps_captured_at =
      case
        when p_latitude is null
          then v_before.gps_captured_at
        else coalesce(
          p_gps_captured_at,
          now()
        )
      end,

    gps =
      v_legacy_gps,

    updated_by =
      v_user_id

  where tenant_id = p_tenant_id
    and id = p_customer_id

  returning *
  into v_result;

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
    'sales.customer_crm_update',
    'sales_customer',
    v_result.id,
    to_jsonb(v_before),
    to_jsonb(v_result),
    'Controlled Customer CRM profile update',
    jsonb_build_object(
      'gps_updated',
      p_latitude is not null
    )
  );

  return jsonb_build_object(
    'ok', true,
    'customer',
    to_jsonb(v_result)
  );

end;
$function$;


revoke all
on function app_private.update_sales_customer_crm_impl(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  numeric,
  numeric,
  numeric,
  text,
  timestamptz
)
from public, anon;


grant execute
on function app_private.update_sales_customer_crm_impl(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  numeric,
  numeric,
  numeric,
  text,
  timestamptz
)
to authenticated, service_role;


create or replace function
public.update_sales_customer_crm(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_contact_person text default null,
  p_email text default null,
  p_township text default null,
  p_area text default null,
  p_route_code text default null,
  p_customer_segment text default null,
  p_assigned_sales_user_id uuid default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_gps_accuracy_m numeric default null,
  p_gps_source text default null,
  p_gps_captured_at timestamptz default null
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$

  select app_private.update_sales_customer_crm_impl(
    p_tenant_id,
    p_customer_id,
    p_contact_person,
    p_email,
    p_township,
    p_area,
    p_route_code,
    p_customer_segment,
    p_assigned_sales_user_id,
    p_latitude,
    p_longitude,
    p_gps_accuracy_m,
    p_gps_source,
    p_gps_captured_at
  );

$function$;


revoke all
on function public.update_sales_customer_crm(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  numeric,
  numeric,
  numeric,
  text,
  timestamptz
)
from public, anon;


grant execute
on function public.update_sales_customer_crm(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  numeric,
  numeric,
  numeric,
  text,
  timestamptz
)
to authenticated, service_role;


-- =========================================================
-- 4. CUSTOMER CRM ACTIVITY LIST
-- =========================================================

create or replace function
app_private.list_sales_customer_activities_impl(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_limit integer :=
    coalesce(p_limit, 100);

  v_offset integer :=
    coalesce(p_offset, 0);

  v_items jsonb;
begin

  if p_customer_id is null then
    raise exception
      'Customer is required';
  end if;

  if v_limit < 1
     or v_limit > 500 then
    raise exception
      'Activity list limit must be between 1 and 500';
  end if;

  if v_offset < 0 then
    raise exception
      'Activity offset cannot be negative';
  end if;

  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.customer_view',
    null
  );

  if not exists (
    select 1
    from public.sales_customers
    where tenant_id = p_tenant_id
      and id = p_customer_id
  ) then
    raise exception
      'Customer not found';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'activity_id', a.id,
        'activity_type', a.activity_type,
        'subject', a.subject,
        'note', a.note,
        'outcome', a.outcome,
        'occurred_at', a.occurred_at,
        'next_follow_up_at',
          a.next_follow_up_at,
        'latitude', a.latitude,
        'longitude', a.longitude,
        'gps_accuracy_m',
          a.gps_accuracy_m,
        'created_by', a.created_by,
        'created_at', a.created_at
      )
      order by
        a.occurred_at desc,
        a.created_at desc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select *
    from public.sales_customer_activities
    where tenant_id = p_tenant_id
      and customer_id = p_customer_id
    order by
      occurred_at desc,
      created_at desc
    limit v_limit
    offset v_offset
  ) a;

  return jsonb_build_object(
    'ok', true,
    'customer_id', p_customer_id,
    'items', v_items,
    'limit', v_limit,
    'offset', v_offset
  );

end;
$function$;


revoke all
on function app_private.list_sales_customer_activities_impl(
  uuid,
  uuid,
  integer,
  integer
)
from public, anon;


grant execute
on function app_private.list_sales_customer_activities_impl(
  uuid,
  uuid,
  integer,
  integer
)
to authenticated, service_role;


create or replace function
public.list_sales_customer_activities(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $function$

  select app_private.list_sales_customer_activities_impl(
    p_tenant_id,
    p_customer_id,
    p_limit,
    p_offset
  );

$function$;


revoke all
on function public.list_sales_customer_activities(
  uuid,
  uuid,
  integer,
  integer
)
from public, anon;


grant execute
on function public.list_sales_customer_activities(
  uuid,
  uuid,
  integer,
  integer
)
to authenticated, service_role;


-- =========================================================
-- 5. CUSTOMER CRM ACTIVITY CREATE
-- =========================================================

create or replace function
app_private.add_sales_customer_activity_impl(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_activity_type text,
  p_subject text default null,
  p_note text default null,
  p_outcome text default null,
  p_occurred_at timestamptz default null,
  p_next_follow_up_at timestamptz default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_gps_accuracy_m numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();

  v_activity_type text :=
    lower(btrim(p_activity_type));

  v_result public.sales_customer_activities%rowtype;
begin

  if p_customer_id is null then
    raise exception
      'Customer is required';
  end if;

  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.customer_manage',
    null
  );

  if not exists (
    select 1
    from public.sales_customers
    where tenant_id = p_tenant_id
      and id = p_customer_id
  ) then
    raise exception
      'Customer not found';
  end if;

  if (
    p_latitude is null
    and p_longitude is not null
  )
  or (
    p_latitude is not null
    and p_longitude is null
  ) then
    raise exception
      'Latitude and longitude must be supplied together';
  end if;

  insert into public.sales_customer_activities (
    tenant_id,
    customer_id,
    activity_type,
    subject,
    note,
    outcome,
    occurred_at,
    next_follow_up_at,
    latitude,
    longitude,
    gps_accuracy_m,
    created_by
  )
  values (
    p_tenant_id,
    p_customer_id,
    v_activity_type,
    nullif(btrim(p_subject), ''),
    nullif(p_note, ''),
    nullif(p_outcome, ''),
    coalesce(
      p_occurred_at,
      now()
    ),
    p_next_follow_up_at,
    p_latitude,
    p_longitude,
    p_gps_accuracy_m,
    v_user_id
  )
  returning *
  into v_result;

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
    'sales.customer_activity_add',
    'sales_customer_activity',
    v_result.id,
    null,
    to_jsonb(v_result),
    'Controlled Customer CRM activity creation',
    jsonb_build_object(
      'customer_id',
      p_customer_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'activity',
    to_jsonb(v_result)
  );

end;
$function$;


revoke all
on function app_private.add_sales_customer_activity_impl(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  numeric,
  numeric,
  numeric
)
from public, anon;


grant execute
on function app_private.add_sales_customer_activity_impl(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  numeric,
  numeric,
  numeric
)
to authenticated, service_role;


create or replace function
public.add_sales_customer_activity(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_activity_type text,
  p_subject text default null,
  p_note text default null,
  p_outcome text default null,
  p_occurred_at timestamptz default null,
  p_next_follow_up_at timestamptz default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_gps_accuracy_m numeric default null
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$

  select app_private.add_sales_customer_activity_impl(
    p_tenant_id,
    p_customer_id,
    p_activity_type,
    p_subject,
    p_note,
    p_outcome,
    p_occurred_at,
    p_next_follow_up_at,
    p_latitude,
    p_longitude,
    p_gps_accuracy_m
  );

$function$;


revoke all
on function public.add_sales_customer_activity(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  numeric,
  numeric,
  numeric
)
from public, anon;


grant execute
on function public.add_sales_customer_activity(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  numeric,
  numeric,
  numeric
)
to authenticated, service_role;


-- =========================================================
-- 6. CUSTOMER MEDIA LIST
-- =========================================================

create or replace function
app_private.list_sales_customer_media_impl(
  p_tenant_id uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_items jsonb;
begin

  if p_customer_id is null then
    raise exception
      'Customer is required';
  end if;

  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.customer_view',
    null
  );

  if not exists (
    select 1
    from public.sales_customers
    where tenant_id = p_tenant_id
      and id = p_customer_id
  ) then
    raise exception
      'Customer not found';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'media_id', m.id,
        'media_kind', m.media_kind,
        'storage_bucket',
          m.storage_bucket,
        'object_path',
          m.object_path,
        'original_file_name',
          m.original_file_name,
        'mime_type', m.mime_type,
        'file_size_bytes',
          m.file_size_bytes,
        'caption', m.caption,
        'is_primary', m.is_primary,
        'sort_order', m.sort_order,
        'captured_at', m.captured_at,
        'latitude', m.latitude,
        'longitude', m.longitude,
        'gps_accuracy_m',
          m.gps_accuracy_m,
        'uploaded_by', m.uploaded_by,
        'created_at', m.created_at,
        'updated_at', m.updated_at
      )
      order by
        m.is_primary desc,
        m.sort_order,
        m.created_at
    ),
    '[]'::jsonb
  )
  into v_items
  from public.sales_customer_media m
  where m.tenant_id = p_tenant_id
    and m.customer_id = p_customer_id;

  return jsonb_build_object(
    'ok', true,
    'customer_id', p_customer_id,
    'items', v_items
  );

end;
$function$;


revoke all
on function app_private.list_sales_customer_media_impl(
  uuid,
  uuid
)
from public, anon;


grant execute
on function app_private.list_sales_customer_media_impl(
  uuid,
  uuid
)
to authenticated, service_role;


create or replace function
public.list_sales_customer_media(
  p_tenant_id uuid,
  p_customer_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $function$

  select app_private.list_sales_customer_media_impl(
    p_tenant_id,
    p_customer_id
  );

$function$;


revoke all
on function public.list_sales_customer_media(
  uuid,
  uuid
)
from public, anon;


grant execute
on function public.list_sales_customer_media(
  uuid,
  uuid
)
to authenticated, service_role;


-- =========================================================
-- 7. CUSTOMER MEDIA REGISTER
-- =========================================================

create or replace function
app_private.register_sales_customer_media_impl(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_media_kind text,
  p_object_path text,
  p_original_file_name text default null,
  p_mime_type text default null,
  p_file_size_bytes bigint default null,
  p_caption text default null,
  p_is_primary boolean default false,
  p_sort_order integer default 0,
  p_captured_at timestamptz default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_gps_accuracy_m numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();

  v_media_kind text :=
    lower(btrim(p_media_kind));

  v_object_path text :=
    btrim(p_object_path);

  v_expected_prefix text;

  v_result public.sales_customer_media%rowtype;
begin

  if p_customer_id is null then
    raise exception
      'Customer is required';
  end if;

  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.customer_manage',
    null
  );

  if not exists (
    select 1
    from public.sales_customers
    where tenant_id = p_tenant_id
      and id = p_customer_id
  ) then
    raise exception
      'Customer not found';
  end if;

  v_expected_prefix :=
    p_tenant_id::text
    || '/customers/'
    || p_customer_id::text
    || '/';

  if left(
       v_object_path,
       length(v_expected_prefix)
     ) <> v_expected_prefix
  then
    raise exception
      'Customer media object path is outside the authorized Customer folder';
  end if;

  if
       length(v_object_path)
         <= length(v_expected_prefix)

    or position(
         '/' in substring(
           v_object_path
           from length(v_expected_prefix) + 1
         )
       ) > 0

    or substring(
         v_object_path
         from length(v_expected_prefix) + 1
       ) in ('.', '..')
  then
    raise exception
      'Customer media object path must contain exactly one file name';
  end if;

  if (
    p_latitude is null
    and p_longitude is not null
  )
  or (
    p_latitude is not null
    and p_longitude is null
  ) then
    raise exception
      'Latitude and longitude must be supplied together';
  end if;

  if coalesce(
       p_is_primary,
       false
     )
  then
    update public.sales_customer_media
    set
      is_primary = false,
      updated_at = now()
    where tenant_id = p_tenant_id
      and customer_id = p_customer_id
      and media_kind = v_media_kind
      and is_primary = true;
  end if;

  insert into public.sales_customer_media (
    tenant_id,
    customer_id,
    media_kind,
    storage_bucket,
    object_path,
    original_file_name,
    mime_type,
    file_size_bytes,
    caption,
    is_primary,
    sort_order,
    captured_at,
    latitude,
    longitude,
    gps_accuracy_m,
    uploaded_by
  )
  values (
    p_tenant_id,
    p_customer_id,
    v_media_kind,
    'mavora-media',
    v_object_path,
    nullif(
      btrim(p_original_file_name),
      ''
    ),
    nullif(
      lower(btrim(p_mime_type)),
      ''
    ),
    p_file_size_bytes,
    nullif(p_caption, ''),
    coalesce(
      p_is_primary,
      false
    ),
    coalesce(
      p_sort_order,
      0
    ),
    p_captured_at,
    p_latitude,
    p_longitude,
    p_gps_accuracy_m,
    v_user_id
  )
  returning *
  into v_result;

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
    'sales.customer_media_register',
    'sales_customer_media',
    v_result.id,
    null,
    to_jsonb(v_result),
    'Controlled Customer media metadata registration',
    jsonb_build_object(
      'customer_id',
      p_customer_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'media',
    to_jsonb(v_result)
  );

end;
$function$;


revoke all
on function app_private.register_sales_customer_media_impl(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text,
  boolean,
  integer,
  timestamptz,
  numeric,
  numeric,
  numeric
)
from public, anon;


grant execute
on function app_private.register_sales_customer_media_impl(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text,
  boolean,
  integer,
  timestamptz,
  numeric,
  numeric,
  numeric
)
to authenticated, service_role;


create or replace function
public.register_sales_customer_media(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_media_kind text,
  p_object_path text,
  p_original_file_name text default null,
  p_mime_type text default null,
  p_file_size_bytes bigint default null,
  p_caption text default null,
  p_is_primary boolean default false,
  p_sort_order integer default 0,
  p_captured_at timestamptz default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_gps_accuracy_m numeric default null
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$

  select app_private.register_sales_customer_media_impl(
    p_tenant_id,
    p_customer_id,
    p_media_kind,
    p_object_path,
    p_original_file_name,
    p_mime_type,
    p_file_size_bytes,
    p_caption,
    p_is_primary,
    p_sort_order,
    p_captured_at,
    p_latitude,
    p_longitude,
    p_gps_accuracy_m
  );

$function$;


revoke all
on function public.register_sales_customer_media(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text,
  boolean,
  integer,
  timestamptz,
  numeric,
  numeric,
  numeric
)
from public, anon;


grant execute
on function public.register_sales_customer_media(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text,
  boolean,
  integer,
  timestamptz,
  numeric,
  numeric,
  numeric
)
to authenticated, service_role;


-- =========================================================
-- 8. CUSTOMER MEDIA METADATA REMOVE
-- =========================================================

create or replace function
app_private.remove_sales_customer_media_impl(
  p_tenant_id uuid,
  p_media_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();

  v_media public.sales_customer_media%rowtype;
begin

  if p_media_id is null then
    raise exception
      'Customer media is required';
  end if;

  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.customer_manage',
    null
  );

  select *
  into v_media
  from public.sales_customer_media
  where tenant_id = p_tenant_id
    and id = p_media_id
  for update;

  if not found then
    raise exception
      'Customer media not found';
  end if;

  delete from public.sales_customer_media
  where tenant_id = p_tenant_id
    and id = p_media_id;

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
    'sales.customer_media_remove',
    'sales_customer_media',
    v_media.id,
    to_jsonb(v_media),
    null,
    'Controlled Customer media metadata removal',
    jsonb_build_object(
      'customer_id',
      v_media.customer_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'media_id', v_media.id,
    'storage_bucket',
      v_media.storage_bucket,
    'object_path',
      v_media.object_path
  );

end;
$function$;


revoke all
on function app_private.remove_sales_customer_media_impl(
  uuid,
  uuid
)
from public, anon;


grant execute
on function app_private.remove_sales_customer_media_impl(
  uuid,
  uuid
)
to authenticated, service_role;


create or replace function
public.remove_sales_customer_media(
  p_tenant_id uuid,
  p_media_id uuid
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$

  select app_private.remove_sales_customer_media_impl(
    p_tenant_id,
    p_media_id
  );

$function$;


revoke all
on function public.remove_sales_customer_media(
  uuid,
  uuid
)
from public, anon;


grant execute
on function public.remove_sales_customer_media(
  uuid,
  uuid
)
to authenticated, service_role;


-- =========================================================
-- 9. PRODUCT MEDIA LIST
-- =========================================================

create or replace function
app_private.list_product_media_impl(
  p_tenant_id uuid,
  p_product_id uuid default null,
  p_primary_only boolean default false,
  p_limit integer default 500
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_limit integer :=
    coalesce(p_limit, 500);

  v_items jsonb;
begin

  if v_limit < 1
     or v_limit > 1000 then
    raise exception
      'Product media limit must be between 1 and 1000';
  end if;

  perform app_private.require_product_media_read(
    p_tenant_id
  );

  if p_product_id is not null
     and not exists (
       select 1
       from public.products
       where tenant_id = p_tenant_id
         and id = p_product_id
     )
  then
    raise exception
      'Product not found';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'media_id', m.id,
        'product_id', m.product_id,
        'media_kind', m.media_kind,
        'storage_bucket',
          m.storage_bucket,
        'object_path',
          m.object_path,
        'original_file_name',
          m.original_file_name,
        'mime_type', m.mime_type,
        'file_size_bytes',
          m.file_size_bytes,
        'caption', m.caption,
        'is_primary', m.is_primary,
        'sort_order', m.sort_order,
        'uploaded_by', m.uploaded_by,
        'created_at', m.created_at,
        'updated_at', m.updated_at
      )
      order by
        m.product_id,
        m.is_primary desc,
        m.sort_order,
        m.created_at
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select *
    from public.product_media
    where tenant_id = p_tenant_id
      and (
        p_product_id is null
        or product_id = p_product_id
      )
      and (
        coalesce(
          p_primary_only,
          false
        ) = false
        or is_primary = true
      )
    order by
      product_id,
      is_primary desc,
      sort_order,
      created_at
    limit v_limit
  ) m;

  return jsonb_build_object(
    'ok', true,
    'items', v_items
  );

end;
$function$;


revoke all
on function app_private.list_product_media_impl(
  uuid,
  uuid,
  boolean,
  integer
)
from public, anon;


grant execute
on function app_private.list_product_media_impl(
  uuid,
  uuid,
  boolean,
  integer
)
to authenticated, service_role;


create or replace function
public.list_product_media(
  p_tenant_id uuid,
  p_product_id uuid default null,
  p_primary_only boolean default false,
  p_limit integer default 500
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $function$

  select app_private.list_product_media_impl(
    p_tenant_id,
    p_product_id,
    p_primary_only,
    p_limit
  );

$function$;


revoke all
on function public.list_product_media(
  uuid,
  uuid,
  boolean,
  integer
)
from public, anon;


grant execute
on function public.list_product_media(
  uuid,
  uuid,
  boolean,
  integer
)
to authenticated, service_role;


-- =========================================================
-- 10. PRODUCT MEDIA REGISTER
-- =========================================================

create or replace function
app_private.register_product_media_impl(
  p_tenant_id uuid,
  p_product_id uuid,
  p_media_kind text,
  p_object_path text,
  p_original_file_name text default null,
  p_mime_type text default null,
  p_file_size_bytes bigint default null,
  p_caption text default null,
  p_is_primary boolean default false,
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();

  v_media_kind text :=
    lower(btrim(p_media_kind));

  v_object_path text :=
    btrim(p_object_path);

  v_expected_prefix text;

  v_result public.product_media%rowtype;
begin

  if p_product_id is null then
    raise exception
      'Product is required';
  end if;

  perform app_private.require_product_media_manage(
    p_tenant_id
  );

  if not exists (
    select 1
    from public.products
    where tenant_id = p_tenant_id
      and id = p_product_id
  ) then
    raise exception
      'Product not found';
  end if;

  v_expected_prefix :=
    p_tenant_id::text
    || '/products/'
    || p_product_id::text
    || '/';

  if left(
       v_object_path,
       length(v_expected_prefix)
     ) <> v_expected_prefix
  then
    raise exception
      'Product media object path is outside the authorized Product folder';
  end if;

  if
       length(v_object_path)
         <= length(v_expected_prefix)

    or position(
         '/' in substring(
           v_object_path
           from length(v_expected_prefix) + 1
         )
       ) > 0

    or substring(
         v_object_path
         from length(v_expected_prefix) + 1
       ) in ('.', '..')
  then
    raise exception
      'Product media object path must contain exactly one file name';
  end if;

  if coalesce(
       p_is_primary,
       false
     )
  then
    update public.product_media
    set
      is_primary = false,
      updated_at = now()
    where tenant_id = p_tenant_id
      and product_id = p_product_id
      and is_primary = true;
  end if;

  insert into public.product_media (
    tenant_id,
    product_id,
    media_kind,
    storage_bucket,
    object_path,
    original_file_name,
    mime_type,
    file_size_bytes,
    caption,
    is_primary,
    sort_order,
    uploaded_by
  )
  values (
    p_tenant_id,
    p_product_id,
    v_media_kind,
    'mavora-media',
    v_object_path,
    nullif(
      btrim(p_original_file_name),
      ''
    ),
    nullif(
      lower(btrim(p_mime_type)),
      ''
    ),
    p_file_size_bytes,
    nullif(p_caption, ''),
    coalesce(
      p_is_primary,
      false
    ),
    coalesce(
      p_sort_order,
      0
    ),
    v_user_id
  )
  returning *
  into v_result;

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
    'masterdata.product_media_register',
    'product_media',
    v_result.id,
    null,
    to_jsonb(v_result),
    'Controlled Product media metadata registration',
    jsonb_build_object(
      'product_id',
      p_product_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'media',
    to_jsonb(v_result)
  );

end;
$function$;


revoke all
on function app_private.register_product_media_impl(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text,
  boolean,
  integer
)
from public, anon;


grant execute
on function app_private.register_product_media_impl(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text,
  boolean,
  integer
)
to authenticated, service_role;


create or replace function
public.register_product_media(
  p_tenant_id uuid,
  p_product_id uuid,
  p_media_kind text,
  p_object_path text,
  p_original_file_name text default null,
  p_mime_type text default null,
  p_file_size_bytes bigint default null,
  p_caption text default null,
  p_is_primary boolean default false,
  p_sort_order integer default 0
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$

  select app_private.register_product_media_impl(
    p_tenant_id,
    p_product_id,
    p_media_kind,
    p_object_path,
    p_original_file_name,
    p_mime_type,
    p_file_size_bytes,
    p_caption,
    p_is_primary,
    p_sort_order
  );

$function$;


revoke all
on function public.register_product_media(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text,
  boolean,
  integer
)
from public, anon;


grant execute
on function public.register_product_media(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text,
  boolean,
  integer
)
to authenticated, service_role;


-- =========================================================
-- 11. PRODUCT MEDIA METADATA REMOVE
-- =========================================================

create or replace function
app_private.remove_product_media_impl(
  p_tenant_id uuid,
  p_media_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();

  v_media public.product_media%rowtype;
begin

  if p_media_id is null then
    raise exception
      'Product media is required';
  end if;

  perform app_private.require_product_media_manage(
    p_tenant_id
  );

  select *
  into v_media
  from public.product_media
  where tenant_id = p_tenant_id
    and id = p_media_id
  for update;

  if not found then
    raise exception
      'Product media not found';
  end if;

  delete from public.product_media
  where tenant_id = p_tenant_id
    and id = p_media_id;

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
    'masterdata.product_media_remove',
    'product_media',
    v_media.id,
    to_jsonb(v_media),
    null,
    'Controlled Product media metadata removal',
    jsonb_build_object(
      'product_id',
      v_media.product_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'media_id', v_media.id,
    'storage_bucket',
      v_media.storage_bucket,
    'object_path',
      v_media.object_path
  );

end;
$function$;


revoke all
on function app_private.remove_product_media_impl(
  uuid,
  uuid
)
from public, anon;


grant execute
on function app_private.remove_product_media_impl(
  uuid,
  uuid
)
to authenticated, service_role;


create or replace function
public.remove_product_media(
  p_tenant_id uuid,
  p_media_id uuid
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$

  select app_private.remove_product_media_impl(
    p_tenant_id,
    p_media_id
  );

$function$;


revoke all
on function public.remove_product_media(
  uuid,
  uuid
)
from public, anon;


grant execute
on function public.remove_product_media(
  uuid,
  uuid
)
to authenticated, service_role;


-- =========================================================
-- 12. COMMENTS / CONTRACT
-- =========================================================

comment on function
public.get_sales_customer_crm(
  uuid,
  uuid
) is
  'Controlled Customer CRM detail. Requires sales.customer_view.';


comment on function
public.update_sales_customer_crm(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  numeric,
  numeric,
  numeric,
  text,
  timestamptz
) is
  'Controlled Customer CRM profile update including structured GPS capture. Requires sales.customer_manage.';


comment on function
public.add_sales_customer_activity(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  numeric,
  numeric,
  numeric
) is
  'Controlled CRM activity creation for Customer visits, calls, messages, follow-ups, notes and non-financial collection interaction notes. Requires sales.customer_manage.';


comment on function
public.register_sales_customer_media(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text,
  boolean,
  integer,
  timestamptz,
  numeric,
  numeric,
  numeric
) is
  'Registers Customer media metadata after secure Storage upload. Fixed bucket contract is mavora-media. Requires sales.customer_manage.';


comment on function
public.register_product_media(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text,
  boolean,
  integer
) is
  'Registers Product media metadata after secure Storage upload. Fixed bucket contract is mavora-media. Requires masterdata.manage.';


-- =========================================================
-- END
-- =========================================================
