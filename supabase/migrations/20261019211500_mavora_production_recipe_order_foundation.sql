-- MAVORA Manufacturing ERP
-- Migration 012
-- Production Recipe/BOM + Production Order Foundation
--
-- Goals:
--   * Version-controlled Recipe / BOM architecture
--   * Production Order planning foundation
--   * Tenant + site isolation
--   * Approved formula immutability
--   * Work Center / Production Line scope integrity
--   * No inventory posting yet
--
-- IMPORTANT:
--   Production inventory consumption/output will be added later
--   through controlled atomic RPCs. This migration creates only
--   the production planning/master-data foundation.


-- =========================================================
-- 1. CAPABILITIES
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
    'production.recipe_manage',
    'production',
    'recipe_manage',
    'Create and maintain Production Recipes and draft BOM versions',
    'high',
    true
  ),
  (
    'production.order_manage',
    'production',
    'order_manage',
    'Create and maintain Production Orders and planned materials',
    'high',
    true
  ),
  (
    'production.execute',
    'production',
    'execute',
    'Execute controlled production consumption and output workflows',
    'critical',
    true
  )
on conflict (code) do update
set
  module_code = excluded.module_code,
  action = excluded.action,
  description = excluded.description,
  risk_level = excluded.risk_level,
  is_active = excluded.is_active;


-- OWNER receives the new production capabilities.
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
    'production.recipe_manage',
    'production.order_manage',
    'production.execute'
  )
where r.code = 'OWNER'
on conflict (role_id, capability_code) do nothing;


-- =========================================================
-- 2. PRODUCTION RECIPE MASTER
-- =========================================================

create table public.production_recipes (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete cascade,

  code text not null,
  name text not null,

  process_type text not null
    default 'manufacturing'
    check (
      process_type in (
        'manufacturing',
        'packaging',
        'rework'
      )
    ),

  output_product_id uuid not null,

  is_active boolean not null
    default true,

  notes text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint production_recipes_code_check
    check (
      length(btrim(code)) between 1 and 100
    ),

  constraint production_recipes_name_check
    check (
      length(btrim(name)) between 1 and 200
    ),

  constraint production_recipes_notes_check
    check (
      notes is null
      or length(notes) <= 4000
    ),

  constraint production_recipes_tenant_code_key
    unique (tenant_id, code),

  constraint uq_production_recipes_id_tenant
    unique (id, tenant_id),

  constraint fk_production_recipes_output_product_tenant
    foreign key (
      output_product_id,
      tenant_id
    )
    references public.products(
      id,
      tenant_id
    )
    on delete restrict
);


-- =========================================================
-- 3. VERSIONED RECIPE / BOM HEADER
-- =========================================================

create table public.production_recipe_versions (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete cascade,

  recipe_id uuid not null,

  version_no integer not null
    check (version_no > 0),

  status text not null
    default 'draft'
    check (
      status in (
        'draft',
        'approved',
        'retired'
      )
    ),

  standard_output_qty numeric(18,6)
    not null
    check (standard_output_qty > 0),

  output_unit_id uuid not null,

  effective_from date,

  effective_to date,

  approved_at timestamptz,

  approved_by uuid,

  notes text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint production_recipe_versions_effective_dates_check
    check (
      effective_to is null
      or effective_from is null
      or effective_to >= effective_from
    ),

  constraint production_recipe_versions_notes_check
    check (
      notes is null
      or length(notes) <= 4000
    ),

  constraint production_recipe_versions_recipe_version_key
    unique (
      tenant_id,
      recipe_id,
      version_no
    ),

  constraint uq_production_recipe_versions_id_tenant
    unique (
      id,
      tenant_id
    ),

  constraint fk_production_recipe_versions_recipe_tenant
    foreign key (
      recipe_id,
      tenant_id
    )
    references public.production_recipes(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_production_recipe_versions_unit_tenant
    foreign key (
      output_unit_id,
      tenant_id
    )
    references public.units(
      id,
      tenant_id
    )
    on delete restrict
);


-- =========================================================
-- 4. VERSIONED RECIPE / BOM COMPONENTS
-- =========================================================

create table public.production_recipe_components (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete cascade,

  recipe_version_id uuid not null,

  line_no integer not null
    check (line_no > 0),

  input_product_id uuid not null,

  input_unit_id uuid not null,

  required_qty numeric(18,6)
    not null
    check (required_qty > 0),

  wastage_allowance_pct numeric(9,4)
    not null
    default 0
    check (
      wastage_allowance_pct >= 0
      and wastage_allowance_pct <= 100
    ),

  is_optional boolean not null
    default false,

  notes text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint production_recipe_components_notes_check
    check (
      notes is null
      or length(notes) <= 2000
    ),

  constraint production_recipe_components_line_key
    unique (
      recipe_version_id,
      line_no
    ),

  constraint uq_production_recipe_components_id_tenant
    unique (
      id,
      tenant_id
    ),

  constraint fk_production_recipe_components_version_tenant
    foreign key (
      recipe_version_id,
      tenant_id
    )
    references public.production_recipe_versions(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_production_recipe_components_product_tenant
    foreign key (
      input_product_id,
      tenant_id
    )
    references public.products(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_production_recipe_components_unit_tenant
    foreign key (
      input_unit_id,
      tenant_id
    )
    references public.units(
      id,
      tenant_id
    )
    on delete restrict
);


-- =========================================================
-- 5. PRODUCTION ORDERS
-- =========================================================

create table public.production_orders (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete cascade,

  site_id uuid not null,

  order_no text not null,

  recipe_version_id uuid not null,

  output_product_id uuid not null,

  output_unit_id uuid not null,

  work_center_id uuid,

  production_line_id uuid,

  status text not null
    default 'draft'
    check (
      status in (
        'draft',
        'released',
        'in_progress',
        'completed',
        'cancelled'
      )
    ),

  priority text not null
    default 'normal'
    check (
      priority in (
        'low',
        'normal',
        'high',
        'urgent'
      )
    ),

  planned_qty numeric(18,6)
    not null
    check (planned_qty > 0),

  planned_start_at timestamptz,

  planned_end_at timestamptz,

  actual_start_at timestamptz,

  actual_end_at timestamptz,

  released_at timestamptz,

  completed_at timestamptz,

  created_by uuid
    default auth.uid(),

  released_by uuid,

  completed_by uuid,

  notes text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint production_orders_order_no_check
    check (
      length(btrim(order_no)) between 1 and 100
    ),

  constraint production_orders_notes_check
    check (
      notes is null
      or length(notes) <= 4000
    ),

  constraint production_orders_planned_dates_check
    check (
      planned_end_at is null
      or planned_start_at is null
      or planned_end_at >= planned_start_at
    ),

  constraint production_orders_actual_dates_check
    check (
      actual_end_at is null
      or actual_start_at is null
      or actual_end_at >= actual_start_at
    ),

  constraint production_orders_tenant_order_no_key
    unique (
      tenant_id,
      order_no
    ),

  constraint uq_production_orders_id_tenant
    unique (
      id,
      tenant_id
    ),

  constraint uq_production_orders_id_tenant_site
    unique (
      id,
      tenant_id,
      site_id
    ),

  constraint fk_production_orders_site_tenant
    foreign key (
      site_id,
      tenant_id
    )
    references public.sites(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_production_orders_recipe_version_tenant
    foreign key (
      recipe_version_id,
      tenant_id
    )
    references public.production_recipe_versions(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_production_orders_output_product_tenant
    foreign key (
      output_product_id,
      tenant_id
    )
    references public.products(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_production_orders_output_unit_tenant
    foreign key (
      output_unit_id,
      tenant_id
    )
    references public.units(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_production_orders_work_center_tenant
    foreign key (
      work_center_id,
      tenant_id
    )
    references public.work_centers(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_production_orders_production_line_tenant
    foreign key (
      production_line_id,
      tenant_id
    )
    references public.production_lines(
      id,
      tenant_id
    )
    on delete restrict
);


-- =========================================================
-- 6. PRODUCTION ORDER MATERIAL SNAPSHOT
-- =========================================================

create table public.production_order_materials (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete cascade,

  site_id uuid not null,

  production_order_id uuid not null,

  line_no integer not null
    check (line_no > 0),

  source_component_id uuid not null,

  input_product_id uuid not null,

  input_unit_id uuid not null,

  planned_qty numeric(18,6)
    not null
    check (planned_qty > 0),

  wastage_allowance_pct numeric(9,4)
    not null
    default 0
    check (
      wastage_allowance_pct >= 0
      and wastage_allowance_pct <= 100
    ),

  notes text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint production_order_materials_notes_check
    check (
      notes is null
      or length(notes) <= 2000
    ),

  constraint production_order_materials_line_key
    unique (
      production_order_id,
      line_no
    ),

  constraint fk_production_order_materials_order_scope
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

  constraint fk_production_order_materials_component_tenant
    foreign key (
      source_component_id,
      tenant_id
    )
    references public.production_recipe_components(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_production_order_materials_product_tenant
    foreign key (
      input_product_id,
      tenant_id
    )
    references public.products(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_production_order_materials_unit_tenant
    foreign key (
      input_unit_id,
      tenant_id
    )
    references public.units(
      id,
      tenant_id
    )
    on delete restrict
);


-- =========================================================
-- 7. INDEXES
-- =========================================================

create index idx_production_recipes_tenant_active
  on public.production_recipes (
    tenant_id,
    is_active
  );

create index idx_production_recipes_output_product
  on public.production_recipes (
    tenant_id,
    output_product_id
  );

create index idx_production_recipe_versions_recipe_status
  on public.production_recipe_versions (
    tenant_id,
    recipe_id,
    status,
    version_no desc
  );

create index idx_production_recipe_components_version
  on public.production_recipe_components (
    tenant_id,
    recipe_version_id,
    line_no
  );

create index idx_production_recipe_components_product
  on public.production_recipe_components (
    tenant_id,
    input_product_id
  );

create index idx_production_orders_site_status
  on public.production_orders (
    tenant_id,
    site_id,
    status,
    planned_start_at
  );

create index idx_production_orders_recipe_version
  on public.production_orders (
    tenant_id,
    recipe_version_id
  );

create index idx_production_orders_output_product
  on public.production_orders (
    tenant_id,
    output_product_id
  );

create index idx_production_order_materials_order
  on public.production_order_materials (
    tenant_id,
    site_id,
    production_order_id,
    line_no
  );

create index idx_production_order_materials_product
  on public.production_order_materials (
    tenant_id,
    input_product_id
  );


-- =========================================================
-- 8. UPDATED_AT TRIGGERS
-- =========================================================

create trigger trg_production_recipes_updated_at
before update on public.production_recipes
for each row
execute function public.set_updated_at();

create trigger trg_production_recipe_versions_updated_at
before update on public.production_recipe_versions
for each row
execute function public.set_updated_at();

create trigger trg_production_recipe_components_updated_at
before update on public.production_recipe_components
for each row
execute function public.set_updated_at();

create trigger trg_production_orders_updated_at
before update on public.production_orders
for each row
execute function public.set_updated_at();

create trigger trg_production_order_materials_updated_at
before update on public.production_order_materials
for each row
execute function public.set_updated_at();


-- =========================================================
-- 8A. RECIPE MASTER HISTORICAL IDENTITY GUARD
-- =========================================================

create or replace function app_private.guard_production_recipe_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if exists (
    select 1
    from public.production_recipe_versions prv
    where prv.recipe_id = old.id
      and prv.tenant_id = old.tenant_id
  )
  and (
    new.tenant_id is distinct from old.tenant_id
    or new.code is distinct from old.code
    or new.process_type is distinct from old.process_type
    or new.output_product_id is distinct from old.output_product_id
  ) then
    raise exception
      'Recipe identity cannot change after Recipe Versions exist';
  end if;

  return new;
end;
$function$;

revoke all
on function app_private.guard_production_recipe_identity()
from public, anon, authenticated;

grant execute
on function app_private.guard_production_recipe_identity()
to service_role;

create trigger trg_guard_production_recipe_identity
before update
on public.production_recipes
for each row
execute function app_private.guard_production_recipe_identity();


-- =========================================================
-- 8B. RECIPE VERSION INSERT MUST START AS DRAFT
-- =========================================================

create or replace function app_private.guard_production_recipe_version_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if new.status <> 'draft' then
    raise exception
      'New Recipe Versions must start in draft status';
  end if;

  if new.approved_at is not null
     or new.approved_by is not null then
    raise exception
      'Approval metadata is system controlled';
  end if;

  return new;
end;
$function$;

revoke all
on function app_private.guard_production_recipe_version_insert()
from public, anon, authenticated;

grant execute
on function app_private.guard_production_recipe_version_insert()
to service_role;

create trigger trg_guard_production_recipe_version_insert
before insert
on public.production_recipe_versions
for each row
execute function app_private.guard_production_recipe_version_insert();


-- =========================================================
-- 9. APPROVED RECIPE VERSION IMMUTABILITY
-- =========================================================

create or replace function app_private.guard_production_recipe_version_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if old.status in ('approved', 'retired') then

    if
      new.tenant_id is distinct from old.tenant_id
      or new.recipe_id is distinct from old.recipe_id
      or new.version_no is distinct from old.version_no
      or new.standard_output_qty is distinct from old.standard_output_qty
      or new.output_unit_id is distinct from old.output_unit_id
      or new.effective_from is distinct from old.effective_from
      or new.approved_at is distinct from old.approved_at
      or new.approved_by is distinct from old.approved_by
    then
      raise exception
        'Approved or retired recipe versions are immutable';
    end if;

    if old.status = 'retired'
       and new.status is distinct from old.status then
      raise exception
        'Retired recipe versions cannot be reactivated';
    end if;

    if old.status = 'approved'
       and new.status not in ('approved', 'retired') then
      raise exception
        'Approved recipe versions may only remain approved or be retired';
    end if;

  end if;


  -- Draft versions must not carry approval metadata.
  if new.status = 'draft' then
    new.approved_at := null;
    new.approved_by := null;
  end if;


  -- Approval is allowed only when at least one BOM component exists.
  if old.status = 'draft'
     and new.status = 'approved' then

    if not exists (
      select 1
      from public.production_recipe_components prc
      where prc.recipe_version_id = new.id
        and prc.tenant_id = new.tenant_id
    ) then
      raise exception
        'Recipe version cannot be approved without BOM components';
    end if;

    -- Approval identity/time are system-controlled.
    new.approved_at := now();
    new.approved_by := auth.uid();

  end if;

  return new;
end;
$function$;


revoke all
on function app_private.guard_production_recipe_version_update()
from public, anon, authenticated;

grant execute
on function app_private.guard_production_recipe_version_update()
to service_role;


create trigger trg_guard_production_recipe_version_update
before update
on public.production_recipe_versions
for each row
execute function app_private.guard_production_recipe_version_update();


-- =========================================================
-- 10. BOM COMPONENTS MAY ONLY CHANGE WHILE VERSION IS DRAFT
-- =========================================================

create or replace function app_private.guard_production_recipe_component_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_tenant_id uuid;
  v_recipe_version_id uuid;
  v_status text;
begin
  v_tenant_id :=
    case
      when tg_op = 'DELETE' then old.tenant_id
      else new.tenant_id
    end;

  v_recipe_version_id :=
    case
      when tg_op = 'DELETE' then old.recipe_version_id
      else new.recipe_version_id
    end;

  select prv.status
    into v_status
  from public.production_recipe_versions prv
  where prv.id = v_recipe_version_id
    and prv.tenant_id = v_tenant_id;

  if not found then
    raise exception
      'Recipe version not found';
  end if;

  if v_status <> 'draft' then
    raise exception
      'BOM components may only be changed while recipe version is draft';
  end if;

  return
    case
      when tg_op = 'DELETE' then old
      else new
    end;
end;
$function$;


revoke all
on function app_private.guard_production_recipe_component_write()
from public, anon, authenticated;

grant execute
on function app_private.guard_production_recipe_component_write()
to service_role;


create trigger trg_guard_production_recipe_component_write
before insert or update or delete
on public.production_recipe_components
for each row
execute function app_private.guard_production_recipe_component_write();


-- =========================================================
-- 11. PRODUCTION ORDER SITE / LINE CONSISTENCY GUARD
-- =========================================================

create or replace function app_private.guard_production_order_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_line_site_id uuid;
  v_line_work_center_id uuid;

  v_recipe_status text;
  v_recipe_output_product_id uuid;
  v_recipe_output_unit_id uuid;

  v_validate_recipe boolean := false;
begin

  -- Avoid referencing OLD during INSERT.
  if tg_op = 'INSERT' then
    v_validate_recipe := true;
  else
    v_validate_recipe :=
      new.recipe_version_id
        is distinct from old.recipe_version_id
      or new.tenant_id
        is distinct from old.tenant_id
      or new.output_product_id
        is distinct from old.output_product_id
      or new.output_unit_id
        is distinct from old.output_unit_id;
  end if;

  -- Recipe Version must exist within the same tenant.
  -- Output Product / Unit must remain aligned with Recipe.
  if v_validate_recipe then

    select
      prv.status,
      pr.output_product_id,
      prv.output_unit_id
    into
      v_recipe_status,
      v_recipe_output_product_id,
      v_recipe_output_unit_id
    from public.production_recipe_versions prv
    join public.production_recipes pr
      on pr.id = prv.recipe_id
     and pr.tenant_id = prv.tenant_id
    where prv.id = new.recipe_version_id
      and prv.tenant_id = new.tenant_id;

    if not found then
      raise exception
        'Recipe Version not found for Production Order tenant';
    end if;

    if v_recipe_status <> 'approved' then
      raise exception
        'Production Order requires an approved Recipe Version';
    end if;

    if new.output_product_id <> v_recipe_output_product_id then
      raise exception
        'Production Order output product must match the selected Recipe';
    end if;

    if new.output_unit_id <> v_recipe_output_unit_id then
      raise exception
        'Production Order output unit must match the selected Recipe Version';
    end if;

  end if;


  if new.work_center_id is not null then
    if not exists (
      select 1
      from public.work_centers wc
      where wc.id = new.work_center_id
        and wc.tenant_id = new.tenant_id
        and wc.site_id = new.site_id
        and wc.is_active = true
    ) then
      raise exception
        'Work Center must belong to the same active tenant/site as Production Order';
    end if;
  end if;


  if new.production_line_id is not null then

    select
      pl.site_id,
      pl.work_center_id
    into
      v_line_site_id,
      v_line_work_center_id
    from public.production_lines pl
    where pl.id = new.production_line_id
      and pl.tenant_id = new.tenant_id
      and pl.is_active = true;

    if not found then
      raise exception
        'Active Production Line not found for tenant';
    end if;

    if v_line_site_id <> new.site_id then
      raise exception
        'Production Line must belong to the same site as Production Order';
    end if;

    if new.work_center_id is not null
       and v_line_work_center_id is not null
       and v_line_work_center_id <> new.work_center_id then
      raise exception
        'Production Line does not belong to the selected Work Center';
    end if;

  end if;

  return new;
end;
$function$;


revoke all
on function app_private.guard_production_order_scope()
from public, anon, authenticated;

grant execute
on function app_private.guard_production_order_scope()
to service_role;


create trigger trg_guard_production_order_scope
before insert or update
on public.production_orders
for each row
execute function app_private.guard_production_order_scope();


-- =========================================================
-- 11A. PRODUCTION ORDER FOUNDATION LIFECYCLE GUARD
-- =========================================================
--
-- Until the controlled execution RPC is introduced:
--   * new orders must start as draft
--   * direct client lifecycle advancement is blocked
--   * draft orders may be cancelled
--
-- A later migration will introduce controlled
-- release/start/complete transitions with audit + inventory posting.

create or replace function app_private.guard_production_order_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin

  if tg_op = 'INSERT' then

    if new.status <> 'draft' then
      raise exception
        'New Production Orders must start in draft status';
    end if;

    new.created_by := auth.uid();

    new.released_at := null;
    new.released_by := null;

    new.actual_start_at := null;
    new.actual_end_at := null;

    new.completed_at := null;
    new.completed_by := null;

    return new;

  end if;


  -- Historical creator identity is immutable.
  if new.created_by is distinct from old.created_by then
    raise exception
      'Production Order creator cannot be changed';
  end if;


  -- Lifecycle timestamps/actors are controlled by the future
  -- Production execution RPC, never by direct table updates.
  if
    new.released_at is distinct from old.released_at
    or new.released_by is distinct from old.released_by
    or new.actual_start_at is distinct from old.actual_start_at
    or new.actual_end_at is distinct from old.actual_end_at
    or new.completed_at is distinct from old.completed_at
    or new.completed_by is distinct from old.completed_by
  then
    raise exception
      'Production lifecycle metadata is system controlled';
  end if;


  -- Once the frozen material snapshot exists, the basis of the
  -- Production Order cannot silently change. A manager must first
  -- remove the draft snapshot, change the order, then rebuild it.
  if exists (
    select 1
    from public.production_order_materials pom
    where pom.production_order_id = old.id
      and pom.tenant_id = old.tenant_id
  )
  and (
    new.tenant_id is distinct from old.tenant_id
    or new.site_id is distinct from old.site_id
    or new.recipe_version_id is distinct from old.recipe_version_id
    or new.output_product_id is distinct from old.output_product_id
    or new.output_unit_id is distinct from old.output_unit_id
    or new.planned_qty is distinct from old.planned_qty
  ) then
    raise exception
      'Remove the draft material snapshot before changing Production Order basis';
  end if;


  if old.status = 'cancelled' then
    raise exception
      'Cancelled Production Orders are immutable';
  end if;


  if new.status is distinct from old.status then

    if old.status = 'draft'
       and new.status = 'cancelled' then
      return new;
    end if;

    raise exception
      'Production lifecycle changes require the controlled Production execution workflow';

  end if;

  return new;
end;
$function$;

revoke all
on function app_private.guard_production_order_lifecycle()
from public, anon, authenticated;

grant execute
on function app_private.guard_production_order_lifecycle()
to service_role;

create trigger trg_guard_production_order_lifecycle
before insert or update
on public.production_orders
for each row
execute function app_private.guard_production_order_lifecycle();


-- =========================================================
-- 11B. PRODUCTION ORDER MATERIAL SNAPSHOT GUARD
-- =========================================================

create or replace function app_private.guard_production_order_material_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_tenant_id uuid;
  v_order_id uuid;

  v_order_status text;
  v_recipe_version_id uuid;
  v_order_planned_qty numeric(18,6);
  v_standard_output_qty numeric(18,6);

  v_component_product_id uuid;
  v_component_unit_id uuid;
  v_component_required_qty numeric(18,6);
  v_component_wastage numeric(9,4);

  v_expected_planned_qty numeric(18,6);
begin

  v_tenant_id :=
    case
      when tg_op = 'DELETE'
        then old.tenant_id
      else new.tenant_id
    end;

  v_order_id :=
    case
      when tg_op = 'DELETE'
        then old.production_order_id
      else new.production_order_id
    end;


  select
    po.status,
    po.recipe_version_id,
    po.planned_qty,
    prv.standard_output_qty
  into
    v_order_status,
    v_recipe_version_id,
    v_order_planned_qty,
    v_standard_output_qty
  from public.production_orders po
  join public.production_recipe_versions prv
    on prv.id = po.recipe_version_id
   and prv.tenant_id = po.tenant_id
  where po.id = v_order_id
    and po.tenant_id = v_tenant_id;

  if not found then
    raise exception
      'Production Order not found';
  end if;


  if v_order_status <> 'draft' then
    raise exception
      'Production Order materials may only be changed while order is draft';
  end if;


  if tg_op <> 'DELETE' then

    select
      prc.input_product_id,
      prc.input_unit_id,
      prc.required_qty,
      prc.wastage_allowance_pct
    into
      v_component_product_id,
      v_component_unit_id,
      v_component_required_qty,
      v_component_wastage
    from public.production_recipe_components prc
    where prc.id = new.source_component_id
      and prc.tenant_id = new.tenant_id
      and prc.recipe_version_id = v_recipe_version_id;

    if not found then
      raise exception
        'Source BOM component must belong to the Production Order Recipe Version';
    end if;

    if new.input_product_id <> v_component_product_id then
      raise exception
        'Planned material product must match the source BOM component';
    end if;

    if new.input_unit_id <> v_component_unit_id then
      raise exception
        'Planned material unit must match the source BOM component';
    end if;

    if new.wastage_allowance_pct
       is distinct from v_component_wastage then
      raise exception
        'Planned material wastage allowance must match the source BOM component';
    end if;


    -- planned_qty is the net BOM requirement before the separate
    -- wastage allowance is applied during controlled execution.
    v_expected_planned_qty :=
      round(
        (
          v_component_required_qty
          * v_order_planned_qty
          / v_standard_output_qty
        )::numeric,
        6
      );


    if new.planned_qty
       is distinct from v_expected_planned_qty then
      raise exception
        'Planned material quantity must equal the scaled BOM requirement. Expected: %',
        v_expected_planned_qty;
    end if;

  end if;


  return
    case
      when tg_op = 'DELETE' then old
      else new
    end;

end;
$function$;

revoke all
on function app_private.guard_production_order_material_write()
from public, anon, authenticated;

grant execute
on function app_private.guard_production_order_material_write()
to service_role;

create trigger trg_guard_production_order_material_write
before insert or update or delete
on public.production_order_materials
for each row
execute function app_private.guard_production_order_material_write();


-- =========================================================
-- 12. ROW LEVEL SECURITY
-- =========================================================

alter table public.production_recipes
  enable row level security;

alter table public.production_recipe_versions
  enable row level security;

alter table public.production_recipe_components
  enable row level security;

alter table public.production_orders
  enable row level security;

alter table public.production_order_materials
  enable row level security;


-- ---------------------------------------------------------
-- Recipe master
-- ---------------------------------------------------------

create policy production_recipes_select_member
on public.production_recipes
for select
to authenticated
using (
  app_private.is_tenant_member(tenant_id)
);

create policy production_recipes_insert_manager
on public.production_recipes
for insert
to authenticated
with check (
  app_private.has_capability(
    tenant_id,
    'production.recipe_manage',
    null
  )
);

create policy production_recipes_update_manager
on public.production_recipes
for update
to authenticated
using (
  app_private.has_capability(
    tenant_id,
    'production.recipe_manage',
    null
  )
)
with check (
  app_private.has_capability(
    tenant_id,
    'production.recipe_manage',
    null
  )
);


-- ---------------------------------------------------------
-- Recipe versions
-- ---------------------------------------------------------

create policy production_recipe_versions_select_member
on public.production_recipe_versions
for select
to authenticated
using (
  app_private.is_tenant_member(tenant_id)
);

create policy production_recipe_versions_insert_manager
on public.production_recipe_versions
for insert
to authenticated
with check (
  app_private.has_capability(
    tenant_id,
    'production.recipe_manage',
    null
  )
);

create policy production_recipe_versions_update_manager
on public.production_recipe_versions
for update
to authenticated
using (
  app_private.has_capability(
    tenant_id,
    'production.recipe_manage',
    null
  )
)
with check (
  app_private.has_capability(
    tenant_id,
    'production.recipe_manage',
    null
  )
);


-- ---------------------------------------------------------
-- Recipe components
-- ---------------------------------------------------------

create policy production_recipe_components_select_member
on public.production_recipe_components
for select
to authenticated
using (
  app_private.is_tenant_member(tenant_id)
);

create policy production_recipe_components_insert_manager
on public.production_recipe_components
for insert
to authenticated
with check (
  app_private.has_capability(
    tenant_id,
    'production.recipe_manage',
    null
  )
);

create policy production_recipe_components_update_manager
on public.production_recipe_components
for update
to authenticated
using (
  app_private.has_capability(
    tenant_id,
    'production.recipe_manage',
    null
  )
)
with check (
  app_private.has_capability(
    tenant_id,
    'production.recipe_manage',
    null
  )
);

create policy production_recipe_components_delete_manager
on public.production_recipe_components
for delete
to authenticated
using (
  app_private.has_capability(
    tenant_id,
    'production.recipe_manage',
    null
  )
);


-- ---------------------------------------------------------
-- Production orders
-- ---------------------------------------------------------

create policy production_orders_select_scoped
on public.production_orders
for select
to authenticated
using (
  app_private.has_site_access(site_id)
);

create policy production_orders_insert_manager
on public.production_orders
for insert
to authenticated
with check (
  app_private.has_capability(
    tenant_id,
    'production.order_manage',
    site_id
  )
);

create policy production_orders_update_manager
on public.production_orders
for update
to authenticated
using (
  app_private.has_capability(
    tenant_id,
    'production.order_manage',
    site_id
  )
)
with check (
  app_private.has_capability(
    tenant_id,
    'production.order_manage',
    site_id
  )
);


-- ---------------------------------------------------------
-- Production order materials
-- ---------------------------------------------------------

create policy production_order_materials_select_scoped
on public.production_order_materials
for select
to authenticated
using (
  app_private.has_site_access(site_id)
);

create policy production_order_materials_insert_manager
on public.production_order_materials
for insert
to authenticated
with check (
  app_private.has_capability(
    tenant_id,
    'production.order_manage',
    site_id
  )
);

create policy production_order_materials_update_manager
on public.production_order_materials
for update
to authenticated
using (
  app_private.has_capability(
    tenant_id,
    'production.order_manage',
    site_id
  )
)
with check (
  app_private.has_capability(
    tenant_id,
    'production.order_manage',
    site_id
  )
);

create policy production_order_materials_delete_manager
on public.production_order_materials
for delete
to authenticated
using (
  app_private.has_capability(
    tenant_id,
    'production.order_manage',
    site_id
  )
);


-- =========================================================
-- 13. ACCESS PRIVILEGES
-- =========================================================

revoke all
on table
  public.production_recipes,
  public.production_recipe_versions,
  public.production_recipe_components,
  public.production_orders,
  public.production_order_materials
from anon;


revoke all
on table
  public.production_recipes,
  public.production_recipe_versions,
  public.production_recipe_components,
  public.production_orders,
  public.production_order_materials
from authenticated;


grant select, insert, update
on table
  public.production_recipes,
  public.production_recipe_versions,
  public.production_recipe_components,
  public.production_orders,
  public.production_order_materials
to authenticated;

grant delete
on table
  public.production_recipe_components,
  public.production_order_materials
to authenticated;


grant select, insert, update, delete
on table
  public.production_recipes,
  public.production_recipe_versions,
  public.production_recipe_components,
  public.production_orders,
  public.production_order_materials
to service_role;


-- =========================================================
-- 14. COMMENTS
-- =========================================================

comment on table public.production_recipes is
  'Tenant-level Production Recipe master. Historical formulas live in version rows.';

comment on table public.production_recipe_versions is
  'Version-controlled Production Recipe/BOM header. Approved versions are immutable.';

comment on table public.production_recipe_components is
  'BOM input materials belonging to a draft Recipe Version.';

comment on table public.production_orders is
  'Site-scoped Production Order planning foundation. Inventory execution is handled later by controlled RPCs.';

comment on table public.production_order_materials is
  'Frozen planned-material snapshot for a Production Order. Actual consumption is recorded separately in later production execution migrations.';
