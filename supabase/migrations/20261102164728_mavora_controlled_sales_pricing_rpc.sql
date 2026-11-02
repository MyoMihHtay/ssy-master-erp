-- MAVORA Manufacturing ERP
-- Phase 2P-6N-4A
-- Controlled Sales Pricing + Catalog RPC
--
-- Scope:
--   * Controlled Sales authorization helper
--   * Controlled Price List create/update RPC
--   * Controlled Product Price RPC with price history
--   * Controlled read-only Sales Catalog RPC
--   * FG warehouse / released Lot-Batch stock only
--   * No Sales checkout yet
--   * No inventory deduction yet
--   * No Sales return yet
--
-- Security:
--   * Privileged implementations stay in app_private
--   * Public wrappers are SECURITY INVOKER
--   * auth.uid() + tenant/site/warehouse/capability checks
--   * Direct Sales table access remains closed


-- =========================================================
-- 1. PRICING FK PERFORMANCE INDEXES
-- =========================================================
--
-- Migration 20261102162403 remains immutable.
-- These indexes cover the composite pricing foreign keys
-- identified by the database advisor.

create index if not exists
  sales_product_prices_price_list_fk_idx
on public.sales_product_prices (
  price_list_id,
  tenant_id
);

create index if not exists
  sales_product_prices_product_fk_idx
on public.sales_product_prices (
  product_id,
  tenant_id
);


-- =========================================================
-- 2. PRIVATE SALES AUTHORIZATION HELPER
-- =========================================================

create or replace function app_private.require_sales_access(
  p_tenant_id uuid,
  p_capability_code text,
  p_site_id uuid default null
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
      'Sales tenant is required';
  end if;

  if p_capability_code is null
     or length(btrim(p_capability_code)) = 0 then
    raise exception
      'Sales capability code is required';
  end if;

  if p_site_id is not null
     and not app_private.has_site_access(
       p_site_id
     ) then
    raise exception
      'Sales site access denied';
  end if;

  if not app_private.has_capability(
    p_tenant_id,
    btrim(p_capability_code),
    p_site_id
  ) then
    raise exception
      '% capability required',
      btrim(p_capability_code);
  end if;

end;
$function$;


revoke all
on function app_private.require_sales_access(
  uuid,
  text,
  uuid
)
from public, anon;

grant execute
on function app_private.require_sales_access(
  uuid,
  text,
  uuid
)
to authenticated, service_role;


-- =========================================================
-- 3. PRIVATE PRICE LIST UPSERT
-- =========================================================

create or replace function app_private.upsert_sales_price_list_impl(
  p_tenant_id uuid,
  p_code text,
  p_name text,
  p_currency_code text default 'MMK',
  p_description text default null,
  p_is_default boolean default false,
  p_is_active boolean default true,
  p_price_list_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();

  v_code text;
  v_name text;
  v_currency_code text;
  v_description text;

  v_existing public.sales_price_lists%rowtype;
  v_result public.sales_price_lists%rowtype;

  v_before jsonb;
begin

  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.price_manage',
    null
  );

  v_code :=
    upper(
      nullif(
        btrim(p_code),
        ''
      )
    );

  v_name :=
    nullif(
      btrim(p_name),
      ''
    );

  v_currency_code :=
    upper(
      nullif(
        btrim(p_currency_code),
        ''
      )
    );

  v_description :=
    nullif(
      btrim(p_description),
      ''
    );


  if v_code is null then
    raise exception
      'Price List code is required';
  end if;

  if length(v_code) > 50 then
    raise exception
      'Price List code cannot exceed 50 characters';
  end if;

  if v_name is null then
    raise exception
      'Price List name is required';
  end if;

  if length(v_name) > 200 then
    raise exception
      'Price List name cannot exceed 200 characters';
  end if;

  if v_currency_code is null
     or v_currency_code !~ '^[A-Z]{3}$' then
    raise exception
      'Currency code must be a 3-letter ISO-style code';
  end if;

  if v_description is not null
     and length(v_description) > 2000 then
    raise exception
      'Price List description cannot exceed 2000 characters';
  end if;


  -- Serialize Price List creation/default changes per tenant.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'sales-price-list|'
      || p_tenant_id::text,
      0
    )
  );


  if p_price_list_id is not null then

    select spl.*
    into v_existing
    from public.sales_price_lists spl
    where spl.id = p_price_list_id
      and spl.tenant_id = p_tenant_id
    for update;

    if not found then
      raise exception
        'Sales Price List not found';
    end if;

    v_before :=
      jsonb_build_object(
        'code', v_existing.code,
        'name', v_existing.name,
        'description', v_existing.description,
        'currency_code', v_existing.currency_code,
        'is_default', v_existing.is_default,
        'is_active', v_existing.is_active
      );

  end if;


  if p_is_default then

    update public.sales_price_lists
    set
      is_default = false,
      updated_at = now()
    where tenant_id = p_tenant_id
      and is_default = true
      and (
        p_price_list_id is null
        or id <> p_price_list_id
      );

  end if;


  if p_price_list_id is null then

    insert into public.sales_price_lists (
      tenant_id,
      code,
      name,
      description,
      currency_code,
      is_default,
      is_active,
      created_by
    )
    values (
      p_tenant_id,
      v_code,
      v_name,
      v_description,
      v_currency_code,
      p_is_default,
      p_is_active,
      v_user_id
    )
    returning *
    into v_result;

  else

    update public.sales_price_lists
    set
      code = v_code,
      name = v_name,
      description = v_description,
      currency_code = v_currency_code,
      is_default = p_is_default,
      is_active = p_is_active,
      updated_at = now()
    where id = p_price_list_id
      and tenant_id = p_tenant_id
    returning *
    into v_result;

  end if;


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
    'sales.price_list_upsert',
    'sales_price_list',
    v_result.id,
    v_before,
    jsonb_build_object(
      'code', v_result.code,
      'name', v_result.name,
      'description', v_result.description,
      'currency_code', v_result.currency_code,
      'is_default', v_result.is_default,
      'is_active', v_result.is_active
    ),
    'Controlled Sales Price List create/update',
    jsonb_build_object(
      'created',
      p_price_list_id is null
    )
  );


  return jsonb_build_object(
    'ok', true,
    'price_list_id', v_result.id,
    'code', v_result.code,
    'name', v_result.name,
    'currency_code', v_result.currency_code,
    'is_default', v_result.is_default,
    'is_active', v_result.is_active
  );

end;
$function$;


revoke all
on function app_private.upsert_sales_price_list_impl(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  uuid
)
from public, anon;

grant execute
on function app_private.upsert_sales_price_list_impl(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  uuid
)
to authenticated, service_role;


-- =========================================================
-- 4. PUBLIC PRICE LIST RPC
-- =========================================================

create or replace function public.upsert_sales_price_list(
  p_tenant_id uuid,
  p_code text,
  p_name text,
  p_currency_code text default 'MMK',
  p_description text default null,
  p_is_default boolean default false,
  p_is_active boolean default true,
  p_price_list_id uuid default null
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$

  select app_private.upsert_sales_price_list_impl(
    p_tenant_id,
    p_code,
    p_name,
    p_currency_code,
    p_description,
    p_is_default,
    p_is_active,
    p_price_list_id
  );

$function$;


revoke all
on function public.upsert_sales_price_list(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  uuid
)
from public, anon;

grant execute
on function public.upsert_sales_price_list(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  uuid
)
to authenticated, service_role;


-- =========================================================
-- 5. PRIVATE PRODUCT PRICE SETTER
-- =========================================================

create or replace function app_private.set_sales_product_price_impl(
  p_tenant_id uuid,
  p_price_list_id uuid,
  p_product_id uuid,
  p_unit_price numeric,
  p_effective_from date default current_date,
  p_min_quantity numeric default 1
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();

  v_price_list public.sales_price_lists%rowtype;
  v_product public.products%rowtype;

  v_existing public.sales_product_prices%rowtype;
  v_result public.sales_product_prices%rowtype;

  v_effective_from date :=
    coalesce(
      p_effective_from,
      current_date
    );

  v_before jsonb;
begin

  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.price_manage',
    null
  );


  if p_price_list_id is null
     or p_product_id is null then
    raise exception
      'Price List and Product are required';
  end if;


  if p_unit_price is null
     or p_unit_price < 0 then
    raise exception
      'Unit price cannot be negative';
  end if;

  if p_unit_price <> round(p_unit_price, 6) then
    raise exception
      'Unit price cannot exceed 6 decimal places';
  end if;

  if p_unit_price > 99999999999999.999999 then
    raise exception
      'Unit price exceeds supported numeric range';
  end if;


  if p_min_quantity is null
     or p_min_quantity <= 0 then
    raise exception
      'Minimum quantity must be greater than zero';
  end if;

  if p_min_quantity <> round(p_min_quantity, 6) then
    raise exception
      'Minimum quantity cannot exceed 6 decimal places';
  end if;


  select spl.*
  into v_price_list
  from public.sales_price_lists spl
  where spl.id = p_price_list_id
    and spl.tenant_id = p_tenant_id
    and spl.is_active = true;

  if not found then
    raise exception
      'Active Sales Price List not found';
  end if;


  select p.*
  into v_product
  from public.products p
  where p.id = p_product_id
    and p.tenant_id = p_tenant_id
    and p.product_type = 'FG'
    and p.is_active = true;

  if not found then
    raise exception
      'Active Finished Goods product not found';
  end if;


  -- Serialize pricing changes for the same Product/List pair.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'sales-product-price|'
      || p_tenant_id::text
      || '|'
      || p_price_list_id::text
      || '|'
      || p_product_id::text,
      0
    )
  );


  select spp.*
  into v_existing
  from public.sales_product_prices spp
  where spp.tenant_id = p_tenant_id
    and spp.price_list_id = p_price_list_id
    and spp.product_id = p_product_id
    and spp.is_active = true
    and spp.effective_to is null
  order by
    spp.effective_from desc,
    spp.created_at desc
  limit 1
  for update;


  if found then

    v_before :=
      jsonb_build_object(
        'price_id', v_existing.id,
        'unit_price', v_existing.unit_price,
        'min_quantity', v_existing.min_quantity,
        'effective_from', v_existing.effective_from,
        'effective_to', v_existing.effective_to
      );


    if v_effective_from < v_existing.effective_from then
      raise exception
        'New price effective date cannot precede the current price effective date';
    end if;


    if v_effective_from = v_existing.effective_from then

      update public.sales_product_prices
      set
        unit_price = p_unit_price,
        min_quantity = p_min_quantity,
        updated_at = now()
      where id = v_existing.id
        and tenant_id = p_tenant_id
      returning *
      into v_result;

    else

      update public.sales_product_prices
      set
        effective_to =
          v_effective_from - 1,
        updated_at = now()
      where id = v_existing.id
        and tenant_id = p_tenant_id;


      insert into public.sales_product_prices (
        tenant_id,
        price_list_id,
        product_id,
        unit_price,
        min_quantity,
        effective_from,
        effective_to,
        is_active,
        created_by
      )
      values (
        p_tenant_id,
        p_price_list_id,
        p_product_id,
        p_unit_price,
        p_min_quantity,
        v_effective_from,
        null,
        true,
        v_user_id
      )
      returning *
      into v_result;

    end if;

  else

    insert into public.sales_product_prices (
      tenant_id,
      price_list_id,
      product_id,
      unit_price,
      min_quantity,
      effective_from,
      effective_to,
      is_active,
      created_by
    )
    values (
      p_tenant_id,
      p_price_list_id,
      p_product_id,
      p_unit_price,
      p_min_quantity,
      v_effective_from,
      null,
      true,
      v_user_id
    )
    returning *
    into v_result;

  end if;


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
    'sales.product_price_set',
    'sales_product_price',
    v_result.id,
    v_before,
    jsonb_build_object(
      'price_list_id', v_result.price_list_id,
      'product_id', v_result.product_id,
      'unit_price', v_result.unit_price,
      'min_quantity', v_result.min_quantity,
      'effective_from', v_result.effective_from,
      'effective_to', v_result.effective_to,
      'is_active', v_result.is_active
    ),
    'Controlled Sales Product Price update',
    jsonb_build_object(
      'price_list_code', v_price_list.code,
      'product_sku', v_product.sku
    )
  );


  return jsonb_build_object(
    'ok', true,
    'price_id', v_result.id,
    'price_list_id', v_result.price_list_id,
    'product_id', v_result.product_id,
    'product_sku', v_product.sku,
    'unit_price', v_result.unit_price,
    'min_quantity', v_result.min_quantity,
    'effective_from', v_result.effective_from,
    'effective_to', v_result.effective_to
  );

end;
$function$;


revoke all
on function app_private.set_sales_product_price_impl(
  uuid,
  uuid,
  uuid,
  numeric,
  date,
  numeric
)
from public, anon;

grant execute
on function app_private.set_sales_product_price_impl(
  uuid,
  uuid,
  uuid,
  numeric,
  date,
  numeric
)
to authenticated, service_role;


-- =========================================================
-- 6. PUBLIC PRODUCT PRICE RPC
-- =========================================================

create or replace function public.set_sales_product_price(
  p_tenant_id uuid,
  p_price_list_id uuid,
  p_product_id uuid,
  p_unit_price numeric,
  p_effective_from date default current_date,
  p_min_quantity numeric default 1
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$

  select app_private.set_sales_product_price_impl(
    p_tenant_id,
    p_price_list_id,
    p_product_id,
    p_unit_price,
    p_effective_from,
    p_min_quantity
  );

$function$;


revoke all
on function public.set_sales_product_price(
  uuid,
  uuid,
  uuid,
  numeric,
  date,
  numeric
)
from public, anon;

grant execute
on function public.set_sales_product_price(
  uuid,
  uuid,
  uuid,
  numeric,
  date,
  numeric
)
to authenticated, service_role;


-- =========================================================
-- 7. PRIVATE SALES CATALOG READER
-- =========================================================

create or replace function app_private.get_sales_catalog_impl(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_price_list_id uuid default null,
  p_as_of date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_site_id uuid;
  v_warehouse_code text;
  v_warehouse_name text;

  v_price_list public.sales_price_lists%rowtype;

  v_as_of date :=
    coalesce(
      p_as_of,
      current_date
    );

  v_products jsonb;
begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;


  select
    w.site_id,
    w.code,
    w.name
  into
    v_site_id,
    v_warehouse_code,
    v_warehouse_name
  from public.warehouses w
  where w.id = p_warehouse_id
    and w.tenant_id = p_tenant_id
    and w.warehouse_type = 'FG'
    and w.is_active = true;

  if not found then
    raise exception
      'Active Finished Goods warehouse not found';
  end if;


  if not app_private.has_warehouse_access(
    p_warehouse_id
  ) then
    raise exception
      'Finished Goods warehouse access denied';
  end if;


  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.view',
    v_site_id
  );


  if p_price_list_id is not null then

    select spl.*
    into v_price_list
    from public.sales_price_lists spl
    where spl.id = p_price_list_id
      and spl.tenant_id = p_tenant_id
      and spl.is_active = true;

  else

    select spl.*
    into v_price_list
    from public.sales_price_lists spl
    where spl.tenant_id = p_tenant_id
      and spl.is_active = true
      and spl.is_default = true
    order by spl.created_at
    limit 1;

  end if;


  if v_price_list.id is null then
    raise exception
      'Active Sales Price List not found';
  end if;


  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'product_id', catalog.product_id,
          'sku', catalog.sku,
          'barcode', catalog.barcode,
          'name', catalog.product_name,
          'category_code', catalog.category_code,
          'category_name', catalog.category_name,
          'unit_code', catalog.unit_code,
          'unit_symbol', catalog.unit_symbol,
          'tracking_mode', catalog.tracking_mode,
          'on_hand', catalog.on_hand,
          'reserved', catalog.reserved,
          'available', catalog.available,
          'price_id', catalog.price_id,
          'unit_price', catalog.unit_price,
          'min_quantity', catalog.min_quantity,
          'price_effective_from',
            catalog.price_effective_from,
          'price_effective_to',
            catalog.price_effective_to,
          'is_sellable',
            (
              catalog.unit_price is not null
              and catalog.available > 0
            )
        )
        order by catalog.sku
      ),
      '[]'::jsonb
    )
  into v_products
  from (
    select
      p.id as product_id,
      p.sku,
      p.barcode,
      p.name as product_name,
      p.tracking_mode,

      pc.code as category_code,
      pc.name as category_name,

      u.code as unit_code,
      u.symbol as unit_symbol,

      coalesce(
        stock.on_hand,
        0
      ) as on_hand,

      coalesce(
        stock.reserved,
        0
      ) as reserved,

      coalesce(
        stock.available,
        0
      ) as available,

      price.id as price_id,
      price.unit_price,
      price.min_quantity,
      price.effective_from
        as price_effective_from,
      price.effective_to
        as price_effective_to

    from public.products p

    join public.units u
      on u.id = p.base_unit_id
     and u.tenant_id = p.tenant_id
     and u.is_active = true

    left join public.product_categories pc
      on pc.id = p.category_id
     and pc.tenant_id = p.tenant_id

    left join lateral (
      select
        coalesce(
          sum(ib.quantity),
          0
        ) as on_hand,

        coalesce(
          sum(ib.reserved_quantity),
          0
        ) as reserved,

        coalesce(
          sum(
            ib.quantity
            -
            ib.reserved_quantity
          ),
          0
        ) as available

      from public.inventory_balances ib

      left join public.inventory_lots il
        on il.id = ib.lot_id
       and il.tenant_id = ib.tenant_id
       and il.product_id = ib.product_id

      where ib.tenant_id = p.tenant_id
        and ib.warehouse_id = p_warehouse_id
        and ib.product_id = p.id
        and (
          p.tracking_mode = 'none'
          or (
            ib.lot_id is not null
            and il.status = 'released'
          )
        )
    ) stock
      on true

    left join lateral (
      select
        spp.id,
        spp.unit_price,
        spp.min_quantity,
        spp.effective_from,
        spp.effective_to
      from public.sales_product_prices spp
      where spp.tenant_id = p.tenant_id
        and spp.price_list_id =
              v_price_list.id
        and spp.product_id = p.id
        and spp.is_active = true
        and spp.effective_from <= v_as_of
        and (
          spp.effective_to is null
          or spp.effective_to >= v_as_of
        )
      order by
        spp.effective_from desc,
        spp.created_at desc
      limit 1
    ) price
      on true

    where p.tenant_id = p_tenant_id
      and p.product_type = 'FG'
      and p.is_active = true

  ) catalog;


  return jsonb_build_object(
    'ok', true,
    'as_of', v_as_of,

    'warehouse',
    jsonb_build_object(
      'id', p_warehouse_id,
      'site_id', v_site_id,
      'code', v_warehouse_code,
      'name', v_warehouse_name
    ),

    'price_list',
    jsonb_build_object(
      'id', v_price_list.id,
      'code', v_price_list.code,
      'name', v_price_list.name,
      'currency_code',
        v_price_list.currency_code,
      'is_default',
        v_price_list.is_default
    ),

    'products',
    v_products
  );

end;
$function$;


revoke all
on function app_private.get_sales_catalog_impl(
  uuid,
  uuid,
  uuid,
  date
)
from public, anon;

grant execute
on function app_private.get_sales_catalog_impl(
  uuid,
  uuid,
  uuid,
  date
)
to authenticated, service_role;


-- =========================================================
-- 8. PUBLIC SALES CATALOG RPC
-- =========================================================

create or replace function public.get_sales_catalog(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_price_list_id uuid default null,
  p_as_of date default current_date
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $function$

  select app_private.get_sales_catalog_impl(
    p_tenant_id,
    p_warehouse_id,
    p_price_list_id,
    p_as_of
  );

$function$;


revoke all
on function public.get_sales_catalog(
  uuid,
  uuid,
  uuid,
  date
)
from public, anon;

grant execute
on function public.get_sales_catalog(
  uuid,
  uuid,
  uuid,
  date
)
to authenticated, service_role;


-- =========================================================
-- 9. COMMENTS
-- =========================================================

comment on function
app_private.require_sales_access(
  uuid,
  text,
  uuid
) is
  'Private Sales authorization helper enforcing authenticated tenant capability and optional site access.';


comment on function
public.upsert_sales_price_list(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  uuid
) is
  'Controlled Sales Price List create/update RPC. Requires sales.price_manage.';


comment on function
public.set_sales_product_price(
  uuid,
  uuid,
  uuid,
  numeric,
  date,
  numeric
) is
  'Controlled Finished Goods sales-price RPC with effective-date price history. Requires sales.price_manage.';


comment on function
public.get_sales_catalog(
  uuid,
  uuid,
  uuid,
  date
) is
  'Read-only controlled Sales catalog for an authorized FG warehouse and active Price List. Returns released sellable stock only for tracked products.';
