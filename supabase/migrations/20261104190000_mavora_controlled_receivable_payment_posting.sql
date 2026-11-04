-- ============================================================
-- MAVORA ERP
-- CONTROLLED ATOMIC RECEIVABLE PAYMENT POSTING
--
-- Security:
--   * authenticated user required
--   * sales.payment_post capability required
--   * tenant/site scoped
--   * direct AR table mutation remains revoked
--
-- Accounting:
--   * payment must allocate 100% of receipt amount
--   * no overpayment
--   * no unallocated advance
--   * no negative payment
--   * only CREDIT Sales invoices are eligible
--
-- Outstanding remains derived:
--
--   CREDIT invoice grand_total
--   - posted Credit Notes / Returns
--   - posted Payment Allocations
--
-- Concurrency:
--   * posting-key advisory lock
--   * Sales Order row locks
--   * canonical invoice ordering
--
-- Retry:
--   * posting_key + SHA-256 request fingerprint
-- ============================================================


-- ============================================================
-- 1. PRIVATE CONTROLLED IMPLEMENTATION
-- ============================================================

create or replace function
app_private.post_receivable_payment_impl(
  p_tenant_id uuid,
  p_site_id uuid,
  p_customer_id uuid,
  p_posting_key text,
  p_payment_method text,
  p_amount numeric,
  p_allocations jsonb,
  p_reference_no text default null,
  p_note text default null,
  p_received_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$

declare
  v_user_id uuid :=
    auth.uid();

  v_posting_key text;

  v_payment_method text;

  v_reference_no text;

  v_note text;

  v_amount numeric(20,6);

  v_received_at timestamptz;

  v_customer
    public.sales_customers%rowtype;

  v_order
    public.sales_orders%rowtype;

  v_existing_payment
    public.sales_receivable_payments%rowtype;

  v_payment_id uuid :=
    gen_random_uuid();

  v_receipt_no text;

  v_allocations_canonical jsonb;

  v_request_fingerprint text;

  v_item jsonb;

  v_sales_order_id uuid;

  v_allocated_amount numeric(20,6);

  v_allocation_count integer;

  v_distinct_invoice_count integer;

  v_allocation_total numeric(20,6);

  v_credit_total numeric(20,6);

  v_prior_payment_total numeric(20,6);

  v_outstanding numeric(20,6);

  v_allocation_results jsonb :=
    '[]'::jsonb;

begin

  -- ---------------------------------------------------------
  -- AUTH / REQUIRED INPUTS
  -- ---------------------------------------------------------

  if v_user_id is null then
    raise exception
      'Authentication required';
  end if;


  if p_tenant_id is null then
    raise exception
      'Receivable Payment tenant is required';
  end if;


  if p_site_id is null then
    raise exception
      'Receivable Payment site is required';
  end if;


  if p_customer_id is null then
    raise exception
      'Receivable Payment customer is required';
  end if;


  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.payment_post',
    p_site_id
  );


  -- ---------------------------------------------------------
  -- NORMALIZE HEADER
  -- ---------------------------------------------------------

  v_posting_key :=
    nullif(
      btrim(p_posting_key),
      ''
    );


  if v_posting_key is null then
    raise exception
      'Receivable Payment posting key is required';
  end if;


  if length(v_posting_key) > 120 then
    raise exception
      'Receivable Payment posting key cannot exceed 120 characters';
  end if;


  v_payment_method :=
    upper(
      coalesce(
        nullif(
          btrim(p_payment_method),
          ''
        ),
        ''
      )
    );


  if v_payment_method not in (
    'CASH',
    'BANK',
    'MOBILE',
    'CHEQUE',
    'OTHER'
  ) then
    raise exception
      'Unsupported Receivable Payment method';
  end if;


  if p_amount is null
     or p_amount <= 0 then
    raise exception
      'Receivable Payment amount must be greater than zero';
  end if;


  if p_amount
       <> round(
            p_amount,
            6
          ) then
    raise exception
      'Receivable Payment amount cannot exceed 6 decimal places';
  end if;


  if p_amount
       > 99999999999999.999999 then
    raise exception
      'Receivable Payment amount exceeds supported range';
  end if;


  v_amount :=
    round(
      p_amount,
      6
    );


  v_reference_no :=
    nullif(
      btrim(p_reference_no),
      ''
    );


  if v_reference_no is not null
     and length(v_reference_no) > 255 then
    raise exception
      'Payment reference cannot exceed 255 characters';
  end if;


  v_note :=
    nullif(
      btrim(p_note),
      ''
    );


  if v_note is not null
     and length(v_note) > 1000 then
    raise exception
      'Payment note cannot exceed 1000 characters';
  end if;


  v_received_at :=
    coalesce(
      p_received_at,
      now()
    );


  -- ---------------------------------------------------------
  -- ALLOCATION REQUEST SHAPE
  -- ---------------------------------------------------------

  if p_allocations is null
     or jsonb_typeof(p_allocations)
          <> 'array'
     or jsonb_array_length(
          p_allocations
        ) = 0 then
    raise exception
      'Receivable Payment requires at least one invoice allocation';
  end if;


  for v_item in
    select value
    from jsonb_array_elements(
      p_allocations
    )
  loop

    if jsonb_typeof(v_item)
         <> 'object' then
      raise exception
        'Each Receivable Payment allocation must be an object';
    end if;


    if nullif(
         btrim(
           v_item
             ->> 'sales_order_id'
         ),
         ''
       ) is null then
      raise exception
        'Allocation Sales Order ID is required';
    end if;


    v_sales_order_id :=
      (
        v_item
          ->> 'sales_order_id'
      )::uuid;


    if nullif(
         btrim(
           v_item
             ->> 'allocated_amount'
         ),
         ''
       ) is null then
      raise exception
        'Allocation amount is required';
    end if;


    v_allocated_amount :=
      (
        v_item
          ->> 'allocated_amount'
      )::numeric;


    if v_allocated_amount <= 0 then
      raise exception
        'Allocation amount must be greater than zero';
    end if;


    if v_allocated_amount
         <> round(
              v_allocated_amount,
              6
            ) then
      raise exception
        'Allocation amount cannot exceed 6 decimal places';
    end if;


    if v_allocated_amount
         > 99999999999999.999999 then
      raise exception
        'Allocation amount exceeds supported range';
    end if;

  end loop;


  select
    count(*),

    count(
      distinct
      (
        e
          ->> 'sales_order_id'
      )::uuid
    )

  into
    v_allocation_count,
    v_distinct_invoice_count

  from jsonb_array_elements(
    p_allocations
  ) e;


  if v_allocation_count
       <> v_distinct_invoice_count then
    raise exception
      'Duplicate invoice allocations are not allowed in one payment';
  end if;


  -- Canonical ordering is critical both for deterministic
  -- fingerprinting and for consistent invoice lock order.

  select jsonb_agg(
    jsonb_build_object(
      'sales_order_id',
        (
          e
            ->> 'sales_order_id'
        )::uuid,

      'allocated_amount',
        round(
          (
            e
              ->> 'allocated_amount'
          )::numeric,
          6
        )
    )
    order by
      (
        e
          ->> 'sales_order_id'
      )::uuid
  )
  into v_allocations_canonical
  from jsonb_array_elements(
    p_allocations
  ) e;


  select
    round(
      coalesce(
        sum(
          (
            e
              ->> 'allocated_amount'
          )::numeric
        ),
        0
      ),
      6
    )
  into v_allocation_total
  from jsonb_array_elements(
    v_allocations_canonical
  ) e;


  if v_allocation_total
       <> v_amount then
    raise exception
      'Payment amount must equal the total invoice allocation amount';
  end if;


  -- ---------------------------------------------------------
  -- REQUEST FINGERPRINT
  --
  -- If p_received_at is NULL, the server-generated now()
  -- timestamp is intentionally excluded from retry identity.
  -- ---------------------------------------------------------

  v_request_fingerprint :=
    encode(
      extensions.digest(
        jsonb_build_object(
          'tenant_id',
            p_tenant_id,

          'site_id',
            p_site_id,

          'customer_id',
            p_customer_id,

          'payment_method',
            v_payment_method,

          'amount',
            v_amount,

          'allocations',
            v_allocations_canonical,

          'reference_no',
            v_reference_no,

          'note',
            v_note,

          'received_at',
            p_received_at
        )::text,
        'sha256'
      ),
      'hex'
    );


  -- ---------------------------------------------------------
  -- IDEMPOTENCY SERIALIZATION
  -- ---------------------------------------------------------

  perform pg_advisory_xact_lock(
    hashtextextended(
      'receivable-payment|'
      || p_tenant_id::text
      || '|'
      || v_posting_key,
      0
    )
  );


  select rp.*
  into v_existing_payment
  from public.sales_receivable_payments rp
  where rp.tenant_id =
        p_tenant_id
    and rp.posting_key =
        v_posting_key
  limit 1;


  if found then

    if v_existing_payment.request_fingerprint
         is distinct from
            v_request_fingerprint then
      raise exception
        'Receivable Payment posting-key request fingerprint mismatch';
    end if;


    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'sales_order_id',
              ra.sales_order_id,

            'allocated_amount',
              ra.allocated_amount
          )
          order by
            ra.sales_order_id
        ),
        '[]'::jsonb
      )

    into v_allocation_results

    from public.sales_receivable_allocations ra

    where ra.tenant_id =
          p_tenant_id
      and ra.payment_id =
          v_existing_payment.id;


    return jsonb_build_object(
      'payment_id',
        v_existing_payment.id,

      'receipt_no',
        v_existing_payment.receipt_no,

      'customer_id',
        v_existing_payment.customer_id,

      'customer_code',
        v_existing_payment.customer_code_snapshot,

      'customer_name',
        v_existing_payment.customer_name_snapshot,

      'site_id',
        v_existing_payment.site_id,

      'payment_method',
        v_existing_payment.payment_method,

      'amount',
        v_existing_payment.amount,

      'reference_no',
        v_existing_payment.reference_no,

      'note',
        v_existing_payment.note,

      'received_at',
        v_existing_payment.received_at,

      'allocations',
        v_allocation_results,

      'already_posted',
        true
    );

  end if;


  -- ---------------------------------------------------------
  -- CUSTOMER
  --
  -- Inactive/credit-held customers may still pay old debt,
  -- therefore collection is not blocked by credit_enabled,
  -- is_active or credit_hold.
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
      'Receivable Payment customer not found';
  end if;


  -- ---------------------------------------------------------
  -- INVOICE VALIDATION / OUTSTANDING CALCULATION
  --
  -- Invoice rows are locked in canonical UUID order.
  -- This serializes concurrent payments and Sales Returns
  -- against the same invoice.
  -- ---------------------------------------------------------

  for v_item in
    select value
    from jsonb_array_elements(
      v_allocations_canonical
    )
  loop

    v_sales_order_id :=
      (
        v_item
          ->> 'sales_order_id'
      )::uuid;


    v_allocated_amount :=
      (
        v_item
          ->> 'allocated_amount'
      )::numeric;


    select so.*
    into v_order
    from public.sales_orders so
    where so.id =
          v_sales_order_id
      and so.tenant_id =
          p_tenant_id
    for update;


    if not found then
      raise exception
        'Receivable invoice % not found',
        v_sales_order_id;
    end if;


    if v_order.site_id
         is distinct from
            p_site_id then
      raise exception
        'Receivable invoice % belongs to a different site',
        v_order.invoice_no;
    end if;


    if v_order.customer_id
         is distinct from
            p_customer_id then
      raise exception
        'Receivable invoice % belongs to a different customer',
        v_order.invoice_no;
    end if;


    if upper(
         coalesce(
           v_order.payment_method,
           ''
         )
       ) <> 'CREDIT' then
      raise exception
        'Only CREDIT Sales invoices can receive AR payment allocation: %',
        v_order.invoice_no;
    end if;


    if v_order.status not in (
      'posted',
      'partially_returned',
      'returned'
    ) then
      raise exception
        'Invoice % is not eligible for Receivable Payment',
        v_order.invoice_no;
    end if;


    if v_received_at
         < v_order.sold_at then
      raise exception
        'Payment timestamp cannot be before invoice % sale timestamp',
        v_order.invoice_no;
    end if;


    select
      round(
        coalesce(
          sum(
            sr.grand_total_credit
          ),
          0
        ),
        6
      )

    into v_credit_total

    from public.sales_returns sr

    where sr.tenant_id =
          p_tenant_id
      and sr.sales_order_id =
          v_order.id
      and sr.status =
          'posted';


    select
      round(
        coalesce(
          sum(
            ra.allocated_amount
          ),
          0
        ),
        6
      )

    into v_prior_payment_total

    from public.sales_receivable_allocations ra

    join public.sales_receivable_payments rp
      on rp.id =
         ra.payment_id
     and rp.tenant_id =
         ra.tenant_id

    where ra.tenant_id =
          p_tenant_id
      and ra.sales_order_id =
          v_order.id;


    v_outstanding :=
      round(
        greatest(
          v_order.grand_total
          - v_credit_total
          - v_prior_payment_total,
          0
        ),
        6
      );


    if v_allocated_amount
         > v_outstanding then
      raise exception
        'Allocation exceeds outstanding balance for invoice %',
        v_order.invoice_no;
    end if;


    v_allocation_results :=
      v_allocation_results
      ||
      jsonb_build_array(
        jsonb_build_object(
          'sales_order_id',
            v_order.id,

          'invoice_no',
            v_order.invoice_no,

          'invoice_total',
            v_order.grand_total,

          'credit_note_total',
            v_credit_total,

          'prior_payment_total',
            v_prior_payment_total,

          'outstanding_before',
            v_outstanding,

          'allocated_amount',
            v_allocated_amount,

          'outstanding_after',
            round(
              v_outstanding
              - v_allocated_amount,
              6
            )
        )
      );

  end loop;


  -- ---------------------------------------------------------
  -- RECEIPT NUMBER
  -- ---------------------------------------------------------

  v_receipt_no :=
    'RCP-'
    || to_char(
         v_received_at,
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


  -- ---------------------------------------------------------
  -- PAYMENT HEADER
  -- ---------------------------------------------------------

  insert into public.sales_receivable_payments (
    id,
    tenant_id,
    site_id,
    customer_id,
    customer_code_snapshot,
    customer_name_snapshot,
    receipt_no,
    posting_key,
    request_fingerprint,
    payment_method,
    amount,
    reference_no,
    note,
    received_at,
    created_by
  )
  values (
    v_payment_id,
    p_tenant_id,
    p_site_id,
    p_customer_id,
    v_customer.customer_code,
    v_customer.name,
    v_receipt_no,
    v_posting_key,
    v_request_fingerprint,
    v_payment_method,
    v_amount,
    v_reference_no,
    v_note,
    v_received_at,
    v_user_id
  );


  -- ---------------------------------------------------------
  -- IMMUTABLE INVOICE ALLOCATIONS
  -- ---------------------------------------------------------

  for v_item in
    select value
    from jsonb_array_elements(
      v_allocations_canonical
    )
  loop

    insert into public.sales_receivable_allocations (
      tenant_id,
      payment_id,
      sales_order_id,
      allocated_amount
    )
    values (
      p_tenant_id,
      v_payment_id,
      (
        v_item
          ->> 'sales_order_id'
      )::uuid,
      (
        v_item
          ->> 'allocated_amount'
      )::numeric
    );

  end loop;


  -- ---------------------------------------------------------
  -- AUDIT TRAIL
  -- ---------------------------------------------------------

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
    p_site_id,
    v_user_id,
    'sales.payment_post',
    'sales_receivable_payment',
    v_payment_id,
    null,
    jsonb_build_object(
      'receipt_no',
        v_receipt_no,

      'customer_id',
        p_customer_id,

      'customer_code',
        v_customer.customer_code,

      'customer_name',
        v_customer.name,

      'payment_method',
        v_payment_method,

      'amount',
        v_amount,

      'reference_no',
        v_reference_no,

      'received_at',
        v_received_at,

      'allocations',
        v_allocation_results
    ),
    null,
    jsonb_build_object(
      'posting_key',
        v_posting_key
    )
  );


  -- ---------------------------------------------------------
  -- CUSTOMER-FACING RESULT
  -- ---------------------------------------------------------

  return jsonb_build_object(
    'payment_id',
      v_payment_id,

    'receipt_no',
      v_receipt_no,

    'customer_id',
      p_customer_id,

    'customer_code',
      v_customer.customer_code,

    'customer_name',
      v_customer.name,

    'site_id',
      p_site_id,

    'payment_method',
      v_payment_method,

    'amount',
      v_amount,

    'reference_no',
      v_reference_no,

    'note',
      v_note,

    'received_at',
      v_received_at,

    'allocations',
      v_allocation_results,

    'already_posted',
      false
  );

end;

$function$;


-- ============================================================
-- 2. PUBLIC CONTROLLED WRAPPER
-- ============================================================

create or replace function
public.post_receivable_payment(
  p_tenant_id uuid,
  p_site_id uuid,
  p_customer_id uuid,
  p_posting_key text,
  p_payment_method text,
  p_amount numeric,
  p_allocations jsonb,
  p_reference_no text default null,
  p_note text default null,
  p_received_at timestamptz default null
)
returns jsonb
language sql
security invoker
set search_path to 'pg_catalog'
as $function$

  select app_private.post_receivable_payment_impl(
    p_tenant_id,
    p_site_id,
    p_customer_id,
    p_posting_key,
    p_payment_method,
    p_amount,
    p_allocations,
    p_reference_no,
    p_note,
    p_received_at
  );

$function$;


-- ============================================================
-- 3. EXECUTE PRIVILEGE BOUNDARY
-- ============================================================

revoke all
on function
app_private.post_receivable_payment_impl(
  uuid,
  uuid,
  uuid,
  text,
  text,
  numeric,
  jsonb,
  text,
  text,
  timestamptz
)
from public,
     anon;


grant execute
on function
app_private.post_receivable_payment_impl(
  uuid,
  uuid,
  uuid,
  text,
  text,
  numeric,
  jsonb,
  text,
  text,
  timestamptz
)
to authenticated,
   service_role;


revoke all
on function
public.post_receivable_payment(
  uuid,
  uuid,
  uuid,
  text,
  text,
  numeric,
  jsonb,
  text,
  text,
  timestamptz
)
from public,
     anon;


grant execute
on function
public.post_receivable_payment(
  uuid,
  uuid,
  uuid,
  text,
  text,
  numeric,
  jsonb,
  text,
  text,
  timestamptz
)
to authenticated,
   service_role;


-- ============================================================
-- 4. DOCUMENTATION
-- ============================================================

comment on function
public.post_receivable_payment(
  uuid,
  uuid,
  uuid,
  text,
  text,
  numeric,
  jsonb,
  text,
  text,
  timestamptz
) is
  'Controlled atomic customer Receivable Payment posting RPC. Requires sales.payment_post, tenant/site/customer scope, exact full allocation, CREDIT invoice eligibility, derived outstanding protection, invoice row locking and posting-key SHA-256 request fingerprint idempotency.';


comment on function
app_private.post_receivable_payment_impl(
  uuid,
  uuid,
  uuid,
  text,
  text,
  numeric,
  jsonb,
  text,
  text,
  timestamptz
) is
  'Security-definer implementation for controlled Receivable Payment posting. Do not expose as an unrestricted mutation path.';
