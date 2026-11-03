-- =========================================================
-- MAVORA ERP
-- Controlled Sales Return / Credit Note
--
-- Phase 2P-6N-5
--
-- Security / accounting boundaries:
--   * sales.return is the only Sales-return authority
--   * no generic inventory.post capability required
--   * returned stock enters QUARANTINE only
--   * original Sales allocation / Lot / Batch is preserved
--   * return cost comes from original Sales allocation unit_cost
--   * cumulative returns cannot exceed original sold quantity
--   * posting-key + SHA-256 request fingerprint idempotency
--   * customer-facing result does not expose COGS
--   * cash / AR refund settlement is intentionally out of scope
-- =========================================================


-- =========================================================
-- 1. RETURN / CREDIT NOTE HEADER
-- =========================================================

create table public.sales_returns (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete restrict,

  sales_order_id uuid not null,

  site_id uuid not null,

  quarantine_warehouse_id uuid not null,

  credit_note_no text not null,

  posting_key text not null,

  request_fingerprint text not null,

  inventory_movement_group_id uuid not null
    default gen_random_uuid(),

  status text not null default 'posted',

  reason text,

  subtotal_credit numeric(20,6)
    not null default 0,

  discount_credit numeric(20,6)
    not null default 0,

  tax_credit numeric(20,6)
    not null default 0,

  grand_total_credit numeric(20,6)
    not null default 0,

  -- Internal accounting trace only.
  -- Never expose through customer-facing Credit Note RPC/UI.
  cogs_reversal_total numeric(20,6),

  returned_at timestamptz
    not null default now(),

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz
    not null default now(),

  constraint sales_returns_credit_note_not_blank
    check (
      length(btrim(credit_note_no)) > 0
    ),

  constraint sales_returns_posting_key_check
    check (
      length(btrim(posting_key))
        between 1 and 120
    ),

  constraint sales_returns_fingerprint_check
    check (
      length(request_fingerprint) = 64
    ),

  constraint sales_returns_status_check
    check (
      status in (
        'posted',
        'cancelled'
      )
    ),

  constraint sales_returns_reason_check
    check (
      reason is null
      or (
        length(btrim(reason)) > 0
        and length(reason) <= 500
      )
    ),

  constraint sales_returns_amounts_check
    check (
      subtotal_credit >= 0
      and discount_credit >= 0
      and tax_credit >= 0
      and grand_total_credit >= 0
      and (
        cogs_reversal_total is null
        or cogs_reversal_total >= 0
      )
    ),

  constraint fk_sales_returns_order
    foreign key (
      sales_order_id,
      tenant_id
    )
    references public.sales_orders(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_sales_returns_site
    foreign key (
      site_id,
      tenant_id
    )
    references public.sites(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_sales_returns_quarantine_warehouse
    foreign key (
      quarantine_warehouse_id,
      tenant_id,
      site_id
    )
    references public.warehouses(
      id,
      tenant_id,
      site_id
    )
    on delete restrict,

  constraint sales_returns_tenant_credit_note_key
    unique (
      tenant_id,
      credit_note_no
    ),

  constraint sales_returns_tenant_posting_key_key
    unique (
      tenant_id,
      posting_key
    ),

  constraint sales_returns_id_tenant_key
    unique (
      id,
      tenant_id
    )
);


create index sales_returns_order_idx
on public.sales_returns (
  sales_order_id,
  tenant_id,
  returned_at desc
);


create index sales_returns_site_date_idx
on public.sales_returns (
  site_id,
  tenant_id,
  returned_at desc
);


-- =========================================================
-- 2. RETURN LINES
-- =========================================================

create table public.sales_return_lines (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,

  sales_return_id uuid not null,

  sales_order_line_id uuid not null,

  product_id uuid not null,

  line_no integer not null,

  quantity numeric(20,6) not null,

  unit_price numeric(20,6) not null,

  discount_amount numeric(20,6)
    not null default 0,

  tax_amount numeric(20,6)
    not null default 0,

  line_total numeric(20,6)
    not null default 0,

  -- Internal only.
  cogs_total numeric(20,6),

  reason text,

  created_at timestamptz
    not null default now(),

  constraint sales_return_lines_line_no_check
    check (line_no > 0),

  constraint sales_return_lines_quantity_check
    check (
      quantity > 0
      and quantity
        <= 99999999999999.999999
    ),

  constraint sales_return_lines_unit_price_check
    check (
      unit_price >= 0
      and unit_price
        <= 99999999999999.999999
    ),

  constraint sales_return_lines_amounts_check
    check (
      discount_amount >= 0
      and tax_amount >= 0
      and line_total >= 0
      and (
        cogs_total is null
        or cogs_total >= 0
      )
    ),

  constraint sales_return_lines_reason_check
    check (
      reason is null
      or (
        length(btrim(reason)) > 0
        and length(reason) <= 500
      )
    ),

  constraint fk_sales_return_lines_return
    foreign key (
      sales_return_id,
      tenant_id
    )
    references public.sales_returns(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_sales_return_lines_original_line
    foreign key (
      sales_order_line_id,
      tenant_id
    )
    references public.sales_order_lines(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_sales_return_lines_product
    foreign key (
      product_id,
      tenant_id
    )
    references public.products(
      id,
      tenant_id
    )
    on delete restrict,

  constraint sales_return_lines_return_line_key
    unique (
      sales_return_id,
      line_no
    ),

  constraint sales_return_lines_original_line_key
    unique (
      sales_return_id,
      sales_order_line_id
    ),

  constraint sales_return_lines_id_tenant_key
    unique (
      id,
      tenant_id
    ),

  constraint sales_return_lines_id_tenant_return_key
    unique (
      id,
      tenant_id,
      sales_return_id
    )
);


create index sales_return_lines_original_idx
on public.sales_return_lines (
  sales_order_line_id,
  tenant_id
);


-- Existing Sales allocation IDs are globally unique already.
-- Add composite uniqueness only so Return FKs can also enforce
-- tenant ownership at the SQL boundary.
create unique index if not exists
  sales_inventory_allocations_id_tenant_uidx
on public.sales_inventory_allocations (
  id,
  tenant_id
);


-- =========================================================
-- 3. RETURN ALLOCATION / LOT / MOVEMENT TRACE
-- =========================================================

create table public.sales_return_allocations (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,

  sales_return_id uuid not null,

  sales_return_line_id uuid not null,

  original_sales_inventory_allocation_id uuid
    not null,

  quarantine_warehouse_id uuid not null,

  product_id uuid not null,

  -- Exact original Sales Lot / Batch.
  lot_id uuid,

  -- return_in movement created for this allocation.
  inventory_movement_id uuid not null,

  quantity numeric(20,6) not null,

  -- Exact original Sales allocation cost.
  unit_cost numeric(20,6),

  cogs_amount numeric(20,6),

  reason text,

  created_at timestamptz
    not null default now(),

  constraint sales_return_allocations_quantity_check
    check (
      quantity > 0
      and quantity
        <= 99999999999999.999999
    ),

  constraint sales_return_allocations_cost_check
    check (
      unit_cost is null
      or unit_cost >= 0
    ),

  constraint sales_return_allocations_cogs_check
    check (
      cogs_amount is null
      or cogs_amount >= 0
    ),

  constraint sales_return_allocations_reason_check
    check (
      reason is null
      or (
        length(btrim(reason)) > 0
        and length(reason) <= 500
      )
    ),

  constraint fk_sales_return_allocations_return
    foreign key (
      sales_return_id,
      tenant_id
    )
    references public.sales_returns(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_sales_return_allocations_line
    foreign key (
      sales_return_line_id,
      tenant_id,
      sales_return_id
    )
    references public.sales_return_lines(
      id,
      tenant_id,
      sales_return_id
    )
    on delete restrict,

  constraint fk_sales_return_allocations_original
    foreign key (
      original_sales_inventory_allocation_id,
      tenant_id
    )
    references public.sales_inventory_allocations(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_sales_return_allocations_warehouse
    foreign key (
      quarantine_warehouse_id,
      tenant_id
    )
    references public.warehouses(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_sales_return_allocations_product
    foreign key (
      product_id,
      tenant_id
    )
    references public.products(
      id,
      tenant_id
    )
    on delete restrict,

  constraint fk_sales_return_allocations_lot
    foreign key (
      lot_id,
      tenant_id,
      product_id
    )
    references public.inventory_lots(
      id,
      tenant_id,
      product_id
    )
    on delete restrict,

  constraint fk_sales_return_allocations_movement
    foreign key (
      inventory_movement_id,
      tenant_id
    )
    references public.inventory_movements(
      id,
      tenant_id
    )
    on delete restrict,

  constraint sales_return_allocations_return_original_key
    unique (
      sales_return_id,
      original_sales_inventory_allocation_id
    ),

  constraint sales_return_allocations_id_tenant_key
    unique (
      id,
      tenant_id
    )
);


create index sales_return_allocations_original_idx
on public.sales_return_allocations (
  original_sales_inventory_allocation_id,
  tenant_id
);


create index sales_return_allocations_lot_idx
on public.sales_return_allocations (
  lot_id,
  tenant_id,
  product_id
)
where lot_id is not null;


create index sales_return_allocations_movement_idx
on public.sales_return_allocations (
  inventory_movement_id,
  tenant_id
);


-- =========================================================
-- 4. SALES-RETURN-ONLY INVENTORY ENGINE
-- =========================================================
--
-- Important:
-- Do NOT call the generic Inventory posting implementation here.
-- That implementation requires inventory.post.
--
-- Sales Return must instead be authorized only through sales.return.
--
-- Returned stock is posted only into an active QUARANTINE warehouse.
-- The original Sales Lot / Batch remains unchanged.
-- We do NOT globally change inventory_lots.status, because released
-- stock from the same Lot may still legitimately remain in FG.
-- =========================================================

create or replace function
app_private.post_sales_inventory_return_impl(
  p_tenant_id uuid,
  p_quarantine_warehouse_id uuid,
  p_product_id uuid,
  p_lot_id uuid,
  p_quantity numeric,
  p_unit_cost numeric,
  p_posting_key text,
  p_movement_group_id uuid,
  p_sales_return_id uuid,
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
  v_warehouse_type text;
  v_warehouse_active boolean;

  v_existing_count integer;
  v_existing public.inventory_movements%rowtype;

  v_balance_id uuid;
  v_current_qty numeric(20,6);
  v_current_avg numeric(20,6);
  v_new_qty numeric(20,6);
  v_new_avg numeric(20,6);

  v_movement_id uuid;
begin

  if v_user_id is null then
    raise exception
      'Authentication required';
  end if;


  if p_tenant_id is null then
    raise exception
      'Sales Return tenant is required';
  end if;


  if p_quarantine_warehouse_id is null then
    raise exception
      'Sales Return QUARANTINE warehouse is required';
  end if;


  if p_product_id is null then
    raise exception
      'Sales Return Product is required';
  end if;


  if p_sales_return_id is null then
    raise exception
      'Sales Return reference is required';
  end if;


  if p_movement_group_id is null then
    raise exception
      'Sales Return movement group is required';
  end if;


  if p_quantity is null
     or p_quantity <= 0 then
    raise exception
      'Sales Return quantity must be greater than zero';
  end if;


  if p_quantity <> round(p_quantity, 6) then
    raise exception
      'Sales Return quantity cannot exceed 6 decimal places';
  end if;


  if p_quantity
       > 99999999999999.999999 then
    raise exception
      'Sales Return quantity exceeds supported numeric range';
  end if;


  if p_unit_cost is not null
     and p_unit_cost < 0 then
    raise exception
      'Sales Return unit cost cannot be negative';
  end if;


  if p_unit_cost is not null
     and p_unit_cost <> round(p_unit_cost, 6) then
    raise exception
      'Sales Return unit cost cannot exceed 6 decimal places';
  end if;


  if p_posting_key is null
     or length(btrim(p_posting_key)) = 0 then
    raise exception
      'Sales Return inventory posting key is required';
  end if;


  if length(btrim(p_posting_key)) > 200 then
    raise exception
      'Sales Return inventory posting key cannot exceed 200 characters';
  end if;


  select
    w.site_id,
    w.warehouse_type,
    w.is_active
  into
    v_site_id,
    v_warehouse_type,
    v_warehouse_active
  from public.warehouses w
  where w.id = p_quarantine_warehouse_id
    and w.tenant_id = p_tenant_id;


  if not found then
    raise exception
      'Sales Return QUARANTINE warehouse not found';
  end if;


  if v_warehouse_active is not true then
    raise exception
      'Sales Return QUARANTINE warehouse is inactive';
  end if;


  if v_warehouse_type <> 'QUARANTINE' then
    raise exception
      'Sales Return stock must enter a QUARANTINE warehouse';
  end if;


  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.return',
    v_site_id
  );


  if not app_private.has_warehouse_access(
    p_quarantine_warehouse_id
  ) then
    raise exception
      'Sales Return QUARANTINE warehouse access denied';
  end if;


  -- -------------------------------------------------------
  -- INVENTORY IDEMPOTENCY
  -- -------------------------------------------------------

  select count(*)
  into v_existing_count
  from public.inventory_movements im
  where im.tenant_id = p_tenant_id
    and im.posting_key = btrim(p_posting_key);


  if v_existing_count > 0 then

    if v_existing_count <> 1 then
      raise exception
        'Sales Return inventory posting key is ambiguous';
    end if;


    select im.*
    into v_existing
    from public.inventory_movements im
    where im.tenant_id = p_tenant_id
      and im.posting_key = btrim(p_posting_key)
    limit 1;


    if v_existing.warehouse_id
         is distinct from p_quarantine_warehouse_id
       or v_existing.product_id
         is distinct from p_product_id
       or v_existing.lot_id
         is distinct from p_lot_id
       or v_existing.movement_type
         is distinct from 'return_in'
       or v_existing.quantity
         is distinct from p_quantity
       or v_existing.unit_cost
         is distinct from p_unit_cost
       or v_existing.movement_group_id
         is distinct from p_movement_group_id
       or v_existing.reference_type
         is distinct from 'sales_return'
       or v_existing.reference_id
         is distinct from p_sales_return_id::text then

      raise exception
        'Sales Return inventory posting-key payload mismatch';

    end if;


    return jsonb_build_object(
      'movement_id',
        v_existing.id,
      'movement_group_id',
        v_existing.movement_group_id,
      'quantity',
        v_existing.quantity,
      'unit_cost',
        v_existing.unit_cost,
      'posting_key',
        v_existing.posting_key,
      'already_posted',
        true
    );

  end if;


  -- -------------------------------------------------------
  -- LOCK / CREATE QUARANTINE BALANCE
  -- -------------------------------------------------------

  perform app_private.lock_inventory_balance(
    p_tenant_id,
    p_quarantine_warehouse_id,
    p_product_id,
    p_lot_id
  );


  select
    ib.id,
    ib.quantity,
    ib.average_unit_cost
  into
    v_balance_id,
    v_current_qty,
    v_current_avg
  from public.inventory_balances ib
  where ib.tenant_id = p_tenant_id
    and ib.warehouse_id =
      p_quarantine_warehouse_id
    and ib.product_id = p_product_id
    and ib.lot_id is not distinct from p_lot_id
  for update;


  if not found then
    raise exception
      'Sales Return QUARANTINE balance could not be locked';
  end if;


  v_new_qty :=
    round(
      v_current_qty + p_quantity,
      6
    );


  if p_unit_cost is null then

    v_new_avg := v_current_avg;

  elsif v_current_qty = 0
        or v_current_avg is null then

    v_new_avg :=
      round(p_unit_cost, 6);

  else

    v_new_avg :=
      round(
        (
          (
            v_current_qty
            * v_current_avg
          )
          +
          (
            p_quantity
            * p_unit_cost
          )
        )
        / v_new_qty,
        6
      );

  end if;


  update public.inventory_balances
  set
    quantity = v_new_qty,
    average_unit_cost = v_new_avg
  where id = v_balance_id;


  -- -------------------------------------------------------
  -- APPEND-ONLY RETURN_IN LEDGER
  -- -------------------------------------------------------

  insert into public.inventory_movements (
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
    p_movement_group_id,
    p_tenant_id,
    v_site_id,
    p_quarantine_warehouse_id,
    p_product_id,
    p_lot_id,
    'return_in',
    p_quantity,
    p_unit_cost,
    btrim(p_posting_key),
    'sales_return',
    p_sales_return_id::text,
    'Controlled Sales Return to QUARANTINE',
    coalesce(p_occurred_at, now()),
    v_user_id
  )
  returning id
  into v_movement_id;


  return jsonb_build_object(
    'movement_id',
      v_movement_id,
    'movement_group_id',
      p_movement_group_id,
    'quantity',
      p_quantity,
    'unit_cost',
      p_unit_cost,
    'posting_key',
      btrim(p_posting_key),
    'already_posted',
      false
  );

end;
$function$;


revoke all
on function
app_private.post_sales_inventory_return_impl(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  uuid,
  uuid,
  timestamptz
)
from public, anon, authenticated;


grant execute
on function
app_private.post_sales_inventory_return_impl(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  uuid,
  uuid,
  timestamptz
)
to service_role;


-- =========================================================
-- 5. ATOMIC SALES RETURN IMPLEMENTATION
-- =========================================================
--
-- p_items format:
--
-- [
--   {
--     "sales_inventory_allocation_id": "uuid",
--     "quantity": 2,
--     "reason": "Damaged / Customer Return"
--   }
-- ]
--
-- Using the original Sales allocation as the return source
-- guarantees exact Lot / Batch and original unit-cost trace.
-- =========================================================

create or replace function
app_private.create_sales_return_impl(
  p_tenant_id uuid,
  p_sales_order_id uuid,
  p_quarantine_warehouse_id uuid,
  p_posting_key text,
  p_items jsonb,
  p_reason text default null,
  p_returned_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();

  v_posting_key text;
  v_reason text;
  v_returned_at timestamptz;

  v_item_count integer;
  v_distinct_item_count integer;

  v_items_canonical jsonb;
  v_request_fingerprint text;

  v_order public.sales_orders%rowtype;
  v_existing_return public.sales_returns%rowtype;

  v_quarantine_site_id uuid;
  v_quarantine_type text;
  v_quarantine_active boolean;

  v_return_id uuid := gen_random_uuid();
  v_movement_group_id uuid := gen_random_uuid();
  v_credit_note_no text;

  v_item jsonb;
  v_alloc public.sales_inventory_allocations%rowtype;
  v_sale_line public.sales_order_lines%rowtype;

  v_alloc_id uuid;
  v_alloc_qty numeric(20,6);
  v_alloc_reason text;

  v_prior_alloc_qty numeric(20,6);

  v_line_req record;

  v_prior_line_qty numeric(20,6);
  v_prior_discount numeric(20,6);
  v_prior_tax numeric(20,6);
  v_prior_total numeric(20,6);

  v_remaining_discount numeric(20,6);
  v_remaining_tax numeric(20,6);
  v_remaining_total numeric(20,6);

  v_line_discount numeric(20,6);
  v_line_tax numeric(20,6);
  v_line_total numeric(20,6);

  v_return_line_id uuid;

  v_move_result jsonb;
  v_movement_id uuid;
  v_alloc_cogs numeric(20,6);

  v_subtotal_credit numeric(20,6) := 0;
  v_discount_credit numeric(20,6) := 0;
  v_tax_credit numeric(20,6) := 0;
  v_grand_total_credit numeric(20,6) := 0;
  v_cogs_total numeric(20,6);

  v_sold_qty numeric(20,6);
  v_returned_qty numeric(20,6);
begin

  if v_user_id is null then
    raise exception
      'Authentication required';
  end if;


  if p_tenant_id is null then
    raise exception
      'Sales Return tenant is required';
  end if;


  if p_sales_order_id is null then
    raise exception
      'Original Sales Order is required';
  end if;


  if p_quarantine_warehouse_id is null then
    raise exception
      'QUARANTINE warehouse is required';
  end if;


  v_posting_key :=
    nullif(
      btrim(p_posting_key),
      ''
    );


  if v_posting_key is null then
    raise exception
      'Sales Return posting key is required';
  end if;


  if length(v_posting_key) > 120 then
    raise exception
      'Sales Return posting key cannot exceed 120 characters';
  end if;


  v_reason :=
    nullif(
      btrim(p_reason),
      ''
    );


  if v_reason is not null
     and length(v_reason) > 500 then
    raise exception
      'Sales Return reason cannot exceed 500 characters';
  end if;


  v_returned_at :=
    coalesce(
      p_returned_at,
      now()
    );


  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception
      'Sales Return requires at least one returned allocation';
  end if;


  -- -------------------------------------------------------
  -- VALIDATE BASIC CLIENT ITEM SHAPE
  -- -------------------------------------------------------

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop

    if jsonb_typeof(v_item) <> 'object' then
      raise exception
        'Each Sales Return item must be an object';
    end if;


    if nullif(
         btrim(
           v_item
             ->> 'sales_inventory_allocation_id'
         ),
         ''
       ) is null then
      raise exception
        'Sales Return allocation ID is required';
    end if;


    v_alloc_id :=
      (
        v_item
          ->> 'sales_inventory_allocation_id'
      )::uuid;


    if nullif(
         btrim(
           v_item ->> 'quantity'
         ),
         ''
       ) is null then
      raise exception
        'Sales Return allocation quantity is required';
    end if;


    v_alloc_qty :=
      (
        v_item
          ->> 'quantity'
      )::numeric;


    if v_alloc_qty <= 0 then
      raise exception
        'Sales Return allocation quantity must be greater than zero';
    end if;


    if v_alloc_qty
         <> round(v_alloc_qty, 6) then
      raise exception
        'Sales Return allocation quantity cannot exceed 6 decimal places';
    end if;


    if v_alloc_qty
         > 99999999999999.999999 then
      raise exception
        'Sales Return allocation quantity exceeds supported range';
    end if;


    v_alloc_reason :=
      nullif(
        btrim(
          v_item ->> 'reason'
        ),
        ''
      );


    if v_alloc_reason is not null
       and length(v_alloc_reason) > 500 then
      raise exception
        'Sales Return item reason cannot exceed 500 characters';
    end if;

  end loop;


  select
    count(*),
    count(
      distinct
      (
        e
          ->> 'sales_inventory_allocation_id'
      )::uuid
    )
  into
    v_item_count,
    v_distinct_item_count
  from jsonb_array_elements(p_items) e;


  if v_item_count
       <> v_distinct_item_count then
    raise exception
      'Duplicate Sales allocation rows are not allowed in one return';
  end if;


  -- Canonical order makes request fingerprint stable.
  select jsonb_agg(
    jsonb_build_object(
      'sales_inventory_allocation_id',
        (
          e
            ->> 'sales_inventory_allocation_id'
        )::uuid,

      'quantity',
        round(
          (
            e ->> 'quantity'
          )::numeric,
          6
        ),

      'reason',
        nullif(
          btrim(
            e ->> 'reason'
          ),
          ''
        )
    )
    order by
      (
        e
          ->> 'sales_inventory_allocation_id'
      )::uuid
  )
  into v_items_canonical
  from jsonb_array_elements(p_items) e;


  -- Fingerprint only the client request.
  -- Server-generated CRN and timestamps are excluded.
  v_request_fingerprint :=
    encode(
      extensions.digest(
        jsonb_build_object(
          'tenant_id',
            p_tenant_id,

          'sales_order_id',
            p_sales_order_id,

          'quarantine_warehouse_id',
            p_quarantine_warehouse_id,

          'reason',
            v_reason,

          'items',
            v_items_canonical
        )::text,
        'sha256'
      ),
      'hex'
    );


  -- Serialize retry requests sharing one posting key.
  perform pg_advisory_xact_lock(
    hashtextextended(
      'sales-return|'
      || p_tenant_id::text
      || '|'
      || v_posting_key,
      0
    )
  );


  -- Lock original invoice/order so concurrent returns cannot
  -- collectively exceed the sold quantity.
  select so.*
  into v_order
  from public.sales_orders so
  where so.id = p_sales_order_id
    and so.tenant_id = p_tenant_id
  for update;


  if not found then
    raise exception
      'Original Sales Order not found';
  end if;


  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.return',
    v_order.site_id
  );


  select
    w.site_id,
    w.warehouse_type,
    w.is_active
  into
    v_quarantine_site_id,
    v_quarantine_type,
    v_quarantine_active
  from public.warehouses w
  where w.id = p_quarantine_warehouse_id
    and w.tenant_id = p_tenant_id;


  if not found then
    raise exception
      'Sales Return QUARANTINE warehouse not found';
  end if;


  if v_quarantine_site_id
       is distinct from v_order.site_id then
    raise exception
      'Sales Return QUARANTINE warehouse must belong to the original Sales site';
  end if;


  if v_quarantine_type <> 'QUARANTINE'
     or v_quarantine_active is not true then
    raise exception
      'Sales Return requires an active QUARANTINE warehouse';
  end if;


  if not app_private.has_warehouse_access(
    p_quarantine_warehouse_id
  ) then
    raise exception
      'Sales Return QUARANTINE warehouse access denied';
  end if;


  -- -------------------------------------------------------
  -- ORDER-LEVEL IDEMPOTENCY
  -- -------------------------------------------------------

  select sr.*
  into v_existing_return
  from public.sales_returns sr
  where sr.tenant_id = p_tenant_id
    and sr.posting_key = v_posting_key
  limit 1;


  if found then

    if v_existing_return.request_fingerprint
         is distinct from v_request_fingerprint then
      raise exception
        'Sales Return posting-key request fingerprint mismatch';
    end if;


    return jsonb_build_object(
      'sales_return_id',
        v_existing_return.id,

      'credit_note_no',
        v_existing_return.credit_note_no,

      'sales_order_id',
        v_existing_return.sales_order_id,

      'status',
        v_existing_return.status,

      'subtotal_credit',
        v_existing_return.subtotal_credit,

      'discount_credit',
        v_existing_return.discount_credit,

      'tax_credit',
        v_existing_return.tax_credit,

      'grand_total_credit',
        v_existing_return.grand_total_credit,

      'returned_at',
        v_existing_return.returned_at,

      'already_posted',
        true
    );

  end if;


  if v_order.status not in (
    'posted',
    'partially_returned'
  ) then
    raise exception
      'Only Posted or Partially Returned Sales Orders can be returned';
  end if;


  if v_returned_at < v_order.sold_at then
    raise exception
      'Sales Return timestamp cannot be before the original Sale';
  end if;


  -- -------------------------------------------------------
  -- VALIDATE EACH ORIGINAL SALES ALLOCATION
  -- -------------------------------------------------------

  for v_item in
    select value
    from jsonb_array_elements(v_items_canonical)
  loop

    v_alloc_id :=
      (
        v_item
          ->> 'sales_inventory_allocation_id'
      )::uuid;

    v_alloc_qty :=
      (
        v_item
          ->> 'quantity'
      )::numeric;


    select sia.*
    into v_alloc
    from public.sales_inventory_allocations sia
    where sia.id = v_alloc_id
      and sia.tenant_id = p_tenant_id
    for update;


    if not found then
      raise exception
        'Original Sales allocation % not found',
        v_alloc_id;
    end if;


    if v_alloc.sales_order_id
         is distinct from p_sales_order_id then
      raise exception
        'Sales allocation % does not belong to the selected Invoice',
        v_alloc_id;
    end if;


    if v_alloc.inventory_movement_id is null then
      raise exception
        'Original Sales allocation % has no Inventory issue trace',
        v_alloc_id;
    end if;


    if not exists (
      select 1
      from public.inventory_movements im
      where im.id =
        v_alloc.inventory_movement_id
        and im.tenant_id =
          p_tenant_id
        and im.warehouse_id =
          v_alloc.warehouse_id
        and im.product_id =
          v_alloc.product_id
        and im.lot_id
          is not distinct from
            v_alloc.lot_id
        and im.movement_type = 'issue'
        and im.quantity < 0
    ) then
      raise exception
        'Original Sales allocation % Inventory issue trace is invalid',
        v_alloc_id;
    end if;


    select coalesce(
      sum(sra.quantity),
      0
    )
    into v_prior_alloc_qty
    from public.sales_return_allocations sra
    join public.sales_returns sr
      on sr.id =
        sra.sales_return_id
     and sr.tenant_id =
        sra.tenant_id
    where
      sra.tenant_id =
        p_tenant_id
      and
      sra.original_sales_inventory_allocation_id =
        v_alloc.id
      and sr.status = 'posted';


    if v_prior_alloc_qty
         + v_alloc_qty
         > v_alloc.quantity then
      raise exception
        'Sales Return quantity exceeds remaining sold allocation quantity for allocation %',
        v_alloc.id;
    end if;

  end loop;


  -- -------------------------------------------------------
  -- CREATE CREDIT NOTE HEADER
  -- -------------------------------------------------------

  v_credit_note_no :=
    'CRN-'
    || to_char(
         v_returned_at,
         'YYYYMMDD'
       )
    || '-'
    || upper(
         substr(
           replace(
             gen_random_uuid()::text,
             '-',
             ''
           ),
           1,
           10
         )
       );


  insert into public.sales_returns (
    id,
    tenant_id,
    sales_order_id,
    site_id,
    quarantine_warehouse_id,
    credit_note_no,
    posting_key,
    request_fingerprint,
    inventory_movement_group_id,
    status,
    reason,
    returned_at,
    created_by
  )
  values (
    v_return_id,
    p_tenant_id,
    p_sales_order_id,
    v_order.site_id,
    p_quarantine_warehouse_id,
    v_credit_note_no,
    v_posting_key,
    v_request_fingerprint,
    v_movement_group_id,
    'posted',
    v_reason,
    v_returned_at,
    v_user_id
  );


  -- -------------------------------------------------------
  -- CREATE RETURN LINES
  -- -------------------------------------------------------

  for v_line_req in

    with requested as (
      select
        (
          e
            ->> 'sales_inventory_allocation_id'
        )::uuid
          as allocation_id,

        (
          e ->> 'quantity'
        )::numeric
          as quantity

      from jsonb_array_elements(
        v_items_canonical
      ) e
    )

    select
      sia.sales_order_line_id,
      sum(r.quantity)::numeric(20,6)
        as quantity

    from requested r

    join public.sales_inventory_allocations sia
      on sia.id = r.allocation_id
     and sia.tenant_id = p_tenant_id

    group by
      sia.sales_order_line_id

    order by
      sia.sales_order_line_id

  loop

    select sol.*
    into v_sale_line
    from public.sales_order_lines sol
    where sol.id =
      v_line_req.sales_order_line_id
      and sol.tenant_id =
        p_tenant_id
      and sol.sales_order_id =
        p_sales_order_id
    for update;


    if not found then
      raise exception
        'Original Sales line not found';
    end if;


    select
      coalesce(
        sum(srl.quantity),
        0
      ),
      coalesce(
        sum(srl.discount_amount),
        0
      ),
      coalesce(
        sum(srl.tax_amount),
        0
      ),
      coalesce(
        sum(srl.line_total),
        0
      )
    into
      v_prior_line_qty,
      v_prior_discount,
      v_prior_tax,
      v_prior_total
    from public.sales_return_lines srl
    join public.sales_returns sr
      on sr.id =
        srl.sales_return_id
     and sr.tenant_id =
        srl.tenant_id
    where
      srl.tenant_id =
        p_tenant_id
      and
      srl.sales_order_line_id =
        v_sale_line.id
      and sr.status = 'posted';


    if v_prior_line_qty
         + v_line_req.quantity
         > v_sale_line.quantity then
      raise exception
        'Cumulative Sales Return quantity exceeds original Sales line %',
        v_sale_line.line_no;
    end if;


    v_remaining_discount :=
      greatest(
        v_sale_line.discount_amount
          - v_prior_discount,
        0
      );

    v_remaining_tax :=
      greatest(
        v_sale_line.tax_amount
          - v_prior_tax,
        0
      );

    v_remaining_total :=
      greatest(
        v_sale_line.line_total
          - v_prior_total,
        0
      );


    -- Final return consumes the exact remaining monetary
    -- values so cumulative Credit Notes reconcile exactly
    -- to the original invoice.
    if v_prior_line_qty
         + v_line_req.quantity
         = v_sale_line.quantity then

      v_line_discount :=
        v_remaining_discount;

      v_line_tax :=
        v_remaining_tax;

      v_line_total :=
        v_remaining_total;

    else

      v_line_discount :=
        least(
          v_remaining_discount,
          round(
            v_sale_line.discount_amount
            * v_line_req.quantity
            / v_sale_line.quantity,
            6
          )
        );

      v_line_tax :=
        least(
          v_remaining_tax,
          round(
            v_sale_line.tax_amount
            * v_line_req.quantity
            / v_sale_line.quantity,
            6
          )
        );

      v_line_total :=
        least(
          v_remaining_total,
          round(
            v_sale_line.line_total
            * v_line_req.quantity
            / v_sale_line.quantity,
            6
          )
        );

    end if;


    insert into public.sales_return_lines (
      tenant_id,
      sales_return_id,
      sales_order_line_id,
      product_id,
      line_no,
      quantity,
      unit_price,
      discount_amount,
      tax_amount,
      line_total,
      cogs_total,
      reason
    )
    values (
      p_tenant_id,
      v_return_id,
      v_sale_line.id,
      v_sale_line.product_id,
      v_sale_line.line_no,
      v_line_req.quantity,
      v_sale_line.unit_price,
      v_line_discount,
      v_line_tax,
      v_line_total,
      null,
      v_reason
    );


    v_subtotal_credit :=
      round(
        v_subtotal_credit
        +
        (
          v_sale_line.unit_price
          * v_line_req.quantity
        ),
        6
      );

    v_discount_credit :=
      round(
        v_discount_credit
        + v_line_discount,
        6
      );

    v_tax_credit :=
      round(
        v_tax_credit
        + v_line_tax,
        6
      );

    v_grand_total_credit :=
      round(
        v_grand_total_credit
        + v_line_total,
        6
      );

  end loop;


  -- -------------------------------------------------------
  -- POST RETURN_IN + CREATE ALLOCATION TRACE
  -- -------------------------------------------------------

  for v_item in
    select value
    from jsonb_array_elements(v_items_canonical)
  loop

    v_alloc_id :=
      (
        v_item
          ->> 'sales_inventory_allocation_id'
      )::uuid;

    v_alloc_qty :=
      (
        v_item
          ->> 'quantity'
      )::numeric;

    v_alloc_reason :=
      coalesce(
        nullif(
          btrim(
            v_item ->> 'reason'
          ),
          ''
        ),
        v_reason
      );


    select sia.*
    into v_alloc
    from public.sales_inventory_allocations sia
    where sia.id = v_alloc_id
      and sia.tenant_id = p_tenant_id;


    select srl.id
    into v_return_line_id
    from public.sales_return_lines srl
    where srl.sales_return_id =
      v_return_id
      and srl.tenant_id =
        p_tenant_id
      and srl.sales_order_line_id =
        v_alloc.sales_order_line_id;


    if v_return_line_id is null then
      raise exception
        'Sales Return line trace could not be resolved';
    end if;


    v_move_result :=
      app_private.post_sales_inventory_return_impl(
        p_tenant_id,
        p_quarantine_warehouse_id,
        v_alloc.product_id,
        v_alloc.lot_id,
        v_alloc_qty,
        v_alloc.unit_cost,

        v_posting_key
          || ':ret:'
          || replace(
               v_alloc.id::text,
               '-',
               ''
             ),

        v_movement_group_id,
        v_return_id,
        v_returned_at
      );


    v_movement_id :=
      nullif(
        v_move_result
          ->> 'movement_id',
        ''
      )::uuid;


    if v_movement_id is null then
      raise exception
        'Sales Return inventory movement was not created';
    end if;


    if v_alloc.unit_cost is null then

      v_alloc_cogs := null;

    else

      v_alloc_cogs :=
        round(
          v_alloc_qty
          * v_alloc.unit_cost,
          6
        );

    end if;


    insert into public.sales_return_allocations (
      tenant_id,
      sales_return_id,
      sales_return_line_id,
      original_sales_inventory_allocation_id,
      quarantine_warehouse_id,
      product_id,
      lot_id,
      inventory_movement_id,
      quantity,
      unit_cost,
      cogs_amount,
      reason
    )
    values (
      p_tenant_id,
      v_return_id,
      v_return_line_id,
      v_alloc.id,
      p_quarantine_warehouse_id,
      v_alloc.product_id,
      v_alloc.lot_id,
      v_movement_id,
      v_alloc_qty,
      v_alloc.unit_cost,
      v_alloc_cogs,
      v_alloc_reason
    );

  end loop;


  -- -------------------------------------------------------
  -- INTERNAL COGS REVERSAL TRACE
  -- -------------------------------------------------------

  update public.sales_return_lines srl
  set cogs_total = x.cogs_total
  from (
    select
      sra.sales_return_line_id,

      case
        when count(*)
             = count(sra.unit_cost)
        then round(
          sum(sra.cogs_amount),
          6
        )
        else null
      end
        as cogs_total

    from public.sales_return_allocations sra
    where sra.sales_return_id =
      v_return_id
      and sra.tenant_id =
        p_tenant_id

    group by
      sra.sales_return_line_id
  ) x
  where srl.id =
    x.sales_return_line_id
    and srl.sales_return_id =
      v_return_id
    and srl.tenant_id =
      p_tenant_id;


  select
    case
      when count(*)
           = count(srl.cogs_total)
      then round(
        sum(srl.cogs_total),
        6
      )
      else null
    end
  into v_cogs_total
  from public.sales_return_lines srl
  where srl.sales_return_id =
    v_return_id
    and srl.tenant_id =
      p_tenant_id;


  update public.sales_returns
  set
    subtotal_credit =
      v_subtotal_credit,

    discount_credit =
      v_discount_credit,

    tax_credit =
      v_tax_credit,

    grand_total_credit =
      v_grand_total_credit,

    cogs_reversal_total =
      v_cogs_total

  where id = v_return_id
    and tenant_id = p_tenant_id;


  -- -------------------------------------------------------
  -- UPDATE ORIGINAL SALES ORDER RETURN STATUS
  -- -------------------------------------------------------

  select coalesce(
    sum(sol.quantity),
    0
  )
  into v_sold_qty
  from public.sales_order_lines sol
  where sol.sales_order_id =
    p_sales_order_id
    and sol.tenant_id =
      p_tenant_id;


  select coalesce(
    sum(srl.quantity),
    0
  )
  into v_returned_qty
  from public.sales_return_lines srl
  join public.sales_returns sr
    on sr.id =
      srl.sales_return_id
   and sr.tenant_id =
      srl.tenant_id
  where sr.sales_order_id =
    p_sales_order_id
    and sr.tenant_id =
      p_tenant_id
    and sr.status = 'posted';


  update public.sales_orders
  set
    status =
      case
        when v_returned_qty >= v_sold_qty
          then 'returned'

        when v_returned_qty > 0
          then 'partially_returned'

        else 'posted'
      end,

    updated_at = now()

  where id = p_sales_order_id
    and tenant_id = p_tenant_id;


  -- Customer-facing result intentionally excludes COGS.
  return jsonb_build_object(
    'sales_return_id',
      v_return_id,

    'credit_note_no',
      v_credit_note_no,

    'sales_order_id',
      p_sales_order_id,

    'original_invoice_no',
      v_order.invoice_no,

    'status',
      'posted',

    'quarantine_warehouse_id',
      p_quarantine_warehouse_id,

    'subtotal_credit',
      v_subtotal_credit,

    'discount_credit',
      v_discount_credit,

    'tax_credit',
      v_tax_credit,

    'grand_total_credit',
      v_grand_total_credit,

    'returned_at',
      v_returned_at,

    'already_posted',
      false
  );

end;
$function$;


revoke all
on function
app_private.create_sales_return_impl(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  text,
  timestamptz
)
from public, anon;


grant execute
on function
app_private.create_sales_return_impl(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  text,
  timestamptz
)
to authenticated, service_role;


-- =========================================================
-- 6. PUBLIC SALES RETURN RPC
-- =========================================================

create or replace function
public.create_sales_return(
  p_tenant_id uuid,
  p_sales_order_id uuid,
  p_quarantine_warehouse_id uuid,
  p_posting_key text,
  p_items jsonb,
  p_reason text default null,
  p_returned_at timestamptz default null
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$

  select app_private.create_sales_return_impl(
    p_tenant_id,
    p_sales_order_id,
    p_quarantine_warehouse_id,
    p_posting_key,
    p_items,
    p_reason,
    p_returned_at
  );

$function$;


revoke all
on function
public.create_sales_return(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  text,
  timestamptz
)
from public, anon;


grant execute
on function
public.create_sales_return(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  text,
  timestamptz
)
to authenticated, service_role;


-- =========================================================
-- 7. RLS / SQL PRIVILEGE BOUNDARY
-- =========================================================

alter table public.sales_returns
  enable row level security;

alter table public.sales_return_lines
  enable row level security;

alter table public.sales_return_allocations
  enable row level security;


-- No authenticated direct table mutation.
-- Operational access will use controlled RPCs.
revoke all privileges
on table
  public.sales_returns,
  public.sales_return_lines,
  public.sales_return_allocations
from public, anon, authenticated;


grant select, insert, update, delete
on table
  public.sales_returns,
  public.sales_return_lines,
  public.sales_return_allocations
to service_role;


-- =========================================================
-- 8. DOCUMENTATION
-- =========================================================

comment on table public.sales_returns is
  'Controlled Sales Return / Credit Note header. Posting-key idempotent, Sales-authorized and linked to QUARANTINE inventory return movements.';


comment on table public.sales_return_lines is
  'Customer credit lines linked to the original Sales Order lines. Cumulative returned quantity cannot exceed original sold quantity.';


comment on table public.sales_return_allocations is
  'Immutable Sales Return allocation trace preserving the exact original Sales inventory allocation, Lot/Batch, unit cost and QUARANTINE return_in movement.';


comment on function
app_private.post_sales_inventory_return_impl(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  uuid,
  uuid,
  timestamptz
) is
  'Internal Sales-return-only inventory engine. Requires sales.return, posts positive return_in only to an active QUARANTINE warehouse, preserves original Lot/Batch and does not require generic inventory.post.';


comment on function
public.create_sales_return(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  text,
  timestamptz
) is
  'Atomic controlled Sales Return / Credit Note RPC. Enforces sales.return, posting-key request fingerprint idempotency, cumulative return caps, original allocation/Lot/cost trace and QUARANTINE-only return_in inventory posting. Refund settlement is intentionally out of scope.';


comment on column
public.sales_returns.request_fingerprint is
  'Server-generated SHA-256 fingerprint of the normalized Sales Return client request for posting-key idempotency validation.';


comment on column
public.sales_returns.cogs_reversal_total is
  'Internal original-cost reversal trace. Must not be exposed on customer-facing Credit Notes.';


comment on column
public.sales_return_allocations.unit_cost is
  'Original Sales inventory allocation unit cost carried into the QUARANTINE return movement.';


-- =========================================================
-- END
-- =========================================================
