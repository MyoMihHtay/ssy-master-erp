-- =========================================================
-- MAVORA Manufacturing ERP
-- Migration 037
-- Manufacturing Cost Policy / Transfer Pricing Foundation
--
-- Goals:
--   * Preserve Production actual cost from Migration 017 as
--     server-derived accounting truth.
--   * Add controlled Standard Cost policy for SFG / FG only.
--   * Add Minimum Margin control.
--   * Add Factory Selling Price.
--   * Add Distributor / Wholesale Transfer Prices.
--   * Preserve full policy version history.
--   * Keep MAVORA focused on Factory / Manufacturing pricing.
--   * Do NOT introduce Route Sales, Promotions, Territory,
--     Sales Rep or complex Customer pricing.
--
-- Display note:
--   Database keeps numeric precision.
--   UI may display MMK as whole numbers.
--
-- Existing applied migrations remain immutable.
-- =========================================================


-- =========================================================
-- 1. COSTING CAPABILITIES
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
    'production.cost_view',
    'production',
    'cost_view',
    'View controlled Manufacturing cost and transfer pricing',
    'high',
    true
  ),
  (
    'production.cost_manage',
    'production',
    'cost_manage',
    'Create and revise Manufacturing cost and transfer pricing policies',
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


-- OWNER receives Manufacturing Cost capabilities.
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
    'production.cost_view',
    'production.cost_manage'
  )
where r.code = 'OWNER'
on conflict (role_id, capability_code) do nothing;


-- =========================================================
-- 2. MANUFACTURING COST POLICY HISTORY
-- =========================================================
--
-- Actual Production Cost remains derived from:
--   public.production_order_costs
--
-- This table stores MANAGEMENT POLICY:
--   Standard Cost
--   Minimum Margin
--   Factory Selling Price
--   Distributor Transfer Price
--   Wholesale Transfer Price
--
-- Every controlled change creates a NEW VERSION.
-- =========================================================

create table public.manufacturing_cost_policies (
  id uuid primary key
    default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete restrict,

  product_id uuid not null,

  version_no integer not null
    check (
      version_no > 0
    ),

  currency_code text not null
    default 'MMK'
    check (
      currency_code ~ '^[A-Z]{3}$'
    ),

  standard_unit_cost numeric(20,6) not null
    check (
      standard_unit_cost >= 0
    ),

  minimum_margin_pct numeric(9,4) not null
    default 0
    check (
      minimum_margin_pct >= 0
      and minimum_margin_pct < 100
    ),

  factory_selling_price numeric(20,6)
    check (
      factory_selling_price is null
      or factory_selling_price >= 0
    ),

  distributor_transfer_price numeric(20,6)
    check (
      distributor_transfer_price is null
      or distributor_transfer_price >= 0
    ),

  wholesale_transfer_price numeric(20,6)
    check (
      wholesale_transfer_price is null
      or wholesale_transfer_price >= 0
    ),

  is_current boolean not null
    default true,

  effective_from timestamptz not null
    default now(),

  effective_to timestamptz,

  reason text,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  constraint fk_manufacturing_cost_policy_product_scope
    foreign key (
      product_id,
      tenant_id
    )
    references public.products(
      id,
      tenant_id
    )
    on delete restrict,

  constraint manufacturing_cost_policy_effective_check
    check (
      effective_to is null
      or effective_to >= effective_from
    ),

  constraint uq_manufacturing_cost_policy_version
    unique (
      tenant_id,
      product_id,
      version_no
    ),

  unique (
    id,
    tenant_id
  )
);


create unique index
uq_manufacturing_cost_policy_current
on public.manufacturing_cost_policies (
  tenant_id,
  product_id
)
where is_current = true;


create index
idx_manufacturing_cost_policy_history
on public.manufacturing_cost_policies (
  tenant_id,
  product_id,
  version_no desc
);


-- =========================================================
-- 3. TABLE SECURITY BOUNDARY
-- =========================================================
--
-- Client does NOT directly SELECT / INSERT / UPDATE / DELETE.
-- Read and write access are only through controlled RPCs.
-- =========================================================

alter table public.manufacturing_cost_policies
  enable row level security;


revoke all
on public.manufacturing_cost_policies
from public, anon, authenticated;


-- =========================================================
-- 4. PRIVATE COSTING AUTHORIZATION
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


revoke all
on function
app_private.require_production_cost_access(
  uuid,
  text
)
from public, anon;


grant execute
on function
app_private.require_production_cost_access(
  uuid,
  text
)
to authenticated, service_role;


-- =========================================================
-- 5. PRIVATE CONTROLLED POLICY UPSERT
-- =========================================================
--
-- IMPORTANT:
--   * Every change inserts a new version.
--   * Previous current version is closed.
--   * Actual Production Cost is NEVER overwritten.
--
-- Minimum Margin definition:
--
--   Margin % =
--     (Selling Price - Standard Cost)
--     / Selling Price
--     * 100
--
-- Therefore minimum permitted price:
--
--   Standard Cost
--   -----------------------------
--   1 - (Minimum Margin % / 100)
--
-- =========================================================

create or replace function
app_private.upsert_manufacturing_cost_policy_impl(
  p_tenant_id uuid,
  p_product_id uuid,
  p_standard_unit_cost numeric,
  p_minimum_margin_pct numeric,
  p_currency_code text default 'MMK',
  p_factory_selling_price numeric default null,
  p_distributor_transfer_price numeric default null,
  p_wholesale_transfer_price numeric default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid :=
    auth.uid();

  v_product public.products%rowtype;

  v_existing
    public.manufacturing_cost_policies%rowtype;

  v_new
    public.manufacturing_cost_policies%rowtype;

  v_version_no integer;

  v_currency_code text;

  v_reason text;

  v_now timestamptz :=
    now();

  v_minimum_allowed_price
    numeric(20,6);

  v_before jsonb;
begin

  perform
    app_private.require_production_cost_access(
      p_tenant_id,
      'production.cost_manage'
    );


  if p_product_id is null then
    raise exception
      'Manufacturing Cost Product is required';
  end if;


  if p_standard_unit_cost is null
     or p_standard_unit_cost < 0
  then
    raise exception
      'Standard Unit Cost cannot be negative';
  end if;


  if p_minimum_margin_pct is null
     or p_minimum_margin_pct < 0
     or p_minimum_margin_pct >= 100
  then
    raise exception
      'Minimum Margin must be between 0 and less than 100 percent';
  end if;


  if p_factory_selling_price is not null
     and p_factory_selling_price < 0
  then
    raise exception
      'Factory Selling Price cannot be negative';
  end if;


  if p_distributor_transfer_price is not null
     and p_distributor_transfer_price < 0
  then
    raise exception
      'Distributor Transfer Price cannot be negative';
  end if;


  if p_wholesale_transfer_price is not null
     and p_wholesale_transfer_price < 0
  then
    raise exception
      'Wholesale Transfer Price cannot be negative';
  end if;


  v_currency_code :=
    upper(
      nullif(
        btrim(
          p_currency_code
        ),
        ''
      )
    );


  if v_currency_code is null
     or v_currency_code !~ '^[A-Z]{3}$'
  then
    raise exception
      'Currency code must be a 3-letter ISO-style code';
  end if;


  v_reason :=
    nullif(
      btrim(
        p_reason
      ),
      ''
    );


  if v_reason is not null
     and length(
       v_reason
     ) > 1000
  then
    raise exception
      'Manufacturing Cost reason cannot exceed 1000 characters';
  end if;


  select p.*
  into v_product
  from public.products p
  where p.id = p_product_id
    and p.tenant_id = p_tenant_id
  for share;


  if not found then
    raise exception
      'Manufacturing Cost Product was not found';
  end if;


  if v_product.product_type
     not in (
       'SFG',
       'FG'
     )
  then
    raise exception
      'Manufacturing Cost Policy is allowed only for SFG or FG products';
  end if;


  if not v_product.is_active then
    raise exception
      'Manufacturing Cost Policy requires an active Product';
  end if;


  v_minimum_allowed_price :=
    round(
      p_standard_unit_cost
      /
      (
        1
        -
        (
          p_minimum_margin_pct
          /
          100.0
        )
      ),
      6
    );


  if p_factory_selling_price is not null
     and
     p_factory_selling_price
       <
     v_minimum_allowed_price
  then
    raise exception
      'Factory Selling Price is below Minimum Margin price %',
      v_minimum_allowed_price;
  end if;


  if p_distributor_transfer_price is not null
     and
     p_distributor_transfer_price
       <
     v_minimum_allowed_price
  then
    raise exception
      'Distributor Transfer Price is below Minimum Margin price %',
      v_minimum_allowed_price;
  end if;


  if p_wholesale_transfer_price is not null
     and
     p_wholesale_transfer_price
       <
     v_minimum_allowed_price
  then
    raise exception
      'Wholesale Transfer Price is below Minimum Margin price %',
      v_minimum_allowed_price;
  end if;


  -- Serialize all Policy revisions per Product.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'manufacturing-cost-policy|'
      || p_tenant_id::text
      || '|'
      || p_product_id::text,
      0
    )
  );


  select mcp.*
  into v_existing
  from public.manufacturing_cost_policies mcp
  where mcp.tenant_id = p_tenant_id
    and mcp.product_id = p_product_id
    and mcp.is_current = true
  for update;


  if found then

    v_before :=
      jsonb_build_object(
        'policy_id',
          v_existing.id,

        'version_no',
          v_existing.version_no,

        'currency_code',
          v_existing.currency_code,

        'standard_unit_cost',
          v_existing.standard_unit_cost,

        'minimum_margin_pct',
          v_existing.minimum_margin_pct,

        'factory_selling_price',
          v_existing.factory_selling_price,

        'distributor_transfer_price',
          v_existing.distributor_transfer_price,

        'wholesale_transfer_price',
          v_existing.wholesale_transfer_price,

        'effective_from',
          v_existing.effective_from
      );


    update
      public.manufacturing_cost_policies
    set
      is_current = false,
      effective_to = v_now
    where id = v_existing.id;

  end if;


  select
    coalesce(
      max(
        mcp.version_no
      ),
      0
    )
    + 1
  into v_version_no
  from public.manufacturing_cost_policies mcp
  where mcp.tenant_id =
          p_tenant_id
    and mcp.product_id =
          p_product_id;


  insert into
    public.manufacturing_cost_policies (
      tenant_id,
      product_id,
      version_no,
      currency_code,
      standard_unit_cost,
      minimum_margin_pct,
      factory_selling_price,
      distributor_transfer_price,
      wholesale_transfer_price,
      is_current,
      effective_from,
      effective_to,
      reason,
      created_by
    )
  values (
    p_tenant_id,
    p_product_id,
    v_version_no,
    v_currency_code,
    round(
      p_standard_unit_cost,
      6
    ),
    round(
      p_minimum_margin_pct,
      4
    ),
    case
      when p_factory_selling_price
             is null
        then null
      else round(
        p_factory_selling_price,
        6
      )
    end,
    case
      when p_distributor_transfer_price
             is null
        then null
      else round(
        p_distributor_transfer_price,
        6
      )
    end,
    case
      when p_wholesale_transfer_price
             is null
        then null
      else round(
        p_wholesale_transfer_price,
        6
      )
    end,
    true,
    v_now,
    null,
    v_reason,
    v_user_id
  )
  returning *
  into v_new;


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
    'production.cost_policy_upsert',
    'manufacturing_cost_policy',
    v_new.id,
    v_before,
    jsonb_build_object(
      'policy_id',
        v_new.id,

      'product_id',
        v_new.product_id,

      'version_no',
        v_new.version_no,

      'currency_code',
        v_new.currency_code,

      'standard_unit_cost',
        v_new.standard_unit_cost,

      'minimum_margin_pct',
        v_new.minimum_margin_pct,

      'minimum_allowed_price',
        v_minimum_allowed_price,

      'factory_selling_price',
        v_new.factory_selling_price,

      'distributor_transfer_price',
        v_new.distributor_transfer_price,

      'wholesale_transfer_price',
        v_new.wholesale_transfer_price,

      'effective_from',
        v_new.effective_from
    ),
    coalesce(
      v_reason,
      'Controlled Manufacturing Cost Policy revision'
    ),
    jsonb_build_object(
      'product_sku',
        v_product.sku,

      'product_type',
        v_product.product_type,

      'created_new_version',
        true,

      'previous_policy_id',
        v_existing.id
    )
  );


  return jsonb_build_object(
    'ok',
      true,

    'policy_id',
      v_new.id,

    'product_id',
      v_new.product_id,

    'product_sku',
      v_product.sku,

    'product_name',
      v_product.name,

    'version_no',
      v_new.version_no,

    'currency_code',
      v_new.currency_code,

    'standard_unit_cost',
      v_new.standard_unit_cost,

    'minimum_margin_pct',
      v_new.minimum_margin_pct,

    'minimum_allowed_price',
      v_minimum_allowed_price,

    'factory_selling_price',
      v_new.factory_selling_price,

    'distributor_transfer_price',
      v_new.distributor_transfer_price,

    'wholesale_transfer_price',
      v_new.wholesale_transfer_price,

    'effective_from',
      v_new.effective_from
  );

end;
$function$;


revoke all
on function
app_private.upsert_manufacturing_cost_policy_impl(
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  numeric,
  numeric,
  numeric,
  text
)
from public, anon;


grant execute
on function
app_private.upsert_manufacturing_cost_policy_impl(
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  numeric,
  numeric,
  numeric,
  text
)
to authenticated, service_role;


-- =========================================================
-- 6. PUBLIC CONTROLLED POLICY UPSERT
-- =========================================================

create or replace function
public.upsert_manufacturing_cost_policy(
  p_tenant_id uuid,
  p_product_id uuid,
  p_standard_unit_cost numeric,
  p_minimum_margin_pct numeric,
  p_currency_code text default 'MMK',
  p_factory_selling_price numeric default null,
  p_distributor_transfer_price numeric default null,
  p_wholesale_transfer_price numeric default null,
  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$

  select
    app_private.upsert_manufacturing_cost_policy_impl(
      p_tenant_id,
      p_product_id,
      p_standard_unit_cost,
      p_minimum_margin_pct,
      p_currency_code,
      p_factory_selling_price,
      p_distributor_transfer_price,
      p_wholesale_transfer_price,
      p_reason
    );

$function$;


revoke all
on function
public.upsert_manufacturing_cost_policy(
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  numeric,
  numeric,
  numeric,
  text
)
from public, anon;


grant execute
on function
public.upsert_manufacturing_cost_policy(
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  numeric,
  numeric,
  numeric,
  text
)
to authenticated, service_role;


-- =========================================================
-- 7. PRIVATE COST OVERVIEW READ-SIDE
-- =========================================================
--
-- Latest Actual Unit Cost:
--   Latest immutable finalized Production Order cost
--
-- Standard Cost:
--   Current Manufacturing Cost Policy
--
-- Actual Cost does NOT overwrite Standard Cost.
-- =========================================================

create or replace function
app_private.list_manufacturing_cost_overview_impl(
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_result jsonb;
begin

  perform
    app_private.require_production_cost_access(
      p_tenant_id,
      'production.cost_view'
    );


  select
    jsonb_build_object(
      'ok',
        true,

      'items',
        coalesce(
          jsonb_agg(
            q.item
            order by
              q.product_type,
              q.sku
          ),
          '[]'::jsonb
        )
    )
  into v_result
  from (
    select
      p.product_type,
      p.sku,

      jsonb_build_object(
        'product_id',
          p.id,

        'sku',
          p.sku,

        'name',
          p.name,

        'product_type',
          p.product_type,

        'currency_code',
          cp.currency_code,

        'latest_actual_unit_cost',
          ac.output_unit_cost,

        'latest_actual_cost_order_no',
          ac.order_no,

        'latest_actual_cost_finalized_at',
          ac.finalized_at,

        'policy_id',
          cp.id,

        'policy_version_no',
          cp.version_no,

        'standard_unit_cost',
          cp.standard_unit_cost,

        'minimum_margin_pct',
          cp.minimum_margin_pct,

        'minimum_allowed_price',
          case
            when cp.standard_unit_cost
                   is null
              or cp.minimum_margin_pct
                   is null
              then null

            else round(
              cp.standard_unit_cost
              /
              (
                1
                -
                (
                  cp.minimum_margin_pct
                  /
                  100.0
                )
              ),
              6
            )
          end,

        'factory_selling_price',
          cp.factory_selling_price,

        'distributor_transfer_price',
          cp.distributor_transfer_price,

        'wholesale_transfer_price',
          cp.wholesale_transfer_price,

        'standard_vs_actual_variance',
          case
            when ac.output_unit_cost
                   is null
              or cp.standard_unit_cost
                   is null
              then null

            else round(
              ac.output_unit_cost
              -
              cp.standard_unit_cost,
              6
            )
          end,

        'standard_vs_actual_variance_pct',
          case
            when ac.output_unit_cost
                   is null
              or cp.standard_unit_cost
                   is null
              or cp.standard_unit_cost = 0
              then null

            else round(
              (
                (
                  ac.output_unit_cost
                  -
                  cp.standard_unit_cost
                )
                /
                cp.standard_unit_cost
              )
              * 100,
              2
            )
          end,

        'factory_margin_pct',
          case
            when cp.factory_selling_price
                   is null
              or cp.factory_selling_price = 0
              or cp.standard_unit_cost
                   is null
              then null

            else round(
              (
                (
                  cp.factory_selling_price
                  -
                  cp.standard_unit_cost
                )
                /
                cp.factory_selling_price
              )
              * 100,
              2
            )
          end,

        'distributor_margin_pct',
          case
            when cp.distributor_transfer_price
                   is null
              or cp.distributor_transfer_price = 0
              or cp.standard_unit_cost
                   is null
              then null

            else round(
              (
                (
                  cp.distributor_transfer_price
                  -
                  cp.standard_unit_cost
                )
                /
                cp.distributor_transfer_price
              )
              * 100,
              2
            )
          end,

        'wholesale_margin_pct',
          case
            when cp.wholesale_transfer_price
                   is null
              or cp.wholesale_transfer_price = 0
              or cp.standard_unit_cost
                   is null
              then null

            else round(
              (
                (
                  cp.wholesale_transfer_price
                  -
                  cp.standard_unit_cost
                )
                /
                cp.wholesale_transfer_price
              )
              * 100,
              2
            )
          end,

        'policy_effective_from',
          cp.effective_from
      )
      as item

    from public.products p

    left join lateral (
      select
        mcp.*
      from
        public.manufacturing_cost_policies mcp
      where
        mcp.tenant_id =
          p.tenant_id
        and
        mcp.product_id =
          p.id
        and
        mcp.is_current =
          true
      order by
        mcp.version_no desc
      limit 1
    ) cp
      on true

    left join lateral (
      select
        poc.output_unit_cost,
        poc.finalized_at,
        po.order_no
      from
        public.production_orders po
      join
        public.production_order_costs poc
        on
          poc.production_order_id =
            po.id
          and
          poc.tenant_id =
            po.tenant_id
      where
        po.tenant_id =
          p.tenant_id
        and
        po.output_product_id =
          p.id
      order by
        poc.finalized_at desc,
        poc.id desc
      limit 1
    ) ac
      on true

    where
      p.tenant_id =
        p_tenant_id
      and
      p.is_active =
        true
      and
      p.product_type in (
        'SFG',
        'FG'
      )
  ) q;


  return
    coalesce(
      v_result,
      jsonb_build_object(
        'ok',
          true,

        'items',
          '[]'::jsonb
      )
    );

end;
$function$;


revoke all
on function
app_private.list_manufacturing_cost_overview_impl(
  uuid
)
from public, anon;


grant execute
on function
app_private.list_manufacturing_cost_overview_impl(
  uuid
)
to authenticated, service_role;


-- =========================================================
-- 8. PUBLIC COST OVERVIEW RPC
-- =========================================================

create or replace function
public.list_manufacturing_cost_overview(
  p_tenant_id uuid
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$

  select
    app_private.list_manufacturing_cost_overview_impl(
      p_tenant_id
    );

$function$;


revoke all
on function
public.list_manufacturing_cost_overview(
  uuid
)
from public, anon;


grant execute
on function
public.list_manufacturing_cost_overview(
  uuid
)
to authenticated, service_role;


-- =========================================================
-- 9. DOCUMENTATION
-- =========================================================

comment on table
public.manufacturing_cost_policies
is
  'Versioned Manufacturing management policy for Standard Cost, Minimum Margin, Factory Selling Price and controlled Distributor/Wholesale Transfer Prices. Actual Production Cost remains immutable and server-derived from Production execution.';


comment on function
public.upsert_manufacturing_cost_policy(
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  numeric,
  numeric,
  numeric,
  text
)
is
  'Controlled versioned Manufacturing Cost Policy revision. Requires production.cost_manage and enforces the configured Minimum Margin floor.';


comment on function
public.list_manufacturing_cost_overview(
  uuid
)
is
  'Controlled Manufacturing Cost overview combining latest immutable Actual Production Unit Cost with the current Standard Cost and Transfer Pricing policy.';


-- =========================================================
-- END MIGRATION 037
-- =========================================================
