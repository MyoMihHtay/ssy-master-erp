-- =========================================================
-- MAVORA ERP
-- Sales Customer Context Read-Side Integration
--
-- Phase 2P-6N-6H
--
-- Goals:
--   * Return customer_id from controlled Sales History
--   * Return invoice_remark from controlled Sales History
--   * Return customer_id from controlled Invoice Detail
--   * Return invoice_remark from controlled Invoice Detail
--
-- Historical authority:
--   * Existing customer snapshot fields remain authoritative
--     for issued historical Sales Orders / Invoices.
--   * This migration does NOT replace snapshot customer data
--     with current live Customer Master values.
--   * customer_id is linkage only.
--   * invoice_remark is the customer-visible invoice-specific
--     remark stored on the Sales Order.
--
-- Security:
--   * Existing sales.view / site / warehouse authorization
--     remains authoritative through Migration 24 functions.
--   * Direct Sales table access remains closed.
--   * No COGS exposure is added.
-- =========================================================


-- =========================================================
-- 1. PRIVATE SALES HISTORY ENRICHMENT
-- =========================================================

create or replace function
app_private.get_sales_history_customer_context_impl(
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
  v_base jsonb;
  v_orders jsonb;
begin

  -- Existing Migration 24 implementation remains the
  -- authorization / filtering / snapshot authority.
  v_base :=
    app_private.get_sales_history_impl(
      p_tenant_id,
      p_warehouse_id,
      p_limit,
      p_offset,
      p_search,
      p_from_date,
      p_to_date
    );


  select
    coalesce(
      jsonb_agg(
        item.order_json
        ||
        jsonb_build_object(
          'customer_id',
            so.customer_id,

          'invoice_remark',
            so.invoice_remark
        )
        order by item.ordinality
      ),
      '[]'::jsonb
    )
  into v_orders
  from
    jsonb_array_elements(
      coalesce(
        v_base -> 'orders',
        '[]'::jsonb
      )
    )
    with ordinality
      as item(
        order_json,
        ordinality
      )

  left join public.sales_orders so
    on so.id =
       (
         item.order_json
         ->> 'sales_order_id'
       )::uuid

   and so.tenant_id =
       p_tenant_id;


  return
    jsonb_set(
      v_base,
      '{orders}',
      v_orders,
      true
    );

end;
$function$;


revoke all
on function
app_private.get_sales_history_customer_context_impl(
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
app_private.get_sales_history_customer_context_impl(
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
-- 2. PUBLIC HISTORY WRAPPER
--
-- Same existing public function identity/signature.
-- No overload is introduced.
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
    app_private.get_sales_history_customer_context_impl(
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
-- 3. PRIVATE INVOICE DETAIL ENRICHMENT
-- =========================================================

create or replace function
app_private.get_sales_invoice_detail_customer_context_impl(
  p_tenant_id uuid,
  p_sales_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_base jsonb;

  v_customer_id uuid;
  v_invoice_remark text;
begin

  -- Migration 24 implementation performs authentication,
  -- sales.view authorization, warehouse access validation,
  -- snapshot rendering and Lot/Batch trace construction.
  v_base :=
    app_private.get_sales_invoice_detail_impl(
      p_tenant_id,
      p_sales_order_id
    );


  select
    so.customer_id,
    so.invoice_remark
  into
    v_customer_id,
    v_invoice_remark
  from public.sales_orders so
  where so.id =
        p_sales_order_id
    and so.tenant_id =
        p_tenant_id;


  if not found then
    raise exception
      'Sales Order not found';
  end if;


  return
    jsonb_set(
      v_base,
      '{order}',
      coalesce(
        v_base -> 'order',
        '{}'::jsonb
      )
      ||
      jsonb_build_object(
        'customer_id',
          v_customer_id,

        'invoice_remark',
          v_invoice_remark
      ),
      true
    );

end;
$function$;


revoke all
on function
app_private.get_sales_invoice_detail_customer_context_impl(
  uuid,
  uuid
)
from public, anon;


grant execute
on function
app_private.get_sales_invoice_detail_customer_context_impl(
  uuid,
  uuid
)
to authenticated, service_role;


-- =========================================================
-- 4. PUBLIC INVOICE DETAIL WRAPPER
--
-- Same existing public function identity/signature.
-- No overload is introduced.
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
    app_private.get_sales_invoice_detail_customer_context_impl(
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
-- 5. DOCUMENTATION
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
)
is
  'Read-only controlled Sales History. Preserves immutable historical customer snapshot fields and additionally returns optional Customer Master linkage customer_id plus customer-visible invoice_remark. sales.view, site and warehouse controls remain enforced.';


comment on function
public.get_sales_invoice_detail(
  uuid,
  uuid
)
is
  'Read-only controlled Sales Invoice Detail. Preserves immutable historical customer snapshot fields and Lot/Batch traceability while additionally returning optional Customer Master linkage customer_id plus customer-visible invoice_remark. No COGS exposure is added.';


-- =========================================================
-- END
-- =========================================================
