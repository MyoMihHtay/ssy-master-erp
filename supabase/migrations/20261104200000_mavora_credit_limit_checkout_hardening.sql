-- ============================================================
-- MAVORA ERP
-- CREDIT LIMIT CHECKOUT HARDENING
--
-- Outstanding Balance remains DERIVED and is never stored.
--
-- New CREDIT checkout:
--
--   authorize
--   -> serialize Tenant + Customer CREDIT checkout
--   -> execute existing atomic V2 checkout
--   -> lock/recheck current Customer credit policy
--   -> derive Tenant-wide current AR
--   -> reject whole transaction if Credit Limit is exceeded
--
-- Existing private V2 checkout implementation remains intact.
-- Public checkout_sales_order_v2 keeps its existing signature.
--
-- Historical idempotent retries are preserved.
-- ============================================================


create or replace function
app_private.checkout_sales_order_credit_hardened_impl(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_posting_key text,
  p_customer_name text,
  p_items jsonb,

  p_customer_id uuid,
  p_invoice_remark text,

  p_price_list_id uuid default null,
  p_invoice_no text default null,

  p_customer_ref text default null,
  p_customer_phone text default null,
  p_customer_shop_type text default null,
  p_customer_address text default null,
  p_customer_gps text default null,

  p_payment_method text default 'CASH',
  p_credit_terms text default null,

  p_discount_percent numeric default 0,
  p_tax_percent numeric default 0,

  p_sold_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$

declare

  v_user_id uuid :=
    auth.uid();

  v_payment_method text;

  v_site_id uuid;

  v_result jsonb;

  v_customer
    public.sales_customers%rowtype;

  v_credit_limit numeric :=
    0;

  v_outstanding numeric :=
    0;

  v_available_credit numeric :=
    0;

begin

  -- ---------------------------------------------------------
  -- AUTHORIZATION BEFORE CUSTOMER LOCK
  -- ---------------------------------------------------------

  if v_user_id is null then
    raise exception
      'Authentication required';
  end if;


  if p_tenant_id is null
     or p_warehouse_id is null
  then
    raise exception
      'Tenant and Finished Goods warehouse are required';
  end if;


  if not exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id =
          p_tenant_id
      and tm.user_id =
          v_user_id
      and tm.status =
          'active'
  ) then
    raise exception
      'Sales tenant access denied';
  end if;


  select
    w.site_id
  into
    v_site_id
  from public.warehouses w

  join public.sites s
    on s.id =
       w.site_id
   and s.tenant_id =
       w.tenant_id
   and s.is_active =
       true

  where w.id =
        p_warehouse_id
    and w.tenant_id =
        p_tenant_id
    and w.warehouse_type =
        'FG'
    and w.is_active =
        true;


  if v_site_id is null then
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
    'sales.execute',
    v_site_id
  );


  v_payment_method :=
    upper(
      coalesce(
        nullif(
          btrim(p_payment_method),
          ''
        ),
        'CASH'
      )
    );


  -- ---------------------------------------------------------
  -- CUSTOMER CREDIT CONCURRENCY LOCK
  --
  -- New CREDIT Sales for one Tenant/Customer serialize here.
  -- Different Customers remain independent.
  -- ---------------------------------------------------------

  if v_payment_method = 'CREDIT'
     and p_customer_id is not null
  then

    perform
      pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
          'sales-credit-customer|'
          || p_tenant_id::text
          || '|'
          || p_customer_id::text,
          0
        )
      );

  end if;


  -- ---------------------------------------------------------
  -- EXISTING V2 ATOMIC CORE
  --
  -- Remains authoritative for:
  --   pricing
  --   inventory issue
  --   lot allocation
  --   COGS
  --   invoice creation
  --   customer snapshot
  --   credit days snapshot
  --   base idempotency
  --   audit
  -- ---------------------------------------------------------

  v_result :=
    app_private.checkout_sales_order_v2_impl(
      p_tenant_id,
      p_warehouse_id,
      p_posting_key,
      p_customer_name,
      p_items,

      p_customer_id,
      p_invoice_remark,

      p_price_list_id,
      p_invoice_no,

      p_customer_ref,
      p_customer_phone,
      p_customer_shop_type,
      p_customer_address,
      p_customer_gps,

      p_payment_method,
      p_credit_terms,

      p_discount_percent,
      p_tax_percent,

      p_sold_at
    );


  -- ---------------------------------------------------------
  -- HISTORICAL IDEMPOTENT RETRY
  --
  -- A previously-posted transaction is historical authority.
  -- Do not retroactively reject it because current Customer
  -- credit settings later changed.
  -- ---------------------------------------------------------

  if coalesce(
       (
         v_result
         ->> 'idempotent'
       )::boolean,
       false
     )
  then

    return
      v_result
      ||
      jsonb_build_object(
        'credit_limit_check',
        'historical_retry'
      );

  end if;


  -- Non-credit checkout behavior stays unchanged.

  if v_payment_method <> 'CREDIT' then
    return
      v_result;
  end if;


  if p_customer_id is null then
    raise exception
      'Customer Master selection is required for CREDIT Sales';
  end if;


  -- ---------------------------------------------------------
  -- LOCK + RECHECK CURRENT CUSTOMER POLICY
  --
  -- This shares a row-lock boundary with controlled payment
  -- posting and protects against concurrent Customer policy
  -- updates.
  -- ---------------------------------------------------------

  select sc.*
  into v_customer
  from public.sales_customers sc
  where sc.id =
        p_customer_id
    and sc.tenant_id =
        p_tenant_id
  for update;


  if not found then
    raise exception
      'Sales Customer was not found';
  end if;


  if not v_customer.is_active then
    raise exception
      'Inactive Sales Customer cannot be used for new checkout';
  end if;


  if not v_customer.credit_enabled then
    raise exception
      'Customer is not enabled for CREDIT Sales';
  end if;


  if v_customer.credit_hold then
    raise exception
      'Customer CREDIT Sales are currently on hold';
  end if;


  v_credit_limit :=
    round(
      greatest(
        coalesce(
          v_customer.credit_limit,
          0
        ),
        0
      ),
      6
    );


  -- ---------------------------------------------------------
  -- DERIVE TENANT-WIDE CURRENT AR AFTER CHECKOUT
  --
  -- Outstanding:
  --
  --   CREDIT invoice
  --   - effective posted Credit Notes
  --   - effective Payment Allocations
  --
  -- Per-invoice negative balances become Customer Credit and
  -- do not expand the configured Credit Limit.
  --
  -- Future-dated Returns/Payments do not reduce current AR.
  -- ---------------------------------------------------------

  select
    round(
      coalesce(
        sum(
          greatest(

            so.grand_total

            -
            coalesce(
              (
                select
                  sum(
                    sr.grand_total_credit
                  )
                from public.sales_returns sr
                where sr.tenant_id =
                      so.tenant_id
                  and sr.sales_order_id =
                      so.id
                  and sr.status =
                      'posted'
                  and sr.returned_at <=
                      now()
              ),
              0
            )

            -
            coalesce(
              (
                select
                  sum(
                    ra.allocated_amount
                  )
                from public.sales_receivable_allocations ra

                join public.sales_receivable_payments rp
                  on rp.id =
                     ra.payment_id
                 and rp.tenant_id =
                     ra.tenant_id

                where ra.tenant_id =
                      so.tenant_id
                  and ra.sales_order_id =
                      so.id
                  and rp.received_at <=
                      now()
              ),
              0
            ),

            0
          )
        ),
        0
      ),
      6
    )
  into
    v_outstanding

  from public.sales_orders so

  where so.tenant_id =
        p_tenant_id

    and so.customer_id =
        p_customer_id

    and upper(
          coalesce(
            so.payment_method,
            ''
          )
        ) =
        'CREDIT'

    and so.status in (
      'posted',
      'partially_returned',
      'returned'
    )

    and so.sold_at <=
        now();


  v_outstanding :=
    coalesce(
      v_outstanding,
      0
    );


  v_available_credit :=
    round(
      greatest(
        v_credit_limit
        -
        v_outstanding,
        0
      ),
      6
    );


  -- ---------------------------------------------------------
  -- FINAL LIMIT AUTHORITY
  --
  -- This exception rolls back the complete V2 atomic checkout.
  -- ---------------------------------------------------------

  if v_outstanding >
     v_credit_limit
  then

    raise exception
      'Customer CREDIT limit exceeded. Credit Limit: %, Outstanding after checkout: %',
      v_credit_limit,
      v_outstanding;

  end if;


  return
    v_result
    ||
    jsonb_build_object(

      'credit_limit_check',
        'passed',

      'credit_limit',
        v_credit_limit,

      'outstanding_after_checkout',
        v_outstanding,

      'available_credit_after_checkout',
        v_available_credit

    );

end;

$function$;


-- ============================================================
-- PUBLIC V2 API
--
-- Existing RPC identity/signature is retained.
-- ============================================================

create or replace function
public.checkout_sales_order_v2(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_posting_key text,
  p_customer_name text,
  p_items jsonb,

  p_customer_id uuid,
  p_invoice_remark text,

  p_price_list_id uuid default null,
  p_invoice_no text default null,

  p_customer_ref text default null,
  p_customer_phone text default null,
  p_customer_shop_type text default null,
  p_customer_address text default null,
  p_customer_gps text default null,

  p_payment_method text default 'CASH',
  p_credit_terms text default null,

  p_discount_percent numeric default 0,
  p_tax_percent numeric default 0,

  p_sold_at timestamptz default null
)
returns jsonb
language sql
security invoker
set search_path to 'pg_catalog'
as $function$

  select
    app_private.checkout_sales_order_credit_hardened_impl(
      p_tenant_id,
      p_warehouse_id,
      p_posting_key,
      p_customer_name,
      p_items,

      p_customer_id,
      p_invoice_remark,

      p_price_list_id,
      p_invoice_no,

      p_customer_ref,
      p_customer_phone,
      p_customer_shop_type,
      p_customer_address,
      p_customer_gps,

      p_payment_method,
      p_credit_terms,

      p_discount_percent,
      p_tax_percent,

      p_sold_at
    );

$function$;


-- ============================================================
-- PRIVILEGES
-- ============================================================

revoke all
on function
app_private.checkout_sales_order_credit_hardened_impl(
  uuid,
  uuid,
  text,
  text,
  jsonb,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  timestamptz
)
from public,
     anon;


grant execute
on function
app_private.checkout_sales_order_credit_hardened_impl(
  uuid,
  uuid,
  text,
  text,
  jsonb,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  timestamptz
)
to authenticated,
   service_role;


revoke all
on function
public.checkout_sales_order_v2(
  uuid,
  uuid,
  text,
  text,
  jsonb,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  timestamptz
)
from public,
     anon;


grant execute
on function
public.checkout_sales_order_v2(
  uuid,
  uuid,
  text,
  text,
  jsonb,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  timestamptz
)
to authenticated,
   service_role;


comment on function
app_private.checkout_sales_order_credit_hardened_impl(
  uuid,
  uuid,
  text,
  text,
  jsonb,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  timestamptz
) is
  'Controlled Sales checkout credit-limit layer. Serializes new CREDIT Sales per Tenant/Customer, preserves historical idempotent retries, reuses the existing atomic V2 checkout and rejects transactions whose derived Tenant-wide Accounts Receivable exposure exceeds Customer Master credit_limit.';


comment on function
public.checkout_sales_order_v2(
  uuid,
  uuid,
  text,
  text,
  jsonb,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  timestamptz
) is
  'Public SECURITY INVOKER Sales checkout V2 API with controlled Tenant-wide derived Accounts Receivable Credit Limit enforcement.';
