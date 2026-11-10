
-- =========================================================
-- MAVORA ERP
-- Phase 10D — Commercial Provisioning / Organization Seed Bridge
--
-- Keeps the existing public commercial provisioning API.
--
-- Provisioning now performs:
--   Organization
--   -> Tenant
--   -> Initial OWNER membership / role
--   -> Commercial license
--   -> Standard Departments
--   -> Standard Job Positions
--   -> Job Descriptions
--   -> Duties & Responsibilities
--   -> Standard least-privilege system roles
--
-- No standard employee role is automatically assigned.
-- MAVORA Platform Administrator remains separate.
-- =========================================================


-- =========================================================
-- 1. PRIVATE COMMERCIAL PROVISIONING + ORG STRUCTURE WRAPPER
-- =========================================================

create or replace function
app_private.provision_commercial_tenant_with_structure_admin_impl(
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
  v_result jsonb;
  v_tenant_id uuid;
  v_structure jsonb;
begin

  -- The existing controlled provisioning implementation
  -- remains the authority for Platform Admin validation,
  -- organization / tenant creation, OWNER initialization,
  -- license creation and audit logging.

  v_result :=
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


  v_tenant_id :=
    nullif(
      v_result ->> 'tenant_id',
      ''
    )::uuid;


  if v_tenant_id is null then
    raise exception
      'Provisioned tenant identifier was not returned';
  end if;


  -- Seed the standard editable organization structure.
  -- This does NOT assign standard roles to employees/users.

  v_structure :=
    app_private.seed_standard_org_structure(
      v_tenant_id
    );


  return
    v_result
    ||
    jsonb_build_object(
      'organization_structure',
      v_structure
    );

end;
$function$;


revoke all
on function
app_private.provision_commercial_tenant_with_structure_admin_impl(
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
app_private.provision_commercial_tenant_with_structure_admin_impl(
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
to authenticated, service_role;


-- =========================================================
-- 2. KEEP EXISTING PUBLIC API, ROUTE THROUGH STRUCTURE BRIDGE
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
    app_private.provision_commercial_tenant_with_structure_admin_impl(
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


-- =========================================================
-- END PHASE 10D COMMERCIAL PROVISIONING / ORG SEED BRIDGE
-- =========================================================
