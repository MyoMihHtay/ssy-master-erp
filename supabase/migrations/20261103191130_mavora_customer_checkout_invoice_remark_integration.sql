-- =========================================================
-- MAVORA ERP
-- Customer Master Checkout + Invoice Remark Integration
--
-- Phase 2P-6N-6F
--
-- IMPORTANT COMPATIBILITY DECISION
-- --------------------------------
-- Existing public.checkout_sales_order(...) is NOT replaced.
-- Existing checkout implementation is NOT overloaded.
--
-- A uniquely named checkout_sales_order_v2(...) RPC is added.
--
-- This keeps the current Sales UI / callers operational while
-- Customer Master integration is introduced safely.
--
-- V2 responsibilities:
--   * Optional Customer Master linkage for non-credit Sales
--   * Customer Master required for CREDIT Sales
--   * Customer snapshot copied at checkout
--   * Active Customer validation
--   * Credit Enabled / Credit Hold enforcement
--   * Credit Days snapshotted into existing credit_terms
--   * Customer-visible Invoice Remark
--   * Separate V2 context fingerprint for customer_id + remark
--   * Existing atomic Sales checkout remains the inventory /
--     pricing / COGS / base request-fingerprint authority
--
-- Not in this migration:
--   * Outstanding Balance calculation
--   * Credit Limit exposure calculation
--   * Payment Collection / Receivable ledger
--   * Sales History / Invoice UI rendering changes
-- =========================================================


-- =========================================================
-- 1. V2 CHECKOUT CONTEXT FINGERPRINT
-- =========================================================

alter table public.sales_orders
  add column checkout_context_fingerprint text;


alter table public.sales_orders
  add constraint
    sales_orders_checkout_context_fingerprint_check
  check (
    checkout_context_fingerprint is null
    or checkout_context_fingerprint
         ~ '^[0-9a-f]{64}$'
  );


comment on column
public.sales_orders.checkout_context_fingerprint
is
  'SHA-256 V2 checkout context fingerprint covering Customer Master linkage and Invoice Remark. Used together with the existing base request_fingerprint. Historical pre-V2 Sales Orders remain NULL.';


-- =========================================================
-- 2. PRIVATE CUSTOMER-AWARE CHECKOUT V2
-- =========================================================

create or replace function
app_private.checkout_sales_order_v2_impl(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_posting_key text,
  p_customer_name text,
  p_items jsonb,

  -- Required parameters by signature so this RPC remains
  -- distinct. Their VALUES may be NULL.
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
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid :=
    auth.uid();

  v_posting_key text;

  v_invoice_remark text;

  v_payment_method text;

  v_customer
    public.sales_customers%rowtype;

  v_existing_order
    public.sales_orders%rowtype;

  v_customer_name text;
  v_customer_ref text;
  v_customer_phone text;
  v_customer_shop_type text;
  v_customer_address text;
  v_customer_gps text;

  v_credit_terms text;

  v_context_fingerprint text;

  v_result jsonb;

  v_sales_order_id uuid;

  -- Resolved before any Sales Order / Customer Master
  -- information is inspected.
  v_site_id uuid;

  v_is_legacy_retry boolean :=
    false;
begin

  -- -------------------------------------------------------
  -- AUTH / BASIC INPUT
  -- -------------------------------------------------------

  if v_user_id is null then
    raise exception
      'Authentication required';
  end if;


  if p_tenant_id is null
     or p_warehouse_id is null then
    raise exception
      'Tenant and Finished Goods warehouse are required';
  end if;


  -- Prevent cross-tenant information discovery before the
  -- existing controlled checkout performs full Sales /
  -- warehouse authorization.
  if not exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = v_user_id
      and tm.status = 'active'
  ) then
    raise exception
      'Sales tenant access denied';
  end if;


  -- -------------------------------------------------------
  -- EARLY SALES EXECUTION AUTHORIZATION
  --
  -- This boundary intentionally runs before:
  --   * V2 context fingerprint processing
  --   * posting-key / existing-order inspection
  --   * Customer Master lookup
  --   * Customer active / credit-state errors
  --
  -- This prevents an active tenant member without
  -- sales.execute from inferring protected Sales or
  -- Customer state from distinct error responses.
  -- -------------------------------------------------------

  select
    w.site_id
  into
    v_site_id
  from public.warehouses w
  join public.sites s
    on s.id = w.site_id
   and s.tenant_id = w.tenant_id
   and s.is_active = true
  where w.id = p_warehouse_id
    and w.tenant_id = p_tenant_id
    and w.warehouse_type = 'FG'
    and w.is_active = true;


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


  v_posting_key :=
    nullif(
      btrim(p_posting_key),
      ''
    );


  if v_posting_key is null then
    raise exception
      'Sales posting key is required';
  end if;


  if length(v_posting_key) > 120 then
    raise exception
      'Sales posting key cannot exceed 120 characters';
  end if;


  v_invoice_remark :=
    nullif(
      btrim(p_invoice_remark),
      ''
    );


  if v_invoice_remark is not null
     and length(v_invoice_remark) > 500 then
    raise exception
      'Invoice Remark cannot exceed 500 characters';
  end if;


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


  -- -------------------------------------------------------
  -- V2 CONTEXT FINGERPRINT
  --
  -- Existing request_fingerprint remains owned by the
  -- original atomic checkout.
  --
  -- Effective V2 request identity =
  --   base request_fingerprint
  --   +
  --   checkout_context_fingerprint
  -- -------------------------------------------------------

  v_context_fingerprint :=
    encode(
      extensions.digest(
        jsonb_build_object(
          'customer_id',
            p_customer_id,

          'invoice_remark',
            v_invoice_remark
        )::text,
        'sha256'
      ),
      'hex'
    );


  -- -------------------------------------------------------
  -- SAME ORDER-LEVEL LOCK AS EXISTING ATOMIC CHECKOUT
  -- -------------------------------------------------------

  perform
    pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'sales-checkout|'
        || p_tenant_id::text
        || '|'
        || v_posting_key,
        0
      )
    );


  -- -------------------------------------------------------
  -- RETRY / EXISTING ORDER CHECK
  -- -------------------------------------------------------

  select so.*
  into v_existing_order
  from public.sales_orders so
  where so.tenant_id = p_tenant_id
    and so.posting_key = v_posting_key;


  if found then

    -- Pre-V2 historical checkout.
    if v_existing_order.checkout_context_fingerprint
         is null then

      if p_customer_id is not null
         or v_invoice_remark is not null then
        raise exception
          'Existing checkout predates Customer/Invoice Remark context and cannot be enriched by retry';
      end if;


      v_is_legacy_retry :=
        true;


      -- Preserve the exact historical customer snapshot.
      v_customer_name :=
        v_existing_order.customer_name;

      v_customer_ref :=
        v_existing_order.customer_ref;

      v_customer_phone :=
        v_existing_order.customer_phone;

      v_customer_shop_type :=
        v_existing_order.customer_shop_type;

      v_customer_address :=
        v_existing_order.customer_address;

      v_customer_gps :=
        v_existing_order.customer_gps;

      v_credit_terms :=
        v_existing_order.credit_terms;

    else

      if v_existing_order.checkout_context_fingerprint
           <> v_context_fingerprint then
        raise exception
          'Sales posting key already exists with different Customer/Invoice Remark context';
      end if;


      if v_existing_order.customer_id
           is distinct from p_customer_id then
        raise exception
          'Sales posting key already exists with different Customer';
      end if;


      if v_existing_order.invoice_remark
           is distinct from v_invoice_remark then
        raise exception
          'Sales posting key already exists with different Invoice Remark';
      end if;


      -- Important:
      -- Retry uses the immutable historical Sales snapshot,
      -- not the CURRENT Customer Master values.
      v_customer_name :=
        v_existing_order.customer_name;

      v_customer_ref :=
        v_existing_order.customer_ref;

      v_customer_phone :=
        v_existing_order.customer_phone;

      v_customer_shop_type :=
        v_existing_order.customer_shop_type;

      v_customer_address :=
        v_existing_order.customer_address;

      v_customer_gps :=
        v_existing_order.customer_gps;

      v_credit_terms :=
        v_existing_order.credit_terms;

    end if;


    v_result :=
      app_private.checkout_sales_order_impl(
        p_tenant_id,
        p_warehouse_id,
        v_posting_key,
        v_customer_name,
        p_items,

        p_price_list_id,
        p_invoice_no,

        v_customer_ref,
        v_customer_phone,
        v_customer_shop_type,
        v_customer_address,
        v_customer_gps,

        v_payment_method,
        v_credit_terms,

        p_discount_percent,
        p_tax_percent,

        p_sold_at
      );


    return
      v_result
      ||
      jsonb_build_object(
        'customer_id',
          v_existing_order.customer_id,

        'invoice_remark',
          v_existing_order.invoice_remark,

        'checkout_version',
          case
            when v_is_legacy_retry
              then 'legacy'
            else 'v2'
          end
      );

  end if;


  -- -------------------------------------------------------
  -- NEW CHECKOUT CUSTOMER RESOLUTION
  -- -------------------------------------------------------

  if p_customer_id is not null then

    select *
    into v_customer
    from public.sales_customers
    where id = p_customer_id
      and tenant_id = p_tenant_id;


    if not found then
      raise exception
        'Sales Customer was not found';
    end if;


    if not v_customer.is_active then
      raise exception
        'Inactive Sales Customer cannot be used for new checkout';
    end if;


    -- Customer Master is source of truth for new Sales.
    v_customer_name :=
      v_customer.name;

    v_customer_ref :=
      v_customer.customer_code;

    v_customer_phone :=
      v_customer.phone;

    v_customer_shop_type :=
      v_customer.shop_type;

    v_customer_address :=
      v_customer.address;

    v_customer_gps :=
      v_customer.gps;

  else

    -- Transitional ad-hoc customer path for non-credit Sales.
    -- Existing UI can continue operating until Customer
    -- selection UI is connected.
    v_customer_name :=
      p_customer_name;

    v_customer_ref :=
      p_customer_ref;

    v_customer_phone :=
      p_customer_phone;

    v_customer_shop_type :=
      p_customer_shop_type;

    v_customer_address :=
      p_customer_address;

    v_customer_gps :=
      p_customer_gps;

  end if;


  -- -------------------------------------------------------
  -- CREDIT POLICY
  -- -------------------------------------------------------

  if v_payment_method = 'CREDIT' then

    if p_customer_id is null then
      raise exception
        'Customer Master selection is required for CREDIT Sales';
    end if;


    if not v_customer.credit_enabled then
      raise exception
        'Customer is not enabled for CREDIT Sales';
    end if;


    if v_customer.credit_hold then
      raise exception
        'Customer CREDIT Sales are currently on hold';
    end if;


    -- Snapshot Customer Master credit days into the
    -- existing historical credit_terms field.
    v_credit_terms :=
      v_customer.credit_days::text
      || ' Days';

  else

    v_credit_terms :=
      p_credit_terms;

  end if;


  -- -------------------------------------------------------
  -- EXISTING ATOMIC SALES CORE
  --
  -- This remains authoritative for:
  --   authorization
  --   warehouse access
  --   pricing
  --   inventory issue
  --   lot allocation
  --   COGS
  --   totals
  --   invoice number
  --   base request fingerprint
  --   base idempotency
  -- -------------------------------------------------------

  v_result :=
    app_private.checkout_sales_order_impl(
      p_tenant_id,
      p_warehouse_id,
      v_posting_key,
      v_customer_name,
      p_items,

      p_price_list_id,
      p_invoice_no,

      v_customer_ref,
      v_customer_phone,
      v_customer_shop_type,
      v_customer_address,
      v_customer_gps,

      v_payment_method,
      v_credit_terms,

      p_discount_percent,
      p_tax_percent,

      p_sold_at
    );


  v_sales_order_id :=
    nullif(
      v_result ->> 'sales_order_id',
      ''
    )::uuid;


  if v_sales_order_id is null then
    raise exception
      'Controlled Sales checkout did not return Sales Order id';
  end if;


  -- Because this function holds the same transaction-level
  -- advisory lock as the atomic Sales core, this update is
  -- part of the SAME atomic checkout transaction.
  update public.sales_orders
  set
    customer_id =
      p_customer_id,

    invoice_remark =
      v_invoice_remark,

    checkout_context_fingerprint =
      v_context_fingerprint

  where id = v_sales_order_id
    and tenant_id = p_tenant_id;


  if not found then
    raise exception
      'Controlled Sales Order could not be linked to Customer context';
  end if;


  -- -------------------------------------------------------
  -- AUDIT CUSTOMER / INVOICE CONTEXT
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
  select
    so.tenant_id,
    so.site_id,
    v_user_id,

    'sales.checkout_customer_context',
    'sales_order',
    so.id,

    null,

    jsonb_build_object(
      'customer_id',
        so.customer_id,

      'customer_ref',
        so.customer_ref,

      'customer_name',
        so.customer_name,

      'payment_method',
        so.payment_method,

      'credit_terms',
        so.credit_terms,

      'invoice_remark',
        so.invoice_remark
    ),

    'Controlled Sales checkout V2 customer context',

    jsonb_build_object(
      'posting_key',
        so.posting_key,

      'base_request_fingerprint',
        so.request_fingerprint,

      'checkout_context_fingerprint',
        so.checkout_context_fingerprint,

      'checkout_version',
        'v2'
    )

  from public.sales_orders so
  where so.id = v_sales_order_id
    and so.tenant_id = p_tenant_id;


  return
    v_result
    ||
    jsonb_build_object(
      'customer_id',
        p_customer_id,

      'invoice_remark',
        v_invoice_remark,

      'checkout_version',
        'v2'
    );

end;
$function$;


-- =========================================================
-- 3. PRIVATE FUNCTION PRIVILEGES
-- =========================================================

revoke all
on function
app_private.checkout_sales_order_v2_impl(
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
from public, anon;


grant execute
on function
app_private.checkout_sales_order_v2_impl(
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
to authenticated, service_role;


-- =========================================================
-- 4. PUBLIC UNIQUE-NAME CHECKOUT V2
--
-- Do NOT overload checkout_sales_order.
-- Supabase/PostgREST RPC surface uses a unique function name.
-- =========================================================

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
set search_path = pg_catalog
as $function$

  select
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

$function$;


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
from public, anon;


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
to authenticated, service_role;


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
)
is
  'Controlled atomic Sales checkout V2 with Customer Master linkage, CREDIT Enabled/Hold validation, immutable customer snapshot and customer-visible Invoice Remark. Existing checkout_sales_order remains backward compatible.';


-- =========================================================
-- END
-- =========================================================
