-- =========================================================
-- MAVORA ERP
-- Phase 10B — Commercial License Foundation
--
-- Goals:
--   • Commercial product editions
--   • Tenant licenses
--   • Trial / subscription / perpetual / internal licenses
--   • Expiry / suspension / cancellation
--   • User and Site limits foundation
--   • Edition features
--   • Tenant-specific Add-ons / Custom Feature entitlements
--   • Platform-controlled commercial data
--
-- Existing MAVORA tenant / role / site / module foundation
-- remains unchanged.
--
-- Existing product editions:
--   PRODUCTION
--   MANUFACTURING
-- =========================================================


-- =========================================================
-- 1. PRODUCT EDITION CATALOG
-- =========================================================

create table if not exists
app_private.product_editions (
  code text primary key,

  name text not null,

  description text,

  is_active boolean
    not null
    default true,

  sort_order integer
    not null
    default 100,

  metadata jsonb
    not null
    default '{}'::jsonb,

  created_at timestamptz
    not null
    default now(),

  constraint product_editions_code_format_check
    check (
      code ~ '^[A-Z][A-Z0-9_]{1,63}$'
    )
);


-- =========================================================
-- 2. COMMERCIAL FEATURE CATALOG
-- =========================================================

create table if not exists
app_private.product_features (
  code text primary key,

  module_code text not null
    references public.platform_modules(code)
    on delete restrict,

  name text not null,

  description text,

  is_active boolean
    not null
    default true,

  metadata jsonb
    not null
    default '{}'::jsonb,

  created_at timestamptz
    not null
    default now(),

  constraint product_features_code_format_check
    check (
      code ~ '^[a-z][a-z0-9_.-]{2,127}$'
    )
);


-- =========================================================
-- 3. EDITION -> FEATURE CATALOG
-- =========================================================

create table if not exists
app_private.edition_features (
  edition_code text not null
    references app_private.product_editions(code)
    on delete restrict,

  feature_code text not null
    references app_private.product_features(code)
    on delete restrict,

  is_enabled boolean
    not null
    default true,

  config jsonb
    not null
    default '{}'::jsonb,

  created_at timestamptz
    not null
    default now(),

  primary key (
    edition_code,
    feature_code
  )
);


-- =========================================================
-- 4. VERSIONED TENANT LICENSE HISTORY
-- =========================================================

create table if not exists
app_private.tenant_licenses (
  id uuid primary key
    default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete cascade,

  edition_code text not null
    references app_private.product_editions(code)
    on delete restrict,

  license_type text not null,

  status text not null
    default 'active',

  starts_at timestamptz not null
    default now(),

  expires_at timestamptz,

  max_users integer,

  max_sites integer,

  license_reference text,

  is_current boolean not null
    default true,

  reason text,

  metadata jsonb not null
    default '{}'::jsonb,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  constraint tenant_licenses_type_check
    check (
      license_type in (
        'trial',
        'subscription',
        'perpetual',
        'internal'
      )
    ),

  constraint tenant_licenses_status_check
    check (
      status in (
        'active',
        'suspended',
        'cancelled'
      )
    ),

  constraint tenant_licenses_expiry_check
    check (
      expires_at is null
      or expires_at > starts_at
    ),

  constraint tenant_licenses_max_users_check
    check (
      max_users is null
      or max_users > 0
    ),

  constraint tenant_licenses_max_sites_check
    check (
      max_sites is null
      or max_sites > 0
    ),

  constraint tenant_licenses_reason_length_check
    check (
      reason is null
      or length(reason) <= 2000
    )
);


create unique index if not exists
tenant_licenses_current_tenant_uidx
on app_private.tenant_licenses (
  tenant_id
)
where is_current = true;


create unique index if not exists
tenant_licenses_reference_uidx
on app_private.tenant_licenses (
  license_reference
)
where license_reference is not null;


create index if not exists
tenant_licenses_tenant_history_idx
on app_private.tenant_licenses (
  tenant_id,
  created_at desc
);


create index if not exists
tenant_licenses_edition_idx
on app_private.tenant_licenses (
  edition_code
);


-- =========================================================
-- 5. TENANT FEATURE ADD-ON / OVERRIDE HISTORY
-- =========================================================

create table if not exists
app_private.tenant_feature_entitlements (
  id uuid primary key
    default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete cascade,

  feature_code text not null
    references app_private.product_features(code)
    on delete restrict,

  is_enabled boolean not null,

  entitlement_type text not null
    default 'addon',

  starts_at timestamptz not null
    default now(),

  expires_at timestamptz,

  is_current boolean not null
    default true,

  reason text,

  config jsonb not null
    default '{}'::jsonb,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  constraint tenant_feature_entitlements_type_check
    check (
      entitlement_type in (
        'addon',
        'custom',
        'contract',
        'platform_override'
      )
    ),

  constraint tenant_feature_entitlements_expiry_check
    check (
      expires_at is null
      or expires_at > starts_at
    ),

  constraint tenant_feature_entitlements_reason_length_check
    check (
      reason is null
      or length(reason) <= 2000
    )
);


create unique index if not exists
tenant_feature_entitlements_current_uidx
on app_private.tenant_feature_entitlements (
  tenant_id,
  feature_code
)
where is_current = true;


create index if not exists
tenant_feature_entitlements_tenant_idx
on app_private.tenant_feature_entitlements (
  tenant_id,
  created_at desc
);


create index if not exists
tenant_feature_entitlements_feature_idx
on app_private.tenant_feature_entitlements (
  feature_code
);


-- =========================================================
-- 6. DEFENSE IN DEPTH
-- =========================================================

alter table
app_private.product_editions
enable row level security;

alter table
app_private.product_features
enable row level security;

alter table
app_private.edition_features
enable row level security;

alter table
app_private.tenant_licenses
enable row level security;

alter table
app_private.tenant_feature_entitlements
enable row level security;


revoke all
on table
  app_private.product_editions,
  app_private.product_features,
  app_private.edition_features,
  app_private.tenant_licenses,
  app_private.tenant_feature_entitlements
from public, anon, authenticated;


grant select, insert, update, delete
on table
  app_private.product_editions,
  app_private.product_features,
  app_private.edition_features,
  app_private.tenant_licenses,
  app_private.tenant_feature_entitlements
to service_role;


-- =========================================================
-- 7. PRODUCT EDITIONS
-- =========================================================

insert into app_private.product_editions (
  code,
  name,
  description,
  sort_order
)
values
  (
    'PRODUCTION',
    'MAVORA Production Edition',
    'Simple factory production edition for controlled daily production operations.',
    10
  ),
  (
    'MANUFACTURING',
    'MAVORA Manufacturing Pro',
    'Advanced manufacturing edition with controlled BOM, Production Orders, Execution, Costing and Transfer Pricing.',
    20
  )
on conflict (code)
do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;


-- =========================================================
-- 8. INITIAL COMMERCIAL FEATURE CATALOG
-- =========================================================

insert into app_private.product_features (
  code,
  module_code,
  name,
  description
)
values
  (
    'production.simple',
    'production',
    'Simple Production',
    'Simple Production Edition workflow.'
  ),

  (
    'production.work_centers',
    'production',
    'Work Centers and Production Lines',
    'Controlled Work Center and Production Line management.'
  ),

  (
    'production.recipe_bom',
    'production',
    'Controlled Recipe and BOM',
    'Versioned Recipe and BOM management with controlled approval.'
  ),

  (
    'production.order_planning',
    'production',
    'Production Order Planning',
    'Controlled Production Order planning and frozen BOM snapshots.'
  ),

  (
    'production.execution',
    'production',
    'Production Execution',
    'Controlled Production Order release, start, material consumption, output and completion.'
  ),

  (
    'production.costing',
    'production',
    'Manufacturing Costing',
    'Actual Production Cost and Standard Cost management.'
  ),

  (
    'production.transfer_pricing',
    'production',
    'Transfer Pricing',
    'Factory, Distributor and Wholesale Transfer Pricing policy.'
  )
on conflict (code)
do update
set
  module_code = excluded.module_code,
  name = excluded.name,
  description = excluded.description,
  is_active = true;


-- =========================================================
-- 9. PRODUCTION EDITION FEATURE MAP
-- =========================================================

insert into app_private.edition_features (
  edition_code,
  feature_code,
  is_enabled
)
values
  (
    'PRODUCTION',
    'production.simple',
    true
  )
on conflict (
  edition_code,
  feature_code
)
do update
set
  is_enabled = excluded.is_enabled;


-- =========================================================
-- 10. MANUFACTURING PRO FEATURE MAP
-- =========================================================

insert into app_private.edition_features (
  edition_code,
  feature_code,
  is_enabled
)
values
  (
    'MANUFACTURING',
    'production.simple',
    true
  ),
  (
    'MANUFACTURING',
    'production.work_centers',
    true
  ),
  (
    'MANUFACTURING',
    'production.recipe_bom',
    true
  ),
  (
    'MANUFACTURING',
    'production.order_planning',
    true
  ),
  (
    'MANUFACTURING',
    'production.execution',
    true
  ),
  (
    'MANUFACTURING',
    'production.costing',
    true
  ),
  (
    'MANUFACTURING',
    'production.transfer_pricing',
    true
  )
on conflict (
  edition_code,
  feature_code
)
do update
set
  is_enabled = excluded.is_enabled;


-- =========================================================
-- 11. EFFECTIVE LICENSE CONTEXT
-- =========================================================

create or replace function
app_private.effective_tenant_license_context(
  p_tenant_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_license app_private.tenant_licenses%rowtype;
  v_effective_status text;
  v_access_allowed boolean := false;
begin

  select
    tl.*
  into
    v_license
  from app_private.tenant_licenses tl
  where tl.tenant_id = p_tenant_id
    and tl.is_current = true
  order by tl.created_at desc
  limit 1;


  if not found then
    return jsonb_build_object(
      'licensed',
        false,

      'access_allowed',
        false,

      'effective_status',
        'unlicensed',

      'license_id',
        null,

      'edition_code',
        null,

      'license_type',
        null,

      'starts_at',
        null,

      'expires_at',
        null,

      'max_users',
        null,

      'max_sites',
        null,

      'license_reference',
        null
    );
  end if;


  if v_license.status = 'suspended' then

    v_effective_status := 'suspended';

  elsif v_license.status = 'cancelled' then

    v_effective_status := 'cancelled';

  elsif v_license.starts_at > now() then

    v_effective_status := 'scheduled';

  elsif v_license.expires_at is not null
        and v_license.expires_at <= now()
  then

    v_effective_status := 'expired';

  elsif v_license.license_type = 'trial' then

    v_effective_status := 'trial';
    v_access_allowed := true;

  else

    v_effective_status := 'active';
    v_access_allowed := true;

  end if;


  return jsonb_build_object(
    'licensed',
      true,

    'access_allowed',
      v_access_allowed,

    'effective_status',
      v_effective_status,

    'license_id',
      v_license.id,

    'edition_code',
      v_license.edition_code,

    'license_type',
      v_license.license_type,

    'starts_at',
      v_license.starts_at,

    'expires_at',
      v_license.expires_at,

    'max_users',
      v_license.max_users,

    'max_sites',
      v_license.max_sites,

    'license_reference',
      v_license.license_reference
  );

end;
$function$;


-- =========================================================
-- 12. BASE LICENSE ACCESS CHECK
-- =========================================================

create or replace function
app_private.tenant_license_allows_access(
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$

  select
    coalesce(
      (
        app_private.effective_tenant_license_context(
          p_tenant_id
        )
        ->> 'access_allowed'
      )::boolean,
      false
    );

$function$;


-- =========================================================
-- 13. COMMERCIAL FEATURE RESOLVER
-- =========================================================

create or replace function
app_private.tenant_has_commercial_feature(
  p_tenant_id uuid,
  p_feature_code text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_edition_code text;
  v_override boolean;
begin

  if p_tenant_id is null
     or p_feature_code is null
     or length(
       btrim(
         p_feature_code
       )
     ) = 0
  then
    return false;
  end if;


  if not app_private.tenant_license_allows_access(
    p_tenant_id
  ) then
    return false;
  end if;


  select
    tl.edition_code
  into
    v_edition_code
  from app_private.tenant_licenses tl
  where tl.tenant_id = p_tenant_id
    and tl.is_current = true
  order by tl.created_at desc
  limit 1;


  if v_edition_code is null then
    return false;
  end if;


  if not exists (
    select 1
    from app_private.product_features pf
    where pf.code = btrim(p_feature_code)
      and pf.is_active = true
  ) then
    return false;
  end if;


  select
    tfe.is_enabled
  into
    v_override
  from app_private.tenant_feature_entitlements tfe
  where tfe.tenant_id = p_tenant_id
    and tfe.feature_code = btrim(p_feature_code)
    and tfe.is_current = true
    and tfe.starts_at <= now()
    and (
      tfe.expires_at is null
      or tfe.expires_at > now()
    )
  order by tfe.created_at desc
  limit 1;


  if found then
    return coalesce(
      v_override,
      false
    );
  end if;


  return exists (
    select 1
    from app_private.edition_features ef
    join app_private.product_features pf
      on pf.code = ef.feature_code
    where ef.edition_code = v_edition_code
      and ef.feature_code = btrim(p_feature_code)
      and ef.is_enabled = true
      and pf.is_active = true
  );

end;
$function$;


-- =========================================================
-- 14. MEMBER-SAFE LICENSE READ-SIDE
-- =========================================================

create or replace function
app_private.get_commercial_license_context_impl(
  p_tenant_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_context jsonb;
  v_features jsonb;
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
      'Tenant access denied';
  end if;


  v_context :=
    app_private.effective_tenant_license_context(
      p_tenant_id
    );


  select
    coalesce(
      jsonb_agg(
        pf.code
        order by pf.code
      ),
      '[]'::jsonb
    )
  into
    v_features
  from app_private.product_features pf
  where pf.is_active = true
    and app_private.tenant_has_commercial_feature(
      p_tenant_id,
      pf.code
    );


  return
    v_context
    ||
    jsonb_build_object(
      'enabled_features',
      v_features
    );

end;
$function$;


create or replace function
public.get_commercial_license_context(
  p_tenant_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$

  select
    app_private.get_commercial_license_context_impl(
      p_tenant_id
    );

$function$;


revoke all
on function
public.get_commercial_license_context(uuid)
from public, anon;

grant execute
on function
public.get_commercial_license_context(uuid)
to authenticated, service_role;


-- =========================================================
-- 15. MEMBER-SAFE FEATURE CHECK RPC
-- =========================================================

create or replace function
app_private.has_commercial_feature_impl(
  p_tenant_id uuid,
  p_feature_code text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;


  if not app_private.is_tenant_member(
    p_tenant_id
  ) then
    raise exception
      'Tenant access denied';
  end if;


  return
    app_private.tenant_has_commercial_feature(
      p_tenant_id,
      p_feature_code
    );

end;
$function$;


create or replace function
public.has_commercial_feature(
  p_tenant_id uuid,
  p_feature_code text
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$

  select
    app_private.has_commercial_feature_impl(
      p_tenant_id,
      p_feature_code
    );

$function$;


revoke all
on function
public.has_commercial_feature(uuid, text)
from public, anon;

grant execute
on function
public.has_commercial_feature(uuid, text)
to authenticated, service_role;


-- =========================================================
-- 16. PRIVATE FUNCTION PRIVILEGES
-- =========================================================

revoke all
on function
app_private.effective_tenant_license_context(uuid)
from public, anon, authenticated;

revoke all
on function
app_private.tenant_license_allows_access(uuid)
from public, anon, authenticated;

revoke all
on function
app_private.tenant_has_commercial_feature(uuid, text)
from public, anon, authenticated;

revoke all
on function
app_private.get_commercial_license_context_impl(uuid)
from public, anon;

revoke all
on function
app_private.has_commercial_feature_impl(uuid, text)
from public, anon;


grant execute
on function
app_private.get_commercial_license_context_impl(uuid)
to authenticated, service_role;

grant execute
on function
app_private.has_commercial_feature_impl(uuid, text)
to authenticated, service_role;


-- =========================================================
-- 17. SAT SAT YO EXISTING TENANT LICENSE
-- =========================================================
-- Preserve current DEV behavior.
-- Sat Sat Yo is the internal Manufacturing Pro pilot tenant.

insert into app_private.tenant_licenses (
  tenant_id,
  edition_code,
  license_type,
  status,
  starts_at,
  expires_at,
  max_users,
  max_sites,
  license_reference,
  is_current,
  reason,
  metadata
)
select
  t.id,
  'MANUFACTURING',
  'internal',
  'active',
  t.created_at,
  null,
  null,
  null,
  'MAV-SSY-INTERNAL',
  true,
  'Phase 10 bootstrap of existing Sat Sat Yo Manufacturing Pro tenant.',
  jsonb_build_object(
    'source',
    'phase_10_m40_bootstrap'
  )
from public.tenants t
where t.slug = 'sat-sat-yo'
  and not exists (
    select 1
    from app_private.tenant_licenses tl
    where tl.tenant_id = t.id
      and tl.is_current = true
  );


-- =========================================================
-- 18. LICENSE BOOTSTRAP AUDIT
-- =========================================================

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
select
  tl.tenant_id,
  null,
  null,
  'platform.license_bootstrap',
  'tenant_license',
  tl.id,
  null,
  jsonb_build_object(
    'edition_code',
      tl.edition_code,

    'license_type',
      tl.license_type,

    'status',
      tl.status,

    'starts_at',
      tl.starts_at,

    'expires_at',
      tl.expires_at,

    'max_users',
      tl.max_users,

    'max_sites',
      tl.max_sites
  ),
  tl.reason,
  jsonb_build_object(
    'migration',
    '20261107054143_mavora_commercial_license_foundation'
  )
from app_private.tenant_licenses tl
join public.tenants t
  on t.id = tl.tenant_id
where t.slug = 'sat-sat-yo'
  and tl.is_current = true
  and tl.metadata ->> 'source'
      = 'phase_10_m40_bootstrap'
  and not exists (
    select 1
    from public.audit_logs al
    where al.action = 'platform.license_bootstrap'
      and al.entity_type = 'tenant_license'
      and al.entity_id = tl.id
  );


-- =========================================================
-- 19. COMMERCIAL LICENSE -> PRODUCTION EDITION BRIDGE
-- =========================================================
-- M39 remains immutable.
-- M40 replaces the resolver so the commercial license becomes
-- the authoritative source for active Production Edition /
-- Manufacturing Pro access.

create or replace function
app_private.production_edition_code(
  p_tenant_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $function$

  select
    case
      when app_private.tenant_license_allows_access(
        p_tenant_id
      )
      and exists (
        select 1
        from app_private.tenant_licenses tl
        where tl.tenant_id = p_tenant_id
          and tl.is_current = true
          and tl.edition_code = 'MANUFACTURING'
      )
      then 'MANUFACTURING'

      else 'PRODUCTION'
    end;

$function$;


create or replace function
app_private.has_manufacturing_edition(
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$

  select
    app_private.production_edition_code(
      p_tenant_id
    ) = 'MANUFACTURING';

$function$;


-- =========================================================
-- 20. MANUFACTURING PRO LICENSE-AWARE REQUIRE CHECK
-- =========================================================

create or replace function
app_private.require_manufacturing_edition(
  p_tenant_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;


  if p_tenant_id is null then
    raise exception
      'Production tenant is required';
  end if;


  if not app_private.is_tenant_member(
    p_tenant_id
  ) then
    raise exception
      'Production tenant access denied';
  end if;


  if not app_private.tenant_license_allows_access(
    p_tenant_id
  ) then
    raise exception
      'MAVORA commercial license is not active';
  end if;


  if not app_private.has_manufacturing_edition(
    p_tenant_id
  ) then
    raise exception
      'MAVORA Manufacturing Pro edition required';
  end if;

end;
$function$;


-- =========================================================
-- 21. PRODUCTION EDITION READ-SIDE ENRICHMENT
-- =========================================================

create or replace function
app_private.get_production_edition_impl(
  p_tenant_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_edition_code text;
  v_license_context jsonb;
begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;


  if p_tenant_id is null then
    raise exception
      'Production tenant is required';
  end if;


  if not app_private.is_tenant_member(
    p_tenant_id
  ) then
    raise exception
      'Production tenant access denied';
  end if;


  v_edition_code :=
    app_private.production_edition_code(
      p_tenant_id
    );


  v_license_context :=
    app_private.effective_tenant_license_context(
      p_tenant_id
    );


  return jsonb_build_object(
    'ok',
      true,

    'edition_code',
      v_edition_code,

    'is_manufacturing',
      v_edition_code = 'MANUFACTURING',

    'license_status',
      v_license_context ->> 'effective_status',

    'license_type',
      v_license_context ->> 'license_type',

    'access_allowed',
      coalesce(
        (
          v_license_context
          ->> 'access_allowed'
        )::boolean,
        false
      ),

    'expires_at',
      v_license_context -> 'expires_at'
  );

end;
$function$;


-- =========================================================
-- END MIGRATION 040
-- =========================================================
