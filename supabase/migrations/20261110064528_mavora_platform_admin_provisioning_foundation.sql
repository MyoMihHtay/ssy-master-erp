
-- =========================================================
-- MAVORA ERP
-- Phase 10D — Platform Administration / Commercial Provisioning
--
-- Goals:
--   • Separate platform-wide administrator identity
--   • No tenant OWNER => implicit platform administrator
--   • No frontend service-role dependency
--   • Atomic commercial tenant provisioning
--   • Supports PRODUCTION and MANUFACTURING editions
--   • Existing tenants remain unchanged
-- =========================================================


-- =========================================================
-- 1. PRIVATE PLATFORM ADMINISTRATOR ALLOWLIST
-- =========================================================

create table
app_private.platform_administrators (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  status text not null
    default 'active',

  note text,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint platform_administrators_status_check
    check (
      status in (
        'active',
        'inactive'
      )
    ),

  constraint platform_administrators_note_length_check
    check (
      note is null
      or length(note) <= 2000
    )
);


create index
platform_administrators_created_by_idx
on app_private.platform_administrators (
  created_by
);


alter table
app_private.platform_administrators
enable row level security;


revoke all
on table
app_private.platform_administrators
from public, anon, authenticated;


grant select, insert, update, delete
on table
app_private.platform_administrators
to service_role;


-- =========================================================
-- 2. PRIVATE PLATFORM ADMIN CHECK
-- =========================================================

create or replace function
app_private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$

  select
    auth.uid() is not null
    and exists (
      select 1
      from app_private.platform_administrators pa
      where pa.user_id = auth.uid()
        and pa.status = 'active'
    );

$function$;


revoke all
on function
app_private.is_platform_admin()
from public, anon;


grant execute
on function
app_private.is_platform_admin()
to authenticated, service_role;


-- =========================================================
-- 3. MEMBER-SAFE PLATFORM ADMIN CONTEXT
-- =========================================================

create or replace function
public.get_platform_admin_context()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$

  select jsonb_build_object(
    'is_platform_admin',
    app_private.is_platform_admin()
  );

$function$;


revoke all
on function
public.get_platform_admin_context()
from public, anon;


grant execute
on function
public.get_platform_admin_context()
to authenticated;


-- =========================================================
-- 4. CONTROLLED COMMERCIAL TENANT PROVISIONING
-- =========================================================

create or replace function
app_private.provision_commercial_tenant_admin_impl(
  p_organization_id uuid,

  p_organization_code text,
  p_organization_name text,

  p_tenant_code text,
  p_tenant_slug text,
  p_tenant_name text,

  p_owner_user_id uuid,

  p_edition_code text,
  p_license_type text,
  p_license_reference text,

  p_organization_legal_name text
    default null,

  p_tenant_legal_name text
    default null,

  p_starts_at timestamptz
    default now(),

  p_expires_at timestamptz
    default null,

  p_max_users integer
    default null,

  p_max_sites integer
    default null,

  p_reason text
    default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := auth.uid();

  v_organization_id uuid;
  v_tenant_id uuid;
  v_membership_id uuid;
  v_owner_role_id uuid;
  v_role_assignment_id uuid;
  v_license_id uuid;

  v_capability_count integer;
begin

  -- -------------------------------------------------------
  -- PLATFORM AUTHORIZATION FIRST
  -- -------------------------------------------------------

  if v_actor_user_id is null then
    raise exception
      'Authentication required';
  end if;


  if not app_private.is_platform_admin() then
    raise exception
      'Platform administrator access required';
  end if;


  -- -------------------------------------------------------
  -- REQUIRED INPUT VALIDATION
  -- -------------------------------------------------------

  if p_organization_code is null
     or length(btrim(p_organization_code)) = 0
  then
    raise exception
      'Organization code is required';
  end if;


  if upper(btrim(p_organization_code))
     !~ '^[A-Z][A-Z0-9_-]{1,31}$'
  then
    raise exception
      'Organization code format is invalid';
  end if;


  if p_organization_name is null
     or length(btrim(p_organization_name)) = 0
  then
    raise exception
      'Organization name is required';
  end if;


  if length(btrim(p_organization_name)) > 200 then
    raise exception
      'Organization name cannot exceed 200 characters';
  end if;


  if p_tenant_code is null
     or length(btrim(p_tenant_code)) = 0
  then
    raise exception
      'Tenant code is required';
  end if;


  if upper(btrim(p_tenant_code))
     !~ '^[A-Z][A-Z0-9_-]{1,31}$'
  then
    raise exception
      'Tenant code format is invalid';
  end if;


  if p_tenant_slug is null
     or btrim(p_tenant_slug)
        !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'
  then
    raise exception
      'Tenant slug format is invalid';
  end if;


  if p_tenant_name is null
     or length(btrim(p_tenant_name)) = 0
  then
    raise exception
      'Tenant name is required';
  end if;


  if length(btrim(p_tenant_name)) > 200 then
    raise exception
      'Tenant name cannot exceed 200 characters';
  end if;


  if p_owner_user_id is null then
    raise exception
      'Owner user is required';
  end if;


  if not exists (
    select 1
    from public.profiles p
    where p.id = p_owner_user_id
      and p.status = 'active'
  ) then
    raise exception
      'Active owner profile not found';
  end if;


  if p_edition_code not in (
    'PRODUCTION',
    'MANUFACTURING'
  ) then
    raise exception
      'Unsupported MAVORA edition';
  end if;


  if not exists (
    select 1
    from app_private.product_editions pe
    where pe.code = p_edition_code
      and pe.is_active = true
  ) then
    raise exception
      'MAVORA edition is not active';
  end if;


  if p_license_type not in (
    'trial',
    'subscription',
    'perpetual',
    'internal'
  ) then
    raise exception
      'Unsupported license type';
  end if;


  if p_license_reference is null
     or length(btrim(p_license_reference)) = 0
  then
    raise exception
      'License reference is required';
  end if;


  if length(btrim(p_license_reference)) > 128 then
    raise exception
      'License reference cannot exceed 128 characters';
  end if;


  if p_starts_at is null then
    raise exception
      'License start time is required';
  end if;


  if p_expires_at is not null
     and p_expires_at <= p_starts_at
  then
    raise exception
      'License expiry must be after start time';
  end if;


  if p_max_users is not null
     and p_max_users <= 0
  then
    raise exception
      'Maximum users must be greater than zero';
  end if;


  if p_max_sites is not null
     and p_max_sites <= 0
  then
    raise exception
      'Maximum sites must be greater than zero';
  end if;


  if p_reason is not null
     and length(p_reason) > 2000
  then
    raise exception
      'Reason cannot exceed 2000 characters';
  end if;


  -- -------------------------------------------------------
  -- ORGANIZATION
  -- NULL = create new organization.
  -- NON-NULL = reuse exact existing active organization.
  -- -------------------------------------------------------

  if p_organization_id is null then

    insert into public.organizations (
      code,
      name,
      legal_name,
      status
    )
    values (
      upper(btrim(p_organization_code)),
      btrim(p_organization_name),
      nullif(
        btrim(p_organization_legal_name),
        ''
      ),
      'active'
    )
    returning id
    into v_organization_id;

  else

    select o.id
    into v_organization_id
    from public.organizations o
    where o.id = p_organization_id
      and o.code =
        upper(
          btrim(
            p_organization_code
          )
        )
      and o.name =
        btrim(
          p_organization_name
        )
      and o.status = 'active';

    if not found then
      raise exception
        'Existing organization identity does not match';
    end if;

  end if;


  -- -------------------------------------------------------
  -- TENANT
  -- -------------------------------------------------------

  insert into public.tenants (
    organization_id,
    code,
    slug,
    name,
    legal_name,
    country_code,
    currency_code,
    timezone,
    status
  )
  values (
    v_organization_id,
    upper(
      btrim(
        p_tenant_code
      )
    ),
    btrim(
      p_tenant_slug
    ),
    btrim(
      p_tenant_name
    ),
    nullif(
      btrim(
        p_tenant_legal_name
      ),
      ''
    ),
    'MM',
    'MMK',
    'Asia/Yangon',
    'active'
  )
  returning id
  into v_tenant_id;


  -- -------------------------------------------------------
  -- OWNER MEMBERSHIP
  -- -------------------------------------------------------

  insert into public.tenant_memberships (
    tenant_id,
    user_id,
    status,
    joined_at,
    default_site_id
  )
  values (
    v_tenant_id,
    p_owner_user_id,
    'active',
    now(),
    null
  )
  returning id
  into v_membership_id;


  -- -------------------------------------------------------
  -- TENANT OWNER ROLE
  -- -------------------------------------------------------

  insert into public.roles (
    tenant_id,
    code,
    name,
    description,
    is_system_seed,
    is_active
  )
  values (
    v_tenant_id,
    'OWNER',
    'Owner / Managing Director',
    'Commercial tenant owner',
    true,
    true
  )
  returning id
  into v_owner_role_id;


  -- -------------------------------------------------------
  -- OWNER CAPABILITIES
  -- Clone the active capability catalog, not another tenant.
  -- Edition-specific execution remains protected by
  -- commercial edition checks in controlled RPCs.
  -- -------------------------------------------------------

  insert into public.role_capabilities (
    role_id,
    capability_code,
    tenant_id
  )
  select
    v_owner_role_id,
    c.code,
    v_tenant_id
  from public.capabilities c
  where c.is_active = true;


  get diagnostics
    v_capability_count = row_count;


  if v_capability_count <= 0 then
    raise exception
      'No active capability catalog available';
  end if;


  -- -------------------------------------------------------
  -- TENANT-WIDE OWNER ASSIGNMENT
  -- -------------------------------------------------------

  insert into public.role_assignments (
    membership_id,
    role_id,
    site_id,
    created_by,
    tenant_id
  )
  values (
    v_membership_id,
    v_owner_role_id,
    null,
    v_actor_user_id,
    v_tenant_id
  )
  returning id
  into v_role_assignment_id;


  -- -------------------------------------------------------
  -- COMMERCIAL LICENSE
  -- -------------------------------------------------------

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
    metadata,
    created_by
  )
  values (
    v_tenant_id,
    p_edition_code,
    p_license_type,
    'active',
    p_starts_at,
    p_expires_at,
    p_max_users,
    p_max_sites,
    btrim(p_license_reference),
    true,
    nullif(
      btrim(p_reason),
      ''
    ),
    jsonb_build_object(
      'source',
      'platform_admin_provisioning'
    ),
    v_actor_user_id
  )
  returning id
  into v_license_id;


  -- -------------------------------------------------------
  -- AUDIT
  -- -------------------------------------------------------

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
    v_tenant_id,
    null,
    v_actor_user_id,
    'platform.tenant_provision',
    'tenant',
    v_tenant_id,
    null,
    jsonb_build_object(
      'organization_id',
        v_organization_id,

      'tenant_code',
        upper(
          btrim(
            p_tenant_code
          )
        ),

      'tenant_slug',
        btrim(
          p_tenant_slug
        ),

      'tenant_name',
        btrim(
          p_tenant_name
        ),

      'owner_user_id',
        p_owner_user_id,

      'owner_role_id',
        v_owner_role_id,

      'edition_code',
        p_edition_code,

      'license_type',
        p_license_type,

      'license_id',
        v_license_id,

      'license_reference',
        btrim(
          p_license_reference
        ),

      'owner_capability_count',
        v_capability_count
    ),
    nullif(
      btrim(p_reason),
      ''
    ),
    jsonb_build_object(
      'source',
      'platform_admin_provisioning'
    )
  );


  return jsonb_build_object(
    'ok',
      true,

    'organization_id',
      v_organization_id,

    'tenant_id',
      v_tenant_id,

    'membership_id',
      v_membership_id,

    'owner_role_id',
      v_owner_role_id,

    'role_assignment_id',
      v_role_assignment_id,

    'license_id',
      v_license_id,

    'edition_code',
      p_edition_code,

    'license_type',
      p_license_type,

    'license_reference',
      btrim(
        p_license_reference
      ),

    'owner_capability_count',
      v_capability_count
  );

end;
$function$;


-- =========================================================
-- 5. AUTHENTICATED PUBLIC RPC WRAPPER
-- =========================================================

create or replace function
public.provision_commercial_tenant_admin(
  p_organization_id uuid,

  p_organization_code text,
  p_organization_name text,

  p_tenant_code text,
  p_tenant_slug text,
  p_tenant_name text,

  p_owner_user_id uuid,

  p_edition_code text,
  p_license_type text,
  p_license_reference text,

  p_organization_legal_name text
    default null,

  p_tenant_legal_name text
    default null,

  p_starts_at timestamptz
    default now(),

  p_expires_at timestamptz
    default null,

  p_max_users integer
    default null,

  p_max_sites integer
    default null,

  p_reason text
    default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$

  select
    app_private.provision_commercial_tenant_admin_impl(
      p_organization_id,
      p_organization_code,
      p_organization_name,
      p_tenant_code,
      p_tenant_slug,
      p_tenant_name,
      p_owner_user_id,
      p_edition_code,
      p_license_type,
      p_license_reference,
      p_organization_legal_name,
      p_tenant_legal_name,
      p_starts_at,
      p_expires_at,
      p_max_users,
      p_max_sites,
      p_reason
    );

$function$;


revoke all
on function
public.provision_commercial_tenant_admin(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  integer,
  integer,
  text
)
from public, anon;


grant execute
on function
public.provision_commercial_tenant_admin(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  integer,
  integer,
  text
)
to authenticated;


revoke all
on function
app_private.provision_commercial_tenant_admin_impl(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  integer,
  integer,
  text
)
from public, anon;


grant execute
on function
app_private.provision_commercial_tenant_admin_impl(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  integer,
  integer,
  text
)
to authenticated;


-- =========================================================
-- END PHASE 10D PLATFORM ADMIN PROVISIONING FOUNDATION
-- =========================================================
