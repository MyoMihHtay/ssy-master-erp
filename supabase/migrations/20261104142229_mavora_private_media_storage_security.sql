-- =========================================================
-- MAVORA ERP
-- Private Media Storage Security
--
-- Phase 2P-6N-7
--
-- Bucket:
--   mavora-media
--
-- Access model:
--   PRIVATE ONLY
--
-- Allowed path contracts:
--
--   <tenant_uuid>/customers/<customer_uuid>/<file>
--   <tenant_uuid>/products/<product_uuid>/<file>
--
-- Customer media:
--   READ   -> sales.customer_view
--   WRITE  -> sales.customer_manage
--
-- Product media:
--   READ   -> active tenant membership
--   WRITE  -> masterdata.manage
--
-- Important:
--   * Actual object upload/download/update/delete operations
--     are performed through Supabase Storage API.
--   * This migration configures the private bucket and RLS.
--   * No permanent public URLs.
--   * No anonymous object access.
-- =========================================================


-- =========================================================
-- 1. PRIVATE BUCKET
-- =========================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'mavora-media',
  'mavora-media',
  false,
  20971520,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/heic',
    'image/heif'
  ]::text[]
)
on conflict (id)
do nothing;


-- Fail safely if an existing bucket with the same ID has
-- a configuration that does not match MAVORA's contract.
do $bucket_validation$
begin

  if not exists (
    select 1
    from storage.buckets b
    where b.id = 'mavora-media'
      and b.name = 'mavora-media'
      and b.public = false
      and b.file_size_limit = 20971520
      and b.allowed_mime_types @> array[
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/avif',
        'image/heic',
        'image/heif'
      ]::text[]
      and array_length(
        b.allowed_mime_types,
        1
      ) = 6
  ) then
    raise exception
      'Existing mavora-media bucket configuration does not match the controlled MAVORA contract';
  end if;

end;
$bucket_validation$;


-- =========================================================
-- 2. STORAGE PATH READ AUTHORIZATION
-- =========================================================

create or replace function
app_private.can_read_mavora_media_object(
  p_object_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_name text :=
    nullif(btrim(p_object_name), '');

  v_tenant_text text;
  v_scope text;
  v_entity_text text;

  v_tenant_id uuid;
  v_entity_id uuid;
begin

  if auth.uid() is null
     or v_name is null then
    return false;
  end if;


  -- Require at least:
  -- tenant/scope/entity/file
  if
       v_name !~
         '^[^/]+/(customers|products)/[^/]+/[^/]+$'

    or split_part(
         v_name,
         '/',
         4
       ) in ('.', '..')
  then
    return false;
  end if;


  v_tenant_text :=
    split_part(v_name, '/', 1);

  v_scope :=
    split_part(v_name, '/', 2);

  v_entity_text :=
    split_part(v_name, '/', 3);


  -- Validate UUID text before casting.
  if v_tenant_text !~
    '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[1-5][0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$'
  then
    return false;
  end if;

  if v_entity_text !~
    '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[1-5][0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$'
  then
    return false;
  end if;


  v_tenant_id :=
    v_tenant_text::uuid;

  v_entity_id :=
    v_entity_text::uuid;


  -- -------------------------------------------------------
  -- CUSTOMER MEDIA READ
  -- -------------------------------------------------------

  if v_scope = 'customers' then

    if not app_private.has_capability(
      v_tenant_id,
      'sales.customer_view',
      null
    ) then
      return false;
    end if;

    return exists (
      select 1
      from public.sales_customers c
      where c.tenant_id = v_tenant_id
        and c.id = v_entity_id
    );

  end if;


  -- -------------------------------------------------------
  -- PRODUCT MEDIA READ
  -- -------------------------------------------------------

  if v_scope = 'products' then

    if not app_private.is_tenant_member(
      v_tenant_id
    ) then
      return false;
    end if;

    return exists (
      select 1
      from public.products p
      where p.tenant_id = v_tenant_id
        and p.id = v_entity_id
    );

  end if;


  return false;

end;
$function$;


revoke all
on function app_private.can_read_mavora_media_object(
  text
)
from public, anon;


grant execute
on function app_private.can_read_mavora_media_object(
  text
)
to authenticated, service_role;


-- =========================================================
-- 3. STORAGE PATH WRITE AUTHORIZATION
-- =========================================================

create or replace function
app_private.can_write_mavora_media_object(
  p_object_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_name text :=
    nullif(btrim(p_object_name), '');

  v_tenant_text text;
  v_scope text;
  v_entity_text text;

  v_tenant_id uuid;
  v_entity_id uuid;
begin

  if auth.uid() is null
     or v_name is null then
    return false;
  end if;


  if
       v_name !~
         '^[^/]+/(customers|products)/[^/]+/[^/]+$'

    or split_part(
         v_name,
         '/',
         4
       ) in ('.', '..')
  then
    return false;
  end if;


  v_tenant_text :=
    split_part(v_name, '/', 1);

  v_scope :=
    split_part(v_name, '/', 2);

  v_entity_text :=
    split_part(v_name, '/', 3);


  if v_tenant_text !~
    '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[1-5][0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$'
  then
    return false;
  end if;

  if v_entity_text !~
    '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[1-5][0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$'
  then
    return false;
  end if;


  v_tenant_id :=
    v_tenant_text::uuid;

  v_entity_id :=
    v_entity_text::uuid;


  -- -------------------------------------------------------
  -- CUSTOMER MEDIA WRITE
  -- -------------------------------------------------------

  if v_scope = 'customers' then

    if not app_private.has_capability(
      v_tenant_id,
      'sales.customer_manage',
      null
    ) then
      return false;
    end if;

    return exists (
      select 1
      from public.sales_customers c
      where c.tenant_id = v_tenant_id
        and c.id = v_entity_id
    );

  end if;


  -- -------------------------------------------------------
  -- PRODUCT MEDIA WRITE
  -- -------------------------------------------------------

  if v_scope = 'products' then

    if not app_private.has_capability(
      v_tenant_id,
      'masterdata.manage',
      null
    ) then
      return false;
    end if;

    return exists (
      select 1
      from public.products p
      where p.tenant_id = v_tenant_id
        and p.id = v_entity_id
    );

  end if;


  return false;

end;
$function$;


revoke all
on function app_private.can_write_mavora_media_object(
  text
)
from public, anon;


grant execute
on function app_private.can_write_mavora_media_object(
  text
)
to authenticated, service_role;


-- =========================================================
-- 4. STORAGE OBJECT RLS
-- =========================================================

drop policy if exists
  mavora_media_authenticated_select
on storage.objects;


create policy
  mavora_media_authenticated_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'mavora-media'
  and app_private.can_read_mavora_media_object(
    name
  )
);


drop policy if exists
  mavora_media_authenticated_insert
on storage.objects;


create policy
  mavora_media_authenticated_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'mavora-media'
  and app_private.can_write_mavora_media_object(
    name
  )
);


drop policy if exists
  mavora_media_authenticated_update
on storage.objects;


create policy
  mavora_media_authenticated_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'mavora-media'
  and app_private.can_write_mavora_media_object(
    name
  )
)
with check (
  bucket_id = 'mavora-media'
  and app_private.can_write_mavora_media_object(
    name
  )
);


drop policy if exists
  mavora_media_authenticated_delete
on storage.objects;


create policy
  mavora_media_authenticated_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'mavora-media'
  and app_private.can_write_mavora_media_object(
    name
  )
);


-- =========================================================
-- 5. COMMENTS / SECURITY CONTRACT
-- =========================================================

comment on function
app_private.can_read_mavora_media_object(
  text
) is
  'Storage RLS helper for private MAVORA media. Customer objects require sales.customer_view; Product objects require active tenant membership.';


comment on function
app_private.can_write_mavora_media_object(
  text
) is
  'Storage RLS helper for private MAVORA media. Customer writes require sales.customer_manage; Product writes require masterdata.manage.';


-- =========================================================
-- END
-- =========================================================
