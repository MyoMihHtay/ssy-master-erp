-- =========================================================
-- MAVORA ERP
-- Customer CRM + Media Foundation
--
-- Phase 2P-6N-7
--
-- Design boundaries:
--   * sales_customers.customer_code remains the tenant-local
--     user-facing Customer ID / Customer Code.
--   * Existing internal UUID remains the database identity.
--   * Existing gps text remains backward-compatible.
--   * Structured latitude / longitude fields support
--     device-captured GPS and future Route / Map features.
--   * Customer and Product image binaries are NOT stored
--     inside PostgreSQL tables.
--   * Media tables store only private Storage object metadata.
--   * Storage bucket + storage.objects policies are handled
--     separately after this schema foundation is reviewed.
--   * Customer CRM activity history is append-oriented.
--   * Outstanding Balance / AR remains out of scope here.
-- =========================================================


-- =========================================================
-- 1. CUSTOMER CRM PROFILE EXTENSION
-- =========================================================

alter table public.sales_customers
  add column contact_person text,
  add column email text,
  add column township text,
  add column area text,
  add column route_code text,
  add column customer_segment text,
  add column assigned_sales_user_id uuid,
  add column latitude numeric(9,6),
  add column longitude numeric(9,6),
  add column gps_accuracy_m numeric(10,2),
  add column gps_source text,
  add column gps_captured_at timestamptz;


alter table public.sales_customers
  add constraint sales_customers_contact_person_length
  check (
    contact_person is null
    or length(btrim(contact_person)) <= 200
  );


alter table public.sales_customers
  add constraint sales_customers_email_length
  check (
    email is null
    or length(btrim(email)) <= 320
  );


alter table public.sales_customers
  add constraint sales_customers_township_length
  check (
    township is null
    or length(btrim(township)) <= 200
  );


alter table public.sales_customers
  add constraint sales_customers_area_length
  check (
    area is null
    or length(btrim(area)) <= 200
  );


alter table public.sales_customers
  add constraint sales_customers_route_code_length
  check (
    route_code is null
    or length(btrim(route_code)) <= 120
  );


alter table public.sales_customers
  add constraint sales_customers_segment_length
  check (
    customer_segment is null
    or length(btrim(customer_segment)) <= 120
  );


alter table public.sales_customers
  add constraint sales_customers_latitude_check
  check (
    latitude is null
    or (
      latitude >= -90
      and latitude <= 90
    )
  );


alter table public.sales_customers
  add constraint sales_customers_longitude_check
  check (
    longitude is null
    or (
      longitude >= -180
      and longitude <= 180
    )
  );


alter table public.sales_customers
  add constraint sales_customers_gps_accuracy_check
  check (
    gps_accuracy_m is null
    or gps_accuracy_m >= 0
  );


alter table public.sales_customers
  add constraint sales_customers_gps_source_check
  check (
    gps_source is null
    or gps_source in (
      'device',
      'manual',
      'imported'
    )
  );


alter table public.sales_customers
  add constraint sales_customers_assigned_sales_user_fk
  foreign key (assigned_sales_user_id)
  references auth.users(id)
  on delete set null;


create index
sales_customers_tenant_route_idx
on public.sales_customers (
  tenant_id,
  route_code
)
where route_code is not null;


create index
sales_customers_tenant_segment_idx
on public.sales_customers (
  tenant_id,
  customer_segment
)
where customer_segment is not null;


create index
sales_customers_tenant_assigned_sales_user_idx
on public.sales_customers (
  tenant_id,
  assigned_sales_user_id
)
where assigned_sales_user_id is not null;


-- =========================================================
-- 2. CUSTOMER MEDIA METADATA
-- =========================================================

create table public.sales_customer_media (
  id uuid primary key
    default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete restrict,

  customer_id uuid not null,

  media_kind text not null,

  storage_bucket text not null,

  object_path text not null,

  original_file_name text,

  mime_type text,

  file_size_bytes bigint,

  caption text,

  is_primary boolean not null
    default false,

  sort_order integer not null
    default 0,

  captured_at timestamptz,

  latitude numeric(9,6),

  longitude numeric(9,6),

  gps_accuracy_m numeric(10,2),

  uploaded_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint sales_customer_media_kind_check
    check (
      media_kind in (
        'profile',
        'shop_front',
        'shop_inside',
        'other'
      )
    ),

  constraint sales_customer_media_bucket_not_blank
    check (
      length(btrim(storage_bucket)) > 0
      and length(btrim(storage_bucket)) <= 100
    ),

  constraint sales_customer_media_object_path_not_blank
    check (
      length(btrim(object_path)) > 0
      and length(btrim(object_path)) <= 1000
    ),

  constraint sales_customer_media_original_name_length
    check (
      original_file_name is null
      or length(original_file_name) <= 500
    ),

  constraint sales_customer_media_mime_length
    check (
      mime_type is null
      or length(btrim(mime_type)) <= 150
    ),

  constraint sales_customer_media_file_size_check
    check (
      file_size_bytes is null
      or (
        file_size_bytes > 0
        and file_size_bytes <= 20971520
      )
    ),

  constraint sales_customer_media_caption_length
    check (
      caption is null
      or length(caption) <= 500
    ),

  constraint sales_customer_media_sort_order_check
    check (
      sort_order >= 0
    ),

  constraint sales_customer_media_latitude_check
    check (
      latitude is null
      or (
        latitude >= -90
        and latitude <= 90
      )
    ),

  constraint sales_customer_media_longitude_check
    check (
      longitude is null
      or (
        longitude >= -180
        and longitude <= 180
      )
    ),

  constraint sales_customer_media_gps_accuracy_check
    check (
      gps_accuracy_m is null
      or gps_accuracy_m >= 0
    ),

  constraint sales_customer_media_id_tenant_key
    unique (id, tenant_id),

  constraint sales_customer_media_customer_tenant_fk
    foreign key (
      customer_id,
      tenant_id
    )
    references public.sales_customers (
      id,
      tenant_id
    )
    on delete cascade
);


create unique index
sales_customer_media_tenant_bucket_path_uq
on public.sales_customer_media (
  tenant_id,
  storage_bucket,
  object_path
);


create unique index
sales_customer_media_primary_kind_uq
on public.sales_customer_media (
  tenant_id,
  customer_id,
  media_kind
)
where is_primary = true;


create index
sales_customer_media_customer_idx
on public.sales_customer_media (
  tenant_id,
  customer_id,
  media_kind,
  sort_order,
  created_at
);


create trigger trg_sales_customer_media_set_updated_at
before update
on public.sales_customer_media
for each row
execute function public.set_updated_at();


-- =========================================================
-- 3. PRODUCT MEDIA METADATA
-- =========================================================

create table public.product_media (
  id uuid primary key
    default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete restrict,

  product_id uuid not null,

  media_kind text not null,

  storage_bucket text not null,

  object_path text not null,

  original_file_name text,

  mime_type text,

  file_size_bytes bigint,

  caption text,

  is_primary boolean not null
    default false,

  sort_order integer not null
    default 0,

  uploaded_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint product_media_kind_check
    check (
      media_kind in (
        'product',
        'packaging',
        'label',
        'other'
      )
    ),

  constraint product_media_bucket_not_blank
    check (
      length(btrim(storage_bucket)) > 0
      and length(btrim(storage_bucket)) <= 100
    ),

  constraint product_media_object_path_not_blank
    check (
      length(btrim(object_path)) > 0
      and length(btrim(object_path)) <= 1000
    ),

  constraint product_media_original_name_length
    check (
      original_file_name is null
      or length(original_file_name) <= 500
    ),

  constraint product_media_mime_length
    check (
      mime_type is null
      or length(btrim(mime_type)) <= 150
    ),

  constraint product_media_file_size_check
    check (
      file_size_bytes is null
      or (
        file_size_bytes > 0
        and file_size_bytes <= 20971520
      )
    ),

  constraint product_media_caption_length
    check (
      caption is null
      or length(caption) <= 500
    ),

  constraint product_media_sort_order_check
    check (
      sort_order >= 0
    ),

  constraint product_media_id_tenant_key
    unique (id, tenant_id),

  constraint product_media_product_tenant_fk
    foreign key (
      product_id,
      tenant_id
    )
    references public.products (
      id,
      tenant_id
    )
    on delete cascade
);


create unique index
product_media_tenant_bucket_path_uq
on public.product_media (
  tenant_id,
  storage_bucket,
  object_path
);


create unique index
product_media_primary_uq
on public.product_media (
  tenant_id,
  product_id
)
where is_primary = true;


create index
product_media_product_idx
on public.product_media (
  tenant_id,
  product_id,
  sort_order,
  created_at
);


create trigger trg_product_media_set_updated_at
before update
on public.product_media
for each row
execute function public.set_updated_at();


-- =========================================================
-- 4. CUSTOMER CRM ACTIVITY HISTORY
-- =========================================================

create table public.sales_customer_activities (
  id uuid primary key
    default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete restrict,

  customer_id uuid not null,

  activity_type text not null,

  subject text,

  note text,

  outcome text,

  occurred_at timestamptz not null
    default now(),

  next_follow_up_at timestamptz,

  latitude numeric(9,6),

  longitude numeric(9,6),

  gps_accuracy_m numeric(10,2),

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  constraint sales_customer_activities_type_check
    check (
      activity_type in (
        'visit',
        'call',
        'message',
        'follow_up',
        'note',
        'collection',
        'other'
      )
    ),

  constraint sales_customer_activities_subject_length
    check (
      subject is null
      or length(btrim(subject)) <= 300
    ),

  constraint sales_customer_activities_note_length
    check (
      note is null
      or length(note) <= 4000
    ),

  constraint sales_customer_activities_outcome_length
    check (
      outcome is null
      or length(outcome) <= 1000
    ),

  constraint sales_customer_activities_latitude_check
    check (
      latitude is null
      or (
        latitude >= -90
        and latitude <= 90
      )
    ),

  constraint sales_customer_activities_longitude_check
    check (
      longitude is null
      or (
        longitude >= -180
        and longitude <= 180
      )
    ),

  constraint sales_customer_activities_gps_accuracy_check
    check (
      gps_accuracy_m is null
      or gps_accuracy_m >= 0
    ),

  constraint sales_customer_activities_id_tenant_key
    unique (id, tenant_id),

  constraint sales_customer_activities_customer_tenant_fk
    foreign key (
      customer_id,
      tenant_id
    )
    references public.sales_customers (
      id,
      tenant_id
    )
    on delete cascade
);


create index
sales_customer_activities_customer_time_idx
on public.sales_customer_activities (
  tenant_id,
  customer_id,
  occurred_at desc
);


create index
sales_customer_activities_follow_up_idx
on public.sales_customer_activities (
  tenant_id,
  next_follow_up_at
)
where next_follow_up_at is not null;


create index
sales_customer_activities_created_by_idx
on public.sales_customer_activities (
  tenant_id,
  created_by
)
where created_by is not null;


-- =========================================================
-- 5. SECURITY BOUNDARY
-- =========================================================

alter table public.sales_customer_media
enable row level security;


alter table public.product_media
enable row level security;


alter table public.sales_customer_activities
enable row level security;


-- These tables are intentionally RPC-controlled.
-- Storage file access will use separate storage.objects RLS.
revoke all
on table public.sales_customer_media
from public, anon, authenticated;


revoke all
on table public.product_media
from public, anon, authenticated;


revoke all
on table public.sales_customer_activities
from public, anon, authenticated;


grant all
on table public.sales_customer_media
to service_role;


grant all
on table public.product_media
to service_role;


grant all
on table public.sales_customer_activities
to service_role;


-- =========================================================
-- 6. COMMENTS / CONTRACT
-- =========================================================

comment on column public.sales_customers.customer_code is
  'Tenant-local user-facing Customer ID / Customer Code. Internal database identity remains the UUID id column.';


comment on column public.sales_customers.latitude is
  'Structured customer latitude for device/manual/imported GPS capture. Existing gps text remains backward-compatible.';


comment on column public.sales_customers.longitude is
  'Structured customer longitude for device/manual/imported GPS capture. Existing gps text remains backward-compatible.';


comment on column public.sales_customers.gps_source is
  'Origin of the structured GPS value: device, manual or imported.';


comment on table public.sales_customer_media is
  'Private Storage metadata for Customer Profile, Shop Front, Shop Inside and other CRM images. Binary files are not stored in PostgreSQL.';


comment on table public.product_media is
  'Private Storage metadata for Product, Packaging, Label and other product images. Product SKU and Barcode remain on public.products.';


comment on table public.sales_customer_activities is
  'Controlled Customer CRM activity history including visits, calls, follow-ups, notes and collection interactions.';


comment on column public.sales_customer_media.object_path is
  'Private Supabase Storage object path. Do not store base64 image binary or permanent public URLs here.';


comment on column public.product_media.object_path is
  'Private Supabase Storage object path. Do not store base64 image binary or permanent public URLs here.';


-- =========================================================
-- END
-- =========================================================
