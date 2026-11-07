-- =========================================================
-- MAVORA ERP
-- Phase 9D — Production Edition Entitlement Foundation
--
-- Product editions:
--   PRODUCTION     = MAVORA Production Edition
--   MANUFACTURING  = MAVORA Manufacturing Pro Edition
--
-- Design:
--   Reuse public.tenant_modules.config for entitlement.
--   No new entitlement table.
--
-- Fail-safe:
--   Missing / invalid / disabled production-module config
--   resolves to PRODUCTION.
--
-- Manufacturing Pro-only:
--   Work Center / Production Line management
--   Controlled Recipe / BOM writes
--   Production Order planning / execution
--   Manufacturing Costing / Transfer Pricing
-- =========================================================


-- =========================================================
-- 1. CANONICAL EDITION RESOLVER
-- =========================================================

create or replace function
app_private.production_edition_code(
  p_tenant_id uuid
)
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $function$

  select
    case
      when upper(
        coalesce(
          (
            select
              tm.config ->> 'edition_code'
            from public.tenant_modules tm
            where tm.tenant_id = p_tenant_id
              and tm.module_code = 'production'
              and tm.is_enabled = true
            limit 1
          ),
          'PRODUCTION'
        )
      ) = 'MANUFACTURING'
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
set search_path = pg_catalog
as $function$

  select
    app_private.production_edition_code(
      p_tenant_id
    ) = 'MANUFACTURING';

$function$;


-- =========================================================
-- 2. CONTROLLED EDITION ACCESS CHECK
-- =========================================================

create or replace function
app_private.require_manufacturing_edition(
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
      'Production tenant is required';
  end if;


  if not app_private.is_tenant_member(
    p_tenant_id
  ) then
    raise exception
      'Production tenant access denied';
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
-- 3. CLIENT READ-SIDE
-- =========================================================

create or replace function
app_private.get_production_edition_impl(
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_edition_code text;
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


  return jsonb_build_object(
    'ok',
      true,

    'edition_code',
      v_edition_code,

    'is_manufacturing',
      v_edition_code = 'MANUFACTURING'
  );

end;
$function$;


create or replace function
public.get_production_edition(
  p_tenant_id uuid
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$

  select
    app_private.get_production_edition_impl(
      p_tenant_id
    );

$function$;


revoke all
on function public.get_production_edition(uuid)
from public, anon;

grant execute
on function public.get_production_edition(uuid)
to authenticated, service_role;


-- =========================================================
-- 4. GENERIC MANUFACTURING PRO WRITE GUARD
-- =========================================================

create or replace function
app_private.guard_manufacturing_pro_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_tenant_id uuid;
begin

  v_tenant_id :=
    case
      when tg_op = 'DELETE'
        then old.tenant_id
      else new.tenant_id
    end;


  if v_tenant_id is null then
    raise exception
      'Manufacturing tenant is required';
  end if;


  if not app_private.has_manufacturing_edition(
    v_tenant_id
  ) then
    raise exception
      'MAVORA Manufacturing Pro edition required';
  end if;


  return
    case
      when tg_op = 'DELETE'
        then old
      else new
    end;

end;
$function$;


revoke all
on function app_private.guard_manufacturing_pro_write()
from public, anon, authenticated;


-- =========================================================
-- 5. MANUFACTURING PRO TABLE BOUNDARY
-- =========================================================

drop trigger if exists
trg_work_centers_manufacturing_edition
on public.work_centers;

create trigger
trg_work_centers_manufacturing_edition
before insert or update or delete
on public.work_centers
for each row
execute function
app_private.guard_manufacturing_pro_write();


drop trigger if exists
trg_production_lines_manufacturing_edition
on public.production_lines;

create trigger
trg_production_lines_manufacturing_edition
before insert or update or delete
on public.production_lines
for each row
execute function
app_private.guard_manufacturing_pro_write();


drop trigger if exists
trg_production_recipes_manufacturing_edition
on public.production_recipes;

create trigger
trg_production_recipes_manufacturing_edition
before insert or update or delete
on public.production_recipes
for each row
execute function
app_private.guard_manufacturing_pro_write();


drop trigger if exists
trg_production_recipe_versions_manufacturing_edition
on public.production_recipe_versions;

create trigger
trg_production_recipe_versions_manufacturing_edition
before insert or update or delete
on public.production_recipe_versions
for each row
execute function
app_private.guard_manufacturing_pro_write();


drop trigger if exists
trg_production_recipe_components_manufacturing_edition
on public.production_recipe_components;

create trigger
trg_production_recipe_components_manufacturing_edition
before insert or update or delete
on public.production_recipe_components
for each row
execute function
app_private.guard_manufacturing_pro_write();


drop trigger if exists
trg_production_orders_manufacturing_edition
on public.production_orders;

create trigger
trg_production_orders_manufacturing_edition
before insert or update or delete
on public.production_orders
for each row
execute function
app_private.guard_manufacturing_pro_write();


drop trigger if exists
trg_production_order_materials_manufacturing_edition
on public.production_order_materials;

create trigger
trg_production_order_materials_manufacturing_edition
before insert or update or delete
on public.production_order_materials
for each row
execute function
app_private.guard_manufacturing_pro_write();


drop trigger if exists
trg_manufacturing_cost_policies_edition
on public.manufacturing_cost_policies;

create trigger
trg_manufacturing_cost_policies_edition
before insert or update or delete
on public.manufacturing_cost_policies
for each row
execute function
app_private.guard_manufacturing_pro_write();


-- =========================================================
-- 6. COSTING RPC EDITION GATE
-- =========================================================

create or replace function
app_private.require_production_cost_access(
  p_tenant_id uuid,
  p_capability_code text
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
      'Production Cost tenant is required';
  end if;


  perform
    app_private.require_manufacturing_edition(
      p_tenant_id
    );


  if p_capability_code is null
     or length(
       btrim(
         p_capability_code
       )
     ) = 0
  then
    raise exception
      'Production Cost capability code is required';
  end if;


  if not app_private.has_capability(
    p_tenant_id,
    btrim(
      p_capability_code
    ),
    null
  ) then
    raise exception
      '% capability required',
      btrim(
        p_capability_code
      );
  end if;

end;
$function$;


-- =========================================================
-- 7. PRODUCTION EXECUTION EDITION GATE
-- =========================================================

create or replace function
app_private.require_production_execution_access(
  p_tenant_id uuid,
  p_site_id uuid
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


  if p_tenant_id is null
     or p_site_id is null then
    raise exception
      'Production tenant and site are required';
  end if;


  perform
    app_private.require_manufacturing_edition(
      p_tenant_id
    );


  if not app_private.has_site_access(
    p_site_id
  ) then
    raise exception
      'Production site access denied';
  end if;


  if not app_private.has_capability(
    p_tenant_id,
    'production.execute',
    p_site_id
  ) then
    raise exception
      'production.execute capability required';
  end if;

end;
$function$;


-- =========================================================
-- 8. PLATFORM-CONTROLLED EDITION CONFIG GUARD
-- =========================================================
-- Tenant settings managers may still update ordinary module
-- configuration, but they must not self-upgrade or downgrade
-- MAVORA product edition entitlement.
--
-- Edition changes are platform-controlled and may only be
-- performed by postgres / service_role operations.


create or replace function
app_private.guard_production_edition_config()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
declare
  v_old_edition text;
  v_new_edition text;
begin

  if old.module_code = 'production'
     or new.module_code = 'production'
  then

    v_old_edition :=
      case
        when upper(
          coalesce(
            old.config ->> 'edition_code',
            'PRODUCTION'
          )
        ) = 'MANUFACTURING'
          then 'MANUFACTURING'
        else 'PRODUCTION'
      end;


    v_new_edition :=
      case
        when upper(
          coalesce(
            new.config ->> 'edition_code',
            'PRODUCTION'
          )
        ) = 'MANUFACTURING'
          then 'MANUFACTURING'
        else 'PRODUCTION'
      end;


    if v_old_edition
         is distinct from
       v_new_edition
       and current_user not in (
         'postgres',
         'service_role'
       )
    then
      raise exception
        'MAVORA production edition entitlement is platform controlled';
    end if;

  end if;


  return new;

end;
$function$;


revoke all
on function
app_private.guard_production_edition_config()
from public, anon, authenticated;


drop trigger if exists
trg_tenant_modules_production_edition_guard
on public.tenant_modules;

create trigger
trg_tenant_modules_production_edition_guard
before update
on public.tenant_modules
for each row
execute function
app_private.guard_production_edition_config();


-- =========================================================
-- 9. PILOT TENANT ENTITLEMENT
-- =========================================================

update public.tenant_modules tm
set
  config =
    coalesce(
      tm.config,
      '{}'::jsonb
    )
    ||
    jsonb_build_object(
      'edition_code',
      'MANUFACTURING'
    ),

  updated_at = now()

from public.tenants t
where t.id = tm.tenant_id
  and t.slug = 'sat-sat-yo'
  and tm.module_code = 'production';


-- =========================================================
-- 10. PRIVATE FUNCTION PRIVILEGES
-- =========================================================

revoke all
on function
app_private.production_edition_code(uuid)
from public, anon;

revoke all
on function
app_private.has_manufacturing_edition(uuid)
from public, anon;

revoke all
on function
app_private.require_manufacturing_edition(uuid)
from public, anon;

revoke all
on function
app_private.get_production_edition_impl(uuid)
from public, anon;


grant execute
on function
app_private.production_edition_code(uuid)
to authenticated, service_role;

grant execute
on function
app_private.has_manufacturing_edition(uuid)
to authenticated, service_role;

grant execute
on function
app_private.require_manufacturing_edition(uuid)
to authenticated, service_role;

grant execute
on function
app_private.get_production_edition_impl(uuid)
to authenticated, service_role;


-- =========================================================
-- END MIGRATION 039
-- =========================================================
