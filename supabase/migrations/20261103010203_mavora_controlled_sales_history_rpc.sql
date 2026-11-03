-- MAVORA Manufacturing ERP
-- Phase 2P-6N-4D-1
-- Controlled Sales History + Invoice Detail RPC
--
-- Scope:
--   * Read-only controlled Sales History
--   * Read-only controlled Invoice Detail
--   * Warehouse/site scoped authorization
--   * Site-local date filtering
--   * Product / Lot-Batch traceability
--   * No Sales return
--   * No payment mutation
--   * No stock mutation
--   * No COGS exposure through sales.view
--
-- Security:
--   * Privileged implementations stay in app_private
--   * Public wrappers are SECURITY INVOKER
--   * sales.view capability required
--   * Warehouse access required
--   * Direct Sales table access remains closed


-- =========================================================
-- 1. HISTORY QUERY INDEX
-- =========================================================

create index if not exists
  sales_orders_tenant_warehouse_sold_at_idx
on public.sales_orders (
  tenant_id,
  warehouse_id,
  sold_at desc
);


-- =========================================================
-- 2. PRIVATE CONTROLLED SALES HISTORY
-- =========================================================

create or replace function
app_private.get_sales_history_impl(
  p_tenant_id uuid,
  p_warehouse_id uuid,

  p_limit integer default 50,
  p_offset integer default 0,

  p_search text default null,

  p_from_date date default null,
  p_to_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_warehouse public.warehouses%rowtype;

  v_site_timezone text;

  v_limit integer :=
    coalesce(
      p_limit,
      50
    );

  v_offset integer :=
    coalesce(
      p_offset,
      0
    );

  v_search text :=
    nullif(
      btrim(
        p_search
      ),
      ''
    );

  v_from_ts timestamptz;
  v_to_ts timestamptz;

  v_result jsonb;
begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;


  if p_tenant_id is null then
    raise exception
      'Sales tenant is required';
  end if;


  if p_warehouse_id is null then
    raise exception
      'Sales warehouse is required';
  end if;


  if v_limit < 1
     or v_limit > 200 then
    raise exception
      'Sales History limit must be between 1 and 200';
  end if;


  if v_offset < 0 then
    raise exception
      'Sales History offset cannot be negative';
  end if;


  if v_search is not null
     and length(v_search) > 200 then
    raise exception
      'Sales History search cannot exceed 200 characters';
  end if;


  if p_from_date is not null
     and p_to_date is not null
     and p_from_date > p_to_date then
    raise exception
      'Sales History from-date cannot be after to-date';
  end if;


  select w.*
  into v_warehouse
  from public.warehouses w
  where w.id = p_warehouse_id
    and w.tenant_id = p_tenant_id
    and w.warehouse_type = 'FG'
    and w.is_active = true;


  if not found then
    raise exception
      'Active Finished Goods warehouse not found';
  end if;


  select s.timezone
  into v_site_timezone
  from public.sites s
  where s.id = v_warehouse.site_id
    and s.tenant_id = p_tenant_id;


  if v_site_timezone is null
     or length(
       btrim(
         v_site_timezone
       )
     ) = 0 then
    raise exception
      'Sales site timezone is not configured';
  end if;


  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.view',
    v_warehouse.site_id
  );


  if not app_private.has_warehouse_access(
    p_warehouse_id
  ) then
    raise exception
      'Sales warehouse access denied';
  end if;


  if p_from_date is not null then

    v_from_ts :=
      p_from_date::timestamp
      at time zone
      v_site_timezone;

  end if;


  if p_to_date is not null then

    v_to_ts :=
      (
        p_to_date
        + 1
      )::timestamp
      at time zone
      v_site_timezone;

  end if;


  with line_stats as (

    select
      sol.sales_order_id,

      count(*)::integer
        as line_count,

      sum(
        sol.quantity
      )::numeric
        as total_quantity

    from public.sales_order_lines sol

    where sol.tenant_id =
          p_tenant_id

    group by
      sol.sales_order_id

  ),

  filtered as (

    select
      so.id,
      so.invoice_no,

      so.customer_ref,
      so.customer_name,
      so.customer_phone,
      so.customer_shop_type,
      so.customer_address,
      so.customer_gps,

      so.payment_method,
      so.credit_terms,
      so.is_paid,
      so.status,

      so.subtotal,
      so.discount_percent,
      so.discount_amount,
      so.tax_percent,
      so.tax_amount,
      so.grand_total,

      so.sold_at,
      so.created_at,

      spl.id
        as price_list_id,

      spl.code
        as price_list_code,

      spl.name
        as price_list_name,

      spl.currency_code,

      coalesce(
        ls.line_count,
        0
      ) as line_count,

      coalesce(
        ls.total_quantity,
        0
      ) as total_quantity

    from public.sales_orders so

    left join public.sales_price_lists spl
      on spl.id = so.price_list_id
     and spl.tenant_id = so.tenant_id

    left join line_stats ls
      on ls.sales_order_id = so.id

    where so.tenant_id =
          p_tenant_id

      and so.warehouse_id =
          p_warehouse_id

      and (
        v_from_ts is null
        or so.sold_at >=
           v_from_ts
      )

      and (
        v_to_ts is null
        or so.sold_at <
           v_to_ts
      )

      and (
        v_search is null

        or so.invoice_no
             ilike
             '%'
             || v_search
             || '%'

        or coalesce(
             so.customer_name,
             ''
           )
             ilike
             '%'
             || v_search
             || '%'

        or coalesce(
             so.customer_phone,
             ''
           )
             ilike
             '%'
             || v_search
             || '%'

        or coalesce(
             so.customer_ref,
             ''
           )
             ilike
             '%'
             || v_search
             || '%'
      )

  )

  select
    jsonb_build_object(

      'ok',
      true,

      'warehouse',
      jsonb_build_object(
        'id',
        v_warehouse.id,

        'site_id',
        v_warehouse.site_id,

        'code',
        v_warehouse.code,

        'name',
        v_warehouse.name,

        'timezone',
        v_site_timezone
      ),

      'filters',
      jsonb_build_object(
        'search',
        v_search,

        'from_date',
        p_from_date,

        'to_date',
        p_to_date
      ),

      'limit',
      v_limit,

      'offset',
      v_offset,

      'total_count',
      (
        select count(*)
        from filtered
      ),

      'orders',
      coalesce(
        (
          select
            jsonb_agg(
              jsonb_build_object(

                'sales_order_id',
                page.id,

                'invoice_no',
                page.invoice_no,

                'customer_ref',
                page.customer_ref,

                'customer_name',
                page.customer_name,

                'customer_phone',
                page.customer_phone,

                'customer_shop_type',
                page.customer_shop_type,

                'customer_address',
                page.customer_address,

                'customer_gps',
                page.customer_gps,

                'payment_method',
                page.payment_method,

                'credit_terms',
                page.credit_terms,

                'is_paid',
                page.is_paid,

                'status',
                page.status,

                'subtotal',
                page.subtotal,

                'discount_percent',
                page.discount_percent,

                'discount_amount',
                page.discount_amount,

                'tax_percent',
                page.tax_percent,

                'tax_amount',
                page.tax_amount,

                'grand_total',
                page.grand_total,

                'price_list_id',
                page.price_list_id,

                'price_list_code',
                page.price_list_code,

                'price_list_name',
                page.price_list_name,

                'currency_code',
                page.currency_code,

                'line_count',
                page.line_count,

                'total_quantity',
                page.total_quantity,

                'sold_at',
                page.sold_at,

                'created_at',
                page.created_at
              )

              order by
                page.sold_at desc,
                page.id desc
            )

          from (

            select f.*

            from filtered f

            order by
              f.sold_at desc,
              f.id desc

            limit v_limit
            offset v_offset

          ) page

        ),

        '[]'::jsonb
      )
    )

  into v_result;


  return v_result;

end;
$function$;


revoke all
on function
app_private.get_sales_history_impl(
  uuid,
  uuid,
  integer,
  integer,
  text,
  date,
  date
)
from public, anon;


grant execute
on function
app_private.get_sales_history_impl(
  uuid,
  uuid,
  integer,
  integer,
  text,
  date,
  date
)
to authenticated, service_role;


-- =========================================================
-- 3. PUBLIC SECURITY-INVOKER SALES HISTORY WRAPPER
-- =========================================================

create or replace function
public.get_sales_history(
  p_tenant_id uuid,
  p_warehouse_id uuid,

  p_limit integer default 50,
  p_offset integer default 0,

  p_search text default null,

  p_from_date date default null,
  p_to_date date default null
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$

  select
    app_private.get_sales_history_impl(
      p_tenant_id,
      p_warehouse_id,
      p_limit,
      p_offset,
      p_search,
      p_from_date,
      p_to_date
    );

$function$;


revoke all
on function
public.get_sales_history(
  uuid,
  uuid,
  integer,
  integer,
  text,
  date,
  date
)
from public, anon;


grant execute
on function
public.get_sales_history(
  uuid,
  uuid,
  integer,
  integer,
  text,
  date,
  date
)
to authenticated, service_role;


-- =========================================================
-- 4. PRIVATE CONTROLLED INVOICE DETAIL
-- =========================================================

create or replace function
app_private.get_sales_invoice_detail_impl(
  p_tenant_id uuid,
  p_sales_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_order public.sales_orders%rowtype;

  v_warehouse public.warehouses%rowtype;

  v_site_timezone text;

  v_price_list_code text;
  v_price_list_name text;
  v_currency_code text;

  v_sold_by text;

  v_lines jsonb;
begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;


  if p_tenant_id is null then
    raise exception
      'Sales tenant is required';
  end if;


  if p_sales_order_id is null then
    raise exception
      'Sales Order is required';
  end if;


  if not exists (

    select 1

    from public.tenant_memberships tm

    where tm.tenant_id =
          p_tenant_id

      and tm.user_id =
          auth.uid()

      and tm.status =
          'active'

  ) then

    raise exception
      'Sales access denied';

  end if;


  select so.*
  into v_order
  from public.sales_orders so
  where so.id =
        p_sales_order_id
    and so.tenant_id =
        p_tenant_id;


  if not found then
    raise exception
      'Sales Order not found';
  end if;


  select w.*
  into v_warehouse
  from public.warehouses w
  where w.id =
        v_order.warehouse_id
    and w.tenant_id =
        p_tenant_id;


  if not found then
    raise exception
      'Sales Order warehouse not found';
  end if;


  if v_warehouse.site_id
       is distinct from
     v_order.site_id then

    raise exception
      'Sales Order site / warehouse mismatch';

  end if;


  select s.timezone
  into v_site_timezone
  from public.sites s
  where s.id =
        v_order.site_id
    and s.tenant_id =
        p_tenant_id;


  if v_site_timezone is null
     or length(
       btrim(
         v_site_timezone
       )
     ) = 0 then
    raise exception
      'Sales site timezone is not configured';
  end if;


  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.view',
    v_order.site_id
  );


  if not app_private.has_warehouse_access(
    v_order.warehouse_id
  ) then
    raise exception
      'Sales warehouse access denied';
  end if;


  if v_order.price_list_id is not null then

    select
      spl.code,
      spl.name,
      spl.currency_code

    into
      v_price_list_code,
      v_price_list_name,
      v_currency_code

    from public.sales_price_lists spl

    where spl.id =
          v_order.price_list_id

      and spl.tenant_id =
          p_tenant_id;

  end if;


  select p.display_name
  into v_sold_by
  from public.profiles p
  where p.id =
        v_order.created_by;


  select
    coalesce(
      jsonb_agg(

        jsonb_build_object(

          'line_id',
          sol.id,

          'line_no',
          sol.line_no,

          'product',
          jsonb_build_object(
            'id',
            pr.id,

            'sku',
            pr.sku,

            'barcode',
            pr.barcode,

            'name',
            pr.name,

            'tracking_mode',
            pr.tracking_mode,

            'unit_code',
            u.code,

            'unit_symbol',
            u.symbol
          ),

          'quantity',
          sol.quantity,

          'unit_price',
          sol.unit_price,

          'discount_amount',
          sol.discount_amount,

          'tax_amount',
          sol.tax_amount,

          'line_total',
          sol.line_total,

          'allocations',
          coalesce(
            (
              select
                jsonb_agg(

                  jsonb_build_object(

                    'allocation_id',
                    sia.id,

                    'lot_id',
                    sia.lot_id,

                    'lot_no',
                    il.lot_no,

                    'batch_no',
                    il.batch_no,

                    'manufactured_at',
                    il.manufactured_at,

                    'expires_at',
                    il.expires_at,

                    'quantity',
                    sia.quantity,

                    'inventory_movement_id',
                    sia.inventory_movement_id
                  )

                  order by
                    il.expires_at
                      nulls last,

                    il.manufactured_at
                      nulls last,

                    sia.created_at,

                    sia.id
                )

              from public.sales_inventory_allocations sia

              left join public.inventory_lots il
                on il.id =
                   sia.lot_id

               and il.tenant_id =
                   sia.tenant_id

              where sia.tenant_id =
                    p_tenant_id

                and sia.sales_order_id =
                    v_order.id

                and sia.sales_order_line_id =
                    sol.id

            ),

            '[]'::jsonb
          )
        )

        order by
          sol.line_no

      ),

      '[]'::jsonb
    )

  into v_lines

  from public.sales_order_lines sol

  join public.products pr
    on pr.id =
       sol.product_id

   and pr.tenant_id =
       sol.tenant_id

  join public.units u
    on u.id =
       pr.base_unit_id

   and u.tenant_id =
       pr.tenant_id

  where sol.tenant_id =
        p_tenant_id

    and sol.sales_order_id =
        v_order.id;


  return
    jsonb_build_object(

      'ok',
      true,

      'order',
      jsonb_build_object(

        'sales_order_id',
        v_order.id,

        'invoice_no',
        v_order.invoice_no,

        'status',
        v_order.status,

        'customer_ref',
        v_order.customer_ref,

        'customer_name',
        v_order.customer_name,

        'customer_phone',
        v_order.customer_phone,

        'customer_shop_type',
        v_order.customer_shop_type,

        'customer_address',
        v_order.customer_address,

        'customer_gps',
        v_order.customer_gps,

        'payment_method',
        v_order.payment_method,

        'credit_terms',
        v_order.credit_terms,

        'is_paid',
        v_order.is_paid,

        'subtotal',
        v_order.subtotal,

        'discount_percent',
        v_order.discount_percent,

        'discount_amount',
        v_order.discount_amount,

        'tax_percent',
        v_order.tax_percent,

        'tax_amount',
        v_order.tax_amount,

        'grand_total',
        v_order.grand_total,

        'sold_at',
        v_order.sold_at,

        'created_at',
        v_order.created_at,

        'sold_by',
        coalesce(
          v_sold_by,
          v_order.created_by::text
        ),

        'warehouse',
        jsonb_build_object(
          'id',
          v_warehouse.id,

          'site_id',
          v_warehouse.site_id,

          'code',
          v_warehouse.code,

          'name',
          v_warehouse.name,

          'timezone',
          v_site_timezone
        ),

        'price_list',
        jsonb_build_object(
          'id',
          v_order.price_list_id,

          'code',
          v_price_list_code,

          'name',
          v_price_list_name,

          'currency_code',
          v_currency_code
        )
      ),

      'lines',
      v_lines
    );

end;
$function$;


revoke all
on function
app_private.get_sales_invoice_detail_impl(
  uuid,
  uuid
)
from public, anon;


grant execute
on function
app_private.get_sales_invoice_detail_impl(
  uuid,
  uuid
)
to authenticated, service_role;


-- =========================================================
-- 5. PUBLIC SECURITY-INVOKER INVOICE DETAIL WRAPPER
-- =========================================================

create or replace function
public.get_sales_invoice_detail(
  p_tenant_id uuid,
  p_sales_order_id uuid
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$

  select
    app_private.get_sales_invoice_detail_impl(
      p_tenant_id,
      p_sales_order_id
    );

$function$;


revoke all
on function
public.get_sales_invoice_detail(
  uuid,
  uuid
)
from public, anon;


grant execute
on function
public.get_sales_invoice_detail(
  uuid,
  uuid
)
to authenticated, service_role;


-- =========================================================
-- 6. COMMENTS
-- =========================================================

comment on function
public.get_sales_history(
  uuid,
  uuid,
  integer,
  integer,
  text,
  date,
  date
) is
  'Read-only controlled Sales History. Enforces sales.view plus site and Finished Goods warehouse access, supports site-local date filters and does not expose COGS.';


comment on function
public.get_sales_invoice_detail(
  uuid,
  uuid
) is
  'Read-only controlled Sales Invoice Detail. Enforces sales.view plus site and warehouse access and returns customer-facing Sales lines with Lot-Batch traceability without exposing COGS.';


comment on function
app_private.get_sales_history_impl(
  uuid,
  uuid,
  integer,
  integer,
  text,
  date,
  date
) is
  'Private controlled Sales History implementation.';


comment on function
app_private.get_sales_invoice_detail_impl(
  uuid,
  uuid
) is
  'Private controlled Sales Invoice Detail implementation.';
