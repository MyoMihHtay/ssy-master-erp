-- MAVORA Manufacturing ERP
-- Phase 2P-6N-4B
-- Atomic Controlled Sales Checkout
--
-- Goals:
--   * sales.execute is the Sales stock-issue authority
--   * no inventory.post capability required for Sales users
--   * server-side price validation
--   * order-level idempotency / request fingerprint
--   * FG warehouse enforcement
--   * FEFO Lot / Batch allocation
--   * expired Lot / Batch rejection
--   * atomic FG balance deduction
--   * inventory movement ledger posting
--   * exact Lot / Batch Sales allocation trace
--   * COGS snapshot
--   * audit trail
--
-- Not included:
--   * legacy Sales UI cut-over
--   * Sales Returns
--   * Finance posting
--
-- Public API:
--   public.checkout_sales_order(...)
--     SECURITY INVOKER
--
-- Privileged implementations remain in app_private.


-- =========================================================
-- 1. SALES ORDER CHECKOUT METADATA
-- =========================================================

alter table public.sales_orders
  add column request_fingerprint text;

alter table public.sales_orders
  add column discount_percent numeric(9,6)
  not null default 0;

alter table public.sales_orders
  add column tax_percent numeric(9,6)
  not null default 0;

alter table public.sales_orders
  add column customer_shop_type text;

alter table public.sales_orders
  add column customer_gps text;

alter table public.sales_orders
  add column inventory_movement_group_id uuid;


alter table public.sales_orders
  add constraint sales_orders_request_fingerprint_check
  check (
    request_fingerprint is null
    or length(request_fingerprint) = 64
  );

alter table public.sales_orders
  add constraint sales_orders_discount_percent_check
  check (
    discount_percent >= 0
    and discount_percent <= 100
  );

alter table public.sales_orders
  add constraint sales_orders_tax_percent_check
  check (
    tax_percent >= 0
    and tax_percent <= 100
  );

alter table public.sales_orders
  add constraint sales_orders_posting_key_length_check
  check (
    length(btrim(posting_key))
      between 1 and 120
  );


-- =========================================================
-- 2. SALES ALLOCATION → INVENTORY MOVEMENT INTEGRITY
-- =========================================================

alter table public.sales_inventory_allocations
  add constraint fk_sales_inventory_allocations_movement
  foreign key (
    inventory_movement_id,
    tenant_id
  )
  references public.inventory_movements(
    id,
    tenant_id
  )
  on delete restrict;


create unique index
  uq_sales_inventory_allocations_movement
on public.sales_inventory_allocations (
  tenant_id,
  inventory_movement_id
)
where inventory_movement_id is not null;


-- =========================================================
-- 3. SALES FK PERFORMANCE INDEXES
-- =========================================================

create index sales_orders_price_list_fk_idx
on public.sales_orders (
  price_list_id,
  tenant_id
);

create index sales_orders_site_fk_idx
on public.sales_orders (
  site_id,
  tenant_id
);

create index sales_orders_warehouse_fk_idx
on public.sales_orders (
  warehouse_id,
  tenant_id,
  site_id
);

create index sales_order_lines_order_fk_idx
on public.sales_order_lines (
  sales_order_id,
  tenant_id
);

create index sales_order_lines_product_fk_idx
on public.sales_order_lines (
  product_id,
  tenant_id
);

create index sales_inventory_allocations_order_fk_idx
on public.sales_inventory_allocations (
  sales_order_id,
  tenant_id
);

create index sales_inventory_allocations_line_fk_idx
on public.sales_inventory_allocations (
  sales_order_line_id,
  tenant_id
);

create index sales_inventory_allocations_warehouse_fk_idx
on public.sales_inventory_allocations (
  warehouse_id,
  tenant_id
);

create index sales_inventory_allocations_product_fk_idx
on public.sales_inventory_allocations (
  product_id,
  tenant_id
);

create index sales_inventory_allocations_lot_fk_idx
on public.sales_inventory_allocations (
  lot_id,
  tenant_id,
  product_id
)
where lot_id is not null;

create index sales_inventory_allocations_movement_fk_idx
on public.sales_inventory_allocations (
  inventory_movement_id,
  tenant_id
)
where inventory_movement_id is not null;


-- =========================================================
-- 4. PRIVATE SALES-SPECIFIC FG ISSUE ENGINE
-- =========================================================
--
-- IMPORTANT:
-- This deliberately does NOT call post_inventory_movement_impl().
-- That engine requires inventory.post.
--
-- Sales checkout instead requires:
--   sales.execute
--
-- It preserves the same core controls:
--   * warehouse / site authorization
--   * product / lot validation
--   * posting-key idempotency
--   * balance locking
--   * reserved-stock protection
--   * weighted-average outgoing COGS
--   * append-only inventory ledger
--   * audit logging

create or replace function
app_private.post_sales_inventory_issue_impl(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_product_id uuid,
  p_lot_id uuid,
  p_quantity numeric,
  p_posting_key text,
  p_movement_group_id uuid,
  p_sales_order_id uuid,
  p_sale_date date,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();

  v_site_id uuid;
  v_tracking_mode text;

  v_lot_status text;
  v_expires_at date;

  v_balance_id uuid;
  v_current_qty numeric(20,6);
  v_reserved_qty numeric(20,6);
  v_current_avg numeric(20,6);
  v_new_qty numeric(20,6);

  v_movement_id uuid;

  v_existing_count integer;
  v_existing public.inventory_movements%rowtype;
begin

  if v_user_id is null then
    raise exception
      'Authentication required';
  end if;


  if p_quantity is null
     or p_quantity <= 0 then
    raise exception
      'Sales issue quantity must be greater than zero';
  end if;

  if p_quantity <> round(p_quantity, 6) then
    raise exception
      'Sales issue quantity cannot exceed 6 decimal places';
  end if;

  if p_quantity > 99999999999999.999999 then
    raise exception
      'Sales issue quantity exceeds supported numeric range';
  end if;


  if p_posting_key is null
     or length(btrim(p_posting_key)) = 0 then
    raise exception
      'Sales inventory posting key is required';
  end if;

  if length(btrim(p_posting_key)) > 200 then
    raise exception
      'Sales inventory posting key cannot exceed 200 characters';
  end if;


  if p_movement_group_id is null
     or p_sales_order_id is null then
    raise exception
      'Sales inventory movement group and Sales Order are required';
  end if;

  if p_sale_date is null then
    raise exception
      'Sales date is required';
  end if;


  select w.site_id
  into v_site_id
  from public.warehouses w
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


  select p.tracking_mode
  into v_tracking_mode
  from public.products p
  where p.id = p_product_id
    and p.tenant_id = p_tenant_id
    and p.product_type = 'FG'
    and p.is_active = true;

  if v_tracking_mode is null then
    raise exception
      'Active Finished Goods product not found';
  end if;


  if v_tracking_mode in ('lot', 'batch')
     and p_lot_id is null then
    raise exception
      'Lot / Batch is required for tracked Sales product';
  end if;


  if v_tracking_mode = 'none'
     and p_lot_id is not null then
    raise exception
      'Lot / Batch is not allowed for non-tracked Sales product';
  end if;


  if p_lot_id is not null then

    select
      il.status,
      il.expires_at
    into
      v_lot_status,
      v_expires_at
    from public.inventory_lots il
    where il.id = p_lot_id
      and il.tenant_id = p_tenant_id
      and il.product_id = p_product_id;

    if v_lot_status is null then
      raise exception
        'Sales Lot / Batch does not belong to Product and Tenant';
    end if;

    if v_lot_status <> 'released' then
      raise exception
        'Only released Lot / Batch stock may be sold';
    end if;

    if v_expires_at is not null
       and v_expires_at < p_sale_date then
      raise exception
        'Expired Lot / Batch cannot be sold';

    end if;

  end if;


  -- -------------------------------------------------------
  -- CHILD POSTING IDEMPOTENCY
  -- -------------------------------------------------------

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'sales-inventory-posting|'
      || p_tenant_id::text
      || '|'
      || btrim(p_posting_key),
      0
    )
  );


  select count(*)
  into v_existing_count
  from public.inventory_movements im
  where im.tenant_id = p_tenant_id
    and im.posting_key = btrim(p_posting_key);


  if v_existing_count > 0 then

    if v_existing_count <> 1 then
      raise exception
        'Sales posting key already belongs to another posting group';
    end if;


    select im.*
    into v_existing
    from public.inventory_movements im
    where im.tenant_id = p_tenant_id
      and im.posting_key = btrim(p_posting_key)
    limit 1;


    if v_existing.warehouse_id
         <> p_warehouse_id

       or v_existing.product_id
         <> p_product_id

       or v_existing.lot_id
         is distinct from p_lot_id

       or v_existing.movement_type
         <> 'issue'

       or abs(v_existing.quantity)
         <> p_quantity

       or v_existing.movement_group_id
         <> p_movement_group_id

       or v_existing.reference_type
         is distinct from 'sales_order'

       or v_existing.reference_id
         is distinct from p_sales_order_id::text

    then
      raise exception
        'Sales posting key has already been used for different data';
    end if;


    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'movement_id', v_existing.id,
      'movement_group_id',
        v_existing.movement_group_id,
      'unit_cost',
        v_existing.unit_cost,
      'quantity',
        abs(v_existing.quantity),
      'posting_key',
        v_existing.posting_key
    );

  end if;


  -- -------------------------------------------------------
  -- BALANCE LOCK
  -- -------------------------------------------------------

  v_balance_id :=
    app_private.lock_inventory_balance(
      p_tenant_id,
      p_warehouse_id,
      p_product_id,
      p_lot_id
    );


  select
    ib.quantity,
    ib.reserved_quantity,
    ib.average_unit_cost
  into
    v_current_qty,
    v_reserved_qty,
    v_current_avg
  from public.inventory_balances ib
  where ib.id = v_balance_id
  for update;


  if (v_current_qty - v_reserved_qty)
       < p_quantity then
    raise exception
      'Insufficient sellable stock. On hand: %, Reserved: %, Requested: %',
      v_current_qty,
      v_reserved_qty,
      p_quantity;
  end if;


  if v_current_avg is null then
    raise exception
      'Finished Goods inventory cost is missing';
  end if;


  v_new_qty :=
    v_current_qty - p_quantity;


  update public.inventory_balances
  set
    quantity = v_new_qty,
    updated_at = now()
  where id = v_balance_id;


  -- -------------------------------------------------------
  -- APPEND INVENTORY LEDGER
  -- -------------------------------------------------------

  v_movement_id :=
    gen_random_uuid();


  insert into public.inventory_movements (
    id,
    movement_group_id,
    tenant_id,
    site_id,
    warehouse_id,
    product_id,
    lot_id,
    movement_type,
    quantity,
    unit_cost,
    posting_key,
    reference_type,
    reference_id,
    reason,
    occurred_at,
    created_by
  )
  values (
    v_movement_id,
    p_movement_group_id,
    p_tenant_id,
    v_site_id,
    p_warehouse_id,
    p_product_id,
    p_lot_id,
    'issue',
    -p_quantity,
    v_current_avg,
    btrim(p_posting_key),
    'sales_order',
    p_sales_order_id::text,
    'Controlled Sales checkout',
    coalesce(
      p_occurred_at,
      now()
    ),
    v_user_id
  );


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
    after_data,
    reason,
    metadata
  )
  values (
    p_tenant_id,
    v_site_id,
    v_user_id,
    'sales.inventory_issue',
    'inventory_movement',
    v_movement_id,
    jsonb_build_object(
      'sales_order_id',
        p_sales_order_id,
      'warehouse_id',
        p_warehouse_id,
      'product_id',
        p_product_id,
      'lot_id',
        p_lot_id,
      'quantity',
        -p_quantity,
      'unit_cost',
        v_current_avg,
      'balance_before',
        v_current_qty,
      'balance_after',
        v_new_qty
    ),
    'Controlled Sales checkout',
    jsonb_build_object(
      'movement_group_id',
        p_movement_group_id,
      'posting_key',
        btrim(p_posting_key)
    )
  );


  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'movement_id', v_movement_id,
    'movement_group_id',
      p_movement_group_id,
    'unit_cost',
      v_current_avg,
    'quantity',
      p_quantity,
    'quantity_before',
      v_current_qty,
    'quantity_after',
      v_new_qty,
    'posting_key',
      btrim(p_posting_key)
  );

end;
$function$;


-- Internal only.
revoke all
on function
app_private.post_sales_inventory_issue_impl(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  uuid,
  uuid,
  date,
  timestamptz
)
from public, anon, authenticated, service_role;


-- =========================================================
-- 5. PRIVATE ATOMIC SALES CHECKOUT
-- =========================================================

create or replace function
app_private.checkout_sales_order_impl(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_posting_key text,
  p_customer_name text,
  p_items jsonb,

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

  v_customer_name text;
  v_customer_ref text;
  v_customer_phone text;
  v_customer_shop_type text;
  v_customer_address text;
  v_customer_gps text;

  v_payment_method text;
  v_credit_terms text;

  v_invoice_input text;
  v_invoice_no text;

  v_discount_percent numeric;
  v_tax_percent numeric;

  v_site_id uuid;
  v_site_timezone text;

  v_sold_at timestamptz;
  v_sale_date date;

  v_price_list public.sales_price_lists%rowtype;

  v_normalized_items jsonb :=
    '[]'::jsonb;

  v_line_rows jsonb :=
    '[]'::jsonb;

  v_request_fingerprint text;

  v_item jsonb;
  v_line jsonb;

  v_item_count integer;
  v_distinct_product_count integer;

  v_product_id uuid;
  v_quantity numeric;

  v_product_sku text;
  v_tracking_mode text;

  v_price_id uuid;
  v_unit_price numeric;
  v_min_quantity numeric;

  v_line_no integer := 0;

  v_line_subtotal numeric;
  v_line_discount numeric;
  v_line_tax numeric;
  v_line_total numeric;

  v_subtotal numeric := 0;
  v_discount_amount numeric := 0;
  v_tax_amount numeric := 0;
  v_grand_total numeric := 0;

  v_order_id uuid;
  v_movement_group_id uuid;

  v_existing_order
    public.sales_orders%rowtype;

  v_line_id uuid;

  v_remaining numeric;
  v_alloc_qty numeric;
  v_alloc_seq integer;

  v_lot record;

  v_issue_result jsonb;
  v_issue_unit_cost numeric;
  v_issue_movement_id uuid;

  v_line_cogs numeric;
  v_total_cogs numeric := 0;

  v_lines_result jsonb;
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


  v_customer_name :=
    nullif(
      btrim(p_customer_name),
      ''
    );

  if v_customer_name is null then
    raise exception
      'Customer name is required';
  end if;

  if length(v_customer_name) > 300 then
    raise exception
      'Customer name cannot exceed 300 characters';
  end if;


  v_customer_ref :=
    nullif(
      btrim(p_customer_ref),
      ''
    );

  v_customer_phone :=
    nullif(
      btrim(p_customer_phone),
      ''
    );

  v_customer_shop_type :=
    nullif(
      btrim(p_customer_shop_type),
      ''
    );

  v_customer_address :=
    nullif(
      btrim(p_customer_address),
      ''
    );

  v_customer_gps :=
    nullif(
      btrim(p_customer_gps),
      ''
    );


  v_invoice_input :=
    nullif(
      btrim(p_invoice_no),
      ''
    );

  if v_invoice_input is not null
     and length(v_invoice_input) > 100 then
    raise exception
      'Invoice number cannot exceed 100 characters';
  end if;


  v_payment_method :=
    upper(
      nullif(
        btrim(p_payment_method),
        ''
      )
    );

  if v_payment_method is null then
    v_payment_method :=
      'CASH';
  end if;


  if v_payment_method not in (
    'CASH',
    'KPAY',
    'WAVE PAY',
    'UAB PAY',
    'AYA PAY',
    'CREDIT'
  ) then
    raise exception
      'Unsupported Sales payment method: %',
      v_payment_method;
  end if;


  v_credit_terms :=
    nullif(
      btrim(p_credit_terms),
      ''
    );

  if v_payment_method = 'CREDIT'
     and v_credit_terms is null then
    raise exception
      'Credit terms are required for CREDIT Sales';
  end if;

  if v_payment_method <> 'CREDIT' then
    v_credit_terms :=
      null;
  end if;


  v_discount_percent :=
    coalesce(
      p_discount_percent,
      0
    );

  v_tax_percent :=
    coalesce(
      p_tax_percent,
      0
    );


  if v_discount_percent < 0
     or v_discount_percent > 100
     or v_discount_percent
          <> round(v_discount_percent, 6)
  then
    raise exception
      'Discount percent must be between 0 and 100 with at most 6 decimal places';
  end if;


  if v_tax_percent < 0
     or v_tax_percent > 100
     or v_tax_percent
          <> round(v_tax_percent, 6)
  then
    raise exception
      'Tax percent must be between 0 and 100 with at most 6 decimal places';
  end if;


  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
  then
    raise exception
      'Sales items must be a non-empty JSON array';
  end if;


  -- -------------------------------------------------------
  -- SERVER-AUTHORITATIVE SALES TIME
  -- -------------------------------------------------------
  --
  -- Controlled POS checkout does not accept arbitrary
  -- client backdating. Historical/backdated transactions
  -- require a separate controlled workflow.

  if p_sold_at is not null then
    raise exception
      'Client-supplied Sales timestamp is not allowed in controlled checkout';
  end if;


  -- -------------------------------------------------------
  -- NORMALIZE ITEMS
  -- -------------------------------------------------------

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop

    if jsonb_typeof(v_item) <> 'object' then
      raise exception
        'Every Sales item must be a JSON object';
    end if;


    begin

      v_product_id :=
        (v_item ->> 'product_id')::uuid;

      v_quantity :=
        (v_item ->> 'quantity')::numeric;

    exception
      when others then
        raise exception
          'Each Sales item requires valid product_id and quantity';
    end;


    if v_product_id is null then
      raise exception
        'Sales Product ID is required';
    end if;


    if v_quantity is null
       or v_quantity <= 0 then
      raise exception
        'Sales quantity must be greater than zero';
    end if;


    if v_quantity
         <> round(v_quantity, 6) then
      raise exception
        'Sales quantity cannot exceed 6 decimal places';
    end if;


    if v_quantity
         > 99999999999999.999999 then
      raise exception
        'Sales quantity exceeds supported numeric range';
    end if;


    v_normalized_items :=
      v_normalized_items
      ||
      jsonb_build_array(
        jsonb_build_object(
          'product_id',
            v_product_id::text,
          'quantity',
            v_quantity
        )
      );

  end loop;


  -- Canonical Product order makes request fingerprint stable
  -- even if the client sends the cart in another order.

  select
    coalesce(
      jsonb_agg(
        value
        order by value ->> 'product_id'
      ),
      '[]'::jsonb
    )
  into v_normalized_items
  from jsonb_array_elements(
    v_normalized_items
  );


  select
    count(*)::integer,
    count(
      distinct value ->> 'product_id'
    )::integer
  into
    v_item_count,
    v_distinct_product_count
  from jsonb_array_elements(
    v_normalized_items
  );


  if v_item_count
       <> v_distinct_product_count then
    raise exception
      'Duplicate Product rows are not allowed in one Sales checkout';
  end if;


  -- -------------------------------------------------------
  -- REQUEST FINGERPRINT
  -- -------------------------------------------------------
  --
  -- This fingerprints the CLIENT REQUEST, not server-resolved
  -- price / invoice / current timestamp.
  --
  -- Therefore a retry using the same posting key and same
  -- request remains idempotent even if the default Price List
  -- changes after the original successful checkout.

  v_request_fingerprint :=
    encode(
      extensions.digest(
      jsonb_build_object(
        'warehouse_id',
          p_warehouse_id,

        'price_list_id',
          p_price_list_id,

        'invoice_no',
          v_invoice_input,

        'customer_name',
          v_customer_name,

        'customer_ref',
          v_customer_ref,

        'customer_phone',
          v_customer_phone,

        'customer_shop_type',
          v_customer_shop_type,

        'customer_address',
          v_customer_address,

        'customer_gps',
          v_customer_gps,

        'payment_method',
          v_payment_method,

        'credit_terms',
          v_credit_terms,

        'discount_percent',
          v_discount_percent,

        'tax_percent',
          v_tax_percent,

        'sold_at',
          p_sold_at,

        'items',
          v_normalized_items
      )::text,
        'sha256'
      ),
      'hex'
    );


  -- -------------------------------------------------------
  -- ORDER-LEVEL IDEMPOTENCY LOCK
  -- -------------------------------------------------------

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'sales-checkout|'
      || p_tenant_id::text
      || '|'
      || v_posting_key,
      0
    )
  );


  select so.*
  into v_existing_order
  from public.sales_orders so
  where so.tenant_id = p_tenant_id
    and so.posting_key = v_posting_key
  for update;


  if found then

    if v_existing_order.request_fingerprint
         is distinct from
         v_request_fingerprint
    then
      raise exception
        'Sales posting key has already been used for different checkout data';
    end if;


    perform app_private.require_sales_access(
      p_tenant_id,
      'sales.execute',
      v_existing_order.site_id
    );


    if not app_private.has_warehouse_access(
      v_existing_order.warehouse_id
    ) then
      raise exception
        'Finished Goods warehouse access denied';
    end if;


    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'line_id',
              sol.id,
            'line_no',
              sol.line_no,
            'product_id',
              sol.product_id,
            'quantity',
              sol.quantity,
            'unit_price',
              sol.unit_price,
            'line_total',
              sol.line_total,
            'cogs_total',
              sol.cogs_total
          )
          order by sol.line_no
        ),
        '[]'::jsonb
      )
    into v_lines_result
    from public.sales_order_lines sol
    where sol.tenant_id =
            p_tenant_id
      and sol.sales_order_id =
            v_existing_order.id;


    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'sales_order_id',
        v_existing_order.id,
      'invoice_no',
        v_existing_order.invoice_no,
      'posting_key',
        v_existing_order.posting_key,
      'status',
        v_existing_order.status,
      'subtotal',
        v_existing_order.subtotal,
      'discount_amount',
        v_existing_order.discount_amount,
      'tax_amount',
        v_existing_order.tax_amount,
      'grand_total',
        v_existing_order.grand_total,
      'movement_group_id',
        v_existing_order.inventory_movement_group_id,
      'lines',
        v_lines_result
    );

  end if;


  -- -------------------------------------------------------
  -- NEW CHECKOUT WAREHOUSE / SITE AUTH
  -- -------------------------------------------------------

  select
    w.site_id,
    s.timezone
  into
    v_site_id,
    v_site_timezone
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


  -- -------------------------------------------------------
  -- SALES DATE / PRICE LIST
  -- -------------------------------------------------------

  v_sold_at :=
    now();


  v_sale_date :=
    (
      v_sold_at
      at time zone
      coalesce(
        v_site_timezone,
        'UTC'
      )
    )::date;


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


  -- -------------------------------------------------------
  -- SERVER PRICE VALIDATION / LINE SNAPSHOT
  -- -------------------------------------------------------

  for v_item in
    select value
    from jsonb_array_elements(
      v_normalized_items
    )
  loop

    v_product_id :=
      (v_item ->> 'product_id')::uuid;

    v_quantity :=
      (v_item ->> 'quantity')::numeric;


    select
      p.sku,
      p.tracking_mode
    into
      v_product_sku,
      v_tracking_mode
    from public.products p
    where p.id = v_product_id
      and p.tenant_id = p_tenant_id
      and p.product_type = 'FG'
      and p.is_active = true;


    if v_tracking_mode is null then
      raise exception
        'Active Finished Goods product not found: %',
        v_product_id;
    end if;


    select
      spp.id,
      spp.unit_price,
      spp.min_quantity
    into
      v_price_id,
      v_unit_price,
      v_min_quantity
    from public.sales_product_prices spp
    where spp.tenant_id =
            p_tenant_id
      and spp.price_list_id =
            v_price_list.id
      and spp.product_id =
            v_product_id
      and spp.is_active = true
      and spp.effective_from
            <= v_sale_date
      and (
        spp.effective_to is null
        or spp.effective_to
             >= v_sale_date
      )
    order by
      spp.effective_from desc,
      spp.created_at desc
    limit 1;


    if v_price_id is null then
      raise exception
        'No effective Sales price for Product % on %',
        v_product_sku,
        v_sale_date;
    end if;


    if v_quantity
         < v_min_quantity then
      raise exception
        'Product % requires minimum Sales quantity % for the selected Price List',
        v_product_sku,
        v_min_quantity;
    end if;


    v_line_subtotal :=
      round(
        v_quantity
        *
        v_unit_price,
        6
      );


    if v_line_subtotal
         > 99999999999999.999999 then
      raise exception
        'Sales line amount exceeds supported numeric range';
    end if;


    v_line_discount :=
      round(
        v_line_subtotal
        *
        v_discount_percent
        /
        100,
        6
      );


    v_line_tax :=
      round(
        (
          v_line_subtotal
          -
          v_line_discount
        )
        *
        v_tax_percent
        /
        100,
        6
      );


    v_line_total :=
      round(
        v_line_subtotal
        -
        v_line_discount
        +
        v_line_tax,
        6
      );


    v_subtotal :=
      v_subtotal
      +
      v_line_subtotal;

    v_discount_amount :=
      v_discount_amount
      +
      v_line_discount;

    v_tax_amount :=
      v_tax_amount
      +
      v_line_tax;

    v_grand_total :=
      v_grand_total
      +
      v_line_total;


    v_line_no :=
      v_line_no + 1;


    v_line_rows :=
      v_line_rows
      ||
      jsonb_build_array(
        jsonb_build_object(
          'line_no',
            v_line_no,
          'product_id',
            v_product_id,
          'sku',
            v_product_sku,
          'tracking_mode',
            v_tracking_mode,
          'quantity',
            v_quantity,
          'price_id',
            v_price_id,
          'unit_price',
            v_unit_price,
          'discount_amount',
            v_line_discount,
          'tax_amount',
            v_line_tax,
          'line_total',
            v_line_total
        )
      );

  end loop;


  if v_grand_total
       > 99999999999999.999999 then
    raise exception
      'Sales total exceeds supported numeric range';
  end if;


  -- -------------------------------------------------------
  -- CREATE SALES ORDER HEADER
  -- -------------------------------------------------------

  v_order_id :=
    gen_random_uuid();

  v_movement_group_id :=
    gen_random_uuid();


  v_invoice_no :=
    coalesce(
      v_invoice_input,
      'INV-'
      ||
      to_char(
        v_sale_date,
        'YYYYMMDD'
      )
      ||
      '-'
      ||
      upper(
        substr(
          replace(
            v_order_id::text,
            '-',
            ''
          ),
          1,
          8
        )
      )
    );


  insert into public.sales_orders (
    id,
    tenant_id,
    site_id,
    warehouse_id,
    price_list_id,

    invoice_no,
    posting_key,
    request_fingerprint,

    customer_ref,
    customer_name,
    customer_phone,
    customer_shop_type,
    customer_address,
    customer_gps,

    payment_method,
    credit_terms,
    is_paid,

    status,

    subtotal,
    discount_percent,
    discount_amount,
    tax_percent,
    tax_amount,
    grand_total,

    inventory_movement_group_id,

    sold_at,
    created_by
  )
  values (
    v_order_id,
    p_tenant_id,
    v_site_id,
    p_warehouse_id,
    v_price_list.id,

    v_invoice_no,
    v_posting_key,
    v_request_fingerprint,

    v_customer_ref,
    v_customer_name,
    v_customer_phone,
    v_customer_shop_type,
    v_customer_address,
    v_customer_gps,

    v_payment_method,
    v_credit_terms,
    (
      v_payment_method
      <> 'CREDIT'
    ),

    'posted',

    round(v_subtotal, 6),
    v_discount_percent,
    round(v_discount_amount, 6),
    v_tax_percent,
    round(v_tax_amount, 6),
    round(v_grand_total, 6),

    v_movement_group_id,

    v_sold_at,
    v_user_id
  );


  -- -------------------------------------------------------
  -- LINES + ATOMIC FG ISSUE + COGS
  -- -------------------------------------------------------

  for v_line in
    select value
    from jsonb_array_elements(
      v_line_rows
    )
  loop

    v_product_id :=
      (v_line ->> 'product_id')::uuid;

    v_quantity :=
      (v_line ->> 'quantity')::numeric;

    v_tracking_mode :=
      v_line ->> 'tracking_mode';

    v_line_no :=
      (v_line ->> 'line_no')::integer;


    insert into public.sales_order_lines (
      tenant_id,
      sales_order_id,
      product_id,
      line_no,
      quantity,
      unit_price,
      discount_amount,
      tax_amount,
      line_total,
      cogs_total
    )
    values (
      p_tenant_id,
      v_order_id,
      v_product_id,
      v_line_no,
      v_quantity,
      (v_line ->> 'unit_price')::numeric,
      (v_line ->> 'discount_amount')::numeric,
      (v_line ->> 'tax_amount')::numeric,
      (v_line ->> 'line_total')::numeric,
      null
    )
    returning id
    into v_line_id;


    v_remaining :=
      v_quantity;

    v_alloc_seq :=
      0;

    v_line_cogs :=
      0;


    -- -----------------------------------------------------
    -- NON-TRACKED FG
    -- -----------------------------------------------------

    if v_tracking_mode = 'none' then

      v_alloc_seq :=
        1;


      select
        app_private.post_sales_inventory_issue_impl(
          p_tenant_id,
          p_warehouse_id,
          v_product_id,
          null,
          v_quantity,
          v_posting_key
            || '|L'
            || v_line_no::text
            || '|A1',
          v_movement_group_id,
          v_order_id,
          v_sale_date,
          v_sold_at
        )
      into v_issue_result;


      v_issue_unit_cost :=
        (v_issue_result ->> 'unit_cost')::numeric;

      v_issue_movement_id :=
        (v_issue_result ->> 'movement_id')::uuid;


      v_line_cogs :=
        round(
          v_quantity
          *
          v_issue_unit_cost,
          6
        );


      insert into public.sales_inventory_allocations (
        tenant_id,
        sales_order_id,
        sales_order_line_id,
        warehouse_id,
        product_id,
        lot_id,
        inventory_movement_id,
        quantity,
        unit_cost,
        cogs_amount
      )
      values (
        p_tenant_id,
        v_order_id,
        v_line_id,
        p_warehouse_id,
        v_product_id,
        null,
        v_issue_movement_id,
        v_quantity,
        v_issue_unit_cost,
        v_line_cogs
      );


      v_remaining :=
        0;


    -- -----------------------------------------------------
    -- TRACKED FG — FEFO
    -- -----------------------------------------------------

    else

      for v_lot in

        select
          ib.lot_id,
          (
            ib.quantity
            -
            ib.reserved_quantity
          ) as available_qty,

          il.expires_at,
          il.manufactured_at,
          il.created_at,
          il.lot_no

        from public.inventory_balances ib

        join public.inventory_lots il
          on il.id = ib.lot_id
         and il.tenant_id = ib.tenant_id
         and il.product_id = ib.product_id

        where ib.tenant_id =
                p_tenant_id

          and ib.warehouse_id =
                p_warehouse_id

          and ib.product_id =
                v_product_id

          and il.status =
                'released'

          and (
            il.expires_at is null
            or il.expires_at
                 >= v_sale_date
          )

          and (
            ib.quantity
            -
            ib.reserved_quantity
          ) > 0

        order by
          il.expires_at
            nulls last,

          il.manufactured_at
            nulls last,

          il.created_at,

          il.lot_no,

          il.id

        for update of ib

      loop

        exit when
          v_remaining <= 0;


        v_alloc_qty :=
          least(
            v_remaining,
            v_lot.available_qty
          );


        if v_alloc_qty <= 0 then
          continue;
        end if;


        v_alloc_seq :=
          v_alloc_seq + 1;


        select
          app_private.post_sales_inventory_issue_impl(
            p_tenant_id,
            p_warehouse_id,
            v_product_id,
            v_lot.lot_id,
            v_alloc_qty,
            v_posting_key
              || '|L'
              || v_line_no::text
              || '|A'
              || v_alloc_seq::text,
            v_movement_group_id,
            v_order_id,
            v_sale_date,
            v_sold_at
          )
        into v_issue_result;


        v_issue_unit_cost :=
          (v_issue_result ->> 'unit_cost')::numeric;

        v_issue_movement_id :=
          (v_issue_result ->> 'movement_id')::uuid;


        insert into public.sales_inventory_allocations (
          tenant_id,
          sales_order_id,
          sales_order_line_id,
          warehouse_id,
          product_id,
          lot_id,
          inventory_movement_id,
          quantity,
          unit_cost,
          cogs_amount
        )
        values (
          p_tenant_id,
          v_order_id,
          v_line_id,
          p_warehouse_id,
          v_product_id,
          v_lot.lot_id,
          v_issue_movement_id,
          v_alloc_qty,
          v_issue_unit_cost,
          round(
            v_alloc_qty
            *
            v_issue_unit_cost,
            6
          )
        );


        v_line_cogs :=
          v_line_cogs
          +
          round(
            v_alloc_qty
            *
            v_issue_unit_cost,
            6
          );


        v_remaining :=
          v_remaining
          -
          v_alloc_qty;

      end loop;


      if v_remaining > 0 then
        raise exception
          'Insufficient released non-expired FG Lot / Batch stock for Product %. Short by %',
          v_product_id,
          v_remaining;
      end if;

    end if;


    update public.sales_order_lines
    set cogs_total =
          round(
            v_line_cogs,
            6
          )
    where id = v_line_id
      and tenant_id = p_tenant_id;


    v_total_cogs :=
      v_total_cogs
      +
      v_line_cogs;

  end loop;


  -- -------------------------------------------------------
  -- SALES ORDER AUDIT
  -- -------------------------------------------------------

  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_data,
    reason,
    metadata
  )
  values (
    p_tenant_id,
    v_site_id,
    v_user_id,
    'sales.checkout',
    'sales_order',
    v_order_id,
    jsonb_build_object(
      'invoice_no',
        v_invoice_no,

      'warehouse_id',
        p_warehouse_id,

      'price_list_id',
        v_price_list.id,

      'subtotal',
        round(v_subtotal, 6),

      'discount_amount',
        round(v_discount_amount, 6),

      'tax_amount',
        round(v_tax_amount, 6),

      'grand_total',
        round(v_grand_total, 6),

      'total_cogs',
        round(v_total_cogs, 6),

      'payment_method',
        v_payment_method,

      'is_paid',
        (
          v_payment_method
          <> 'CREDIT'
        )
    ),
    'Controlled atomic Sales checkout',
    jsonb_build_object(
      'posting_key',
        v_posting_key,

      'request_fingerprint',
        v_request_fingerprint,

      'movement_group_id',
        v_movement_group_id,

      'price_list_code',
        v_price_list.code,

      'currency_code',
        v_price_list.currency_code
    )
  );


  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'line_id',
            sol.id,

          'line_no',
            sol.line_no,

          'product_id',
            sol.product_id,

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

          'cogs_total',
            sol.cogs_total
        )
        order by sol.line_no
      ),
      '[]'::jsonb
    )
  into v_lines_result
  from public.sales_order_lines sol
  where sol.tenant_id =
          p_tenant_id
    and sol.sales_order_id =
          v_order_id;


  return jsonb_build_object(
    'ok', true,
    'idempotent', false,

    'sales_order_id',
      v_order_id,

    'invoice_no',
      v_invoice_no,

    'posting_key',
      v_posting_key,

    'status',
      'posted',

    'price_list_id',
      v_price_list.id,

    'price_list_code',
      v_price_list.code,

    'currency_code',
      v_price_list.currency_code,

    'subtotal',
      round(v_subtotal, 6),

    'discount_percent',
      v_discount_percent,

    'discount_amount',
      round(v_discount_amount, 6),

    'tax_percent',
      v_tax_percent,

    'tax_amount',
      round(v_tax_amount, 6),

    'grand_total',
      round(v_grand_total, 6),

    'total_cogs',
      round(v_total_cogs, 6),

    'payment_method',
      v_payment_method,

    'is_paid',
      (
        v_payment_method
        <> 'CREDIT'
      ),

    'movement_group_id',
      v_movement_group_id,

    'lines',
      v_lines_result
  );

end;
$function$;


revoke all
on function
app_private.checkout_sales_order_impl(
  uuid,
  uuid,
  text,
  text,
  jsonb,
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
app_private.checkout_sales_order_impl(
  uuid,
  uuid,
  text,
  text,
  jsonb,
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
-- 6. PUBLIC SECURITY-INVOKER CHECKOUT WRAPPER
-- =========================================================

create or replace function
public.checkout_sales_order(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_posting_key text,
  p_customer_name text,
  p_items jsonb,

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

  select app_private.checkout_sales_order_impl(
    p_tenant_id,
    p_warehouse_id,
    p_posting_key,
    p_customer_name,
    p_items,

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
public.checkout_sales_order(
  uuid,
  uuid,
  text,
  text,
  jsonb,
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
public.checkout_sales_order(
  uuid,
  uuid,
  text,
  text,
  jsonb,
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
-- 7. COMMENTS
-- =========================================================

comment on function
app_private.post_sales_inventory_issue_impl(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  uuid,
  uuid,
  date,
  timestamptz
) is
  'Internal Sales-only FG issue engine. Enforces sales.execute, released/non-expired Lot rules, balance locking, COGS and inventory ledger posting.';


comment on function
public.checkout_sales_order(
  uuid,
  uuid,
  text,
  text,
  jsonb,
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
  'Atomic controlled Sales checkout. Server validates prices, allocates tracked Finished Goods by FEFO, posts FG issues and COGS, and records Sales ledger data idempotently.';


comment on column
public.sales_orders.request_fingerprint is
  'Server-generated SHA-256 fingerprint of normalized Sales checkout request for posting-key idempotency validation.';


comment on column
public.sales_orders.inventory_movement_group_id is
  'Inventory movement group containing all Finished Goods issue movements created by this Sales checkout.';


-- =========================================================
-- 8. SALES CATALOG EXPIRY HARDENING
-- =========================================================
--
-- Migration 20261102164728 introduced the controlled
-- Sales Catalog.
--
-- Tracked Finished Goods must be both:
--   * released
--   * non-expired as of the catalog date
--
-- This keeps displayed sellable availability aligned with
-- Atomic Sales Checkout rules.

create or replace function app_private.get_sales_catalog_impl(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_price_list_id uuid default null,
  p_as_of date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_site_id uuid;
  v_site_timezone text;
  v_site_today date;

  v_warehouse_code text;
  v_warehouse_name text;

  v_price_list public.sales_price_lists%rowtype;

  v_as_of date;

  v_products jsonb;
begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;


  select
    w.site_id,
    s.timezone,
    w.code,
    w.name
  into
    v_site_id,
    v_site_timezone,
    v_warehouse_code,
    v_warehouse_name
  from public.warehouses w
  join public.sites s
    on s.id = w.site_id
   and s.tenant_id = w.tenant_id
   and s.is_active = true
  where w.id = p_warehouse_id
    and w.tenant_id = p_tenant_id
    and w.warehouse_type = 'FG'
    and w.is_active = true;

  if not found then
    raise exception
      'Active Finished Goods warehouse not found';
  end if;


  v_site_today :=
    (
      now()
      at time zone
      v_site_timezone
    )::date;


  if p_as_of is not null
     and p_as_of <> v_site_today then
    raise exception
      'Operational Sales catalog only supports the current site-local date';
  end if;


  v_as_of :=
    v_site_today;


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

            and (
              il.expires_at is null
              or il.expires_at >= v_as_of
            )
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


comment on function
app_private.get_sales_catalog_impl(
  uuid,
  uuid,
  uuid,
  date
) is
  'Controlled Sales catalog implementation. Tracked Finished Goods availability includes only released and non-expired Lot/Batch stock.';



-- Public catalog wrapper is reasserted with NULL default so
-- omitted p_as_of resolves from the authorized Site timezone
-- inside the private implementation.

create or replace function public.get_sales_catalog(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_price_list_id uuid default null,
  p_as_of date default null
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


comment on function public.get_sales_catalog(
  uuid,
  uuid,
  uuid,
  date
) is
  'Operational controlled Sales catalog. Uses the current authorized Site-local date and released non-expired Finished Goods stock.';
