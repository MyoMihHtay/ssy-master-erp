-- ============================================================
-- MAVORA ERP
-- CUSTOMER RECEIVABLE READ-SIDE
--
-- Provides:
--   * Derived Outstanding Balance
--   * Customer Credit Balance
--   * Aging buckets
--   * Invoice-level AR position
--   * Customer Statement
--   * Credit-limit availability context
--
-- Accounting authority:
--
--   Invoice Raw Position =
--     CREDIT Sales grand_total
--     - posted Credit Notes / Returns
--     - posted Payment Allocations
--
--   Outstanding =
--     greatest(Invoice Raw Position, 0)
--
--   Customer Credit =
--     greatest(-Invoice Raw Position, 0)
--
-- Outstanding Balance is NEVER stored on Customer Master.
--
-- Aging:
--   credit_terms snapshot is parsed only when it matches
--   the controlled "N Days" format.
--
-- Historical / malformed terms are NOT guessed.
-- They are classified as UNKNOWN aging.
--
-- Reporting scope:
--   Outstanding / Aging / Statement may be Site-filtered.
--   Customer Credit Limit exposure remains Tenant-wide because
--   sales_customers.credit_limit is Tenant-level, not Site-level.
--
-- Legacy sales_orders.is_paid is intentionally NOT used
-- as Accounts Receivable authority.
-- ============================================================


-- ============================================================
-- 1. PRIVATE READ IMPLEMENTATION
-- ============================================================

create or replace function
app_private.get_customer_receivable_impl(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_site_id uuid default null,
  p_as_of date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $function$

declare
  v_user_id uuid :=
    auth.uid();

  v_customer
    public.sales_customers%rowtype;

  v_timezone text;

  v_as_of date;

  v_result jsonb;

begin

  -- ---------------------------------------------------------
  -- AUTH / REQUIRED SCOPE
  -- ---------------------------------------------------------

  if v_user_id is null then
    raise exception
      'Authentication required';
  end if;


  if p_tenant_id is null then
    raise exception
      'Receivable tenant is required';
  end if;


  if p_customer_id is null then
    raise exception
      'Receivable customer is required';
  end if;


  -- ---------------------------------------------------------
  -- REPORTING TIMEZONE
  --
  -- Site report:
  --   use Site timezone.
  --
  -- Tenant-wide report:
  --   use Tenant timezone.
  -- ---------------------------------------------------------

  if p_site_id is not null then

    select s.timezone
    into v_timezone
    from public.sites s
    where s.id = p_site_id
      and s.tenant_id = p_tenant_id;


    if not found then
      raise exception
        'Receivable site not found';
    end if;


  else

    select t.timezone
    into v_timezone
    from public.tenants t
    where t.id = p_tenant_id;


    if not found then
      raise exception
        'Receivable tenant not found';
    end if;

  end if;


  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.receivable_view',
    p_site_id
  );


  -- ---------------------------------------------------------
  -- CUSTOMER MASTER = CURRENT TRUTH
  -- ---------------------------------------------------------

  select sc.*
  into v_customer
  from public.sales_customers sc
  where sc.id = p_customer_id
    and sc.tenant_id = p_tenant_id;


  if not found then
    raise exception
      'Receivable customer not found';
  end if;


  v_as_of :=
    coalesce(
      p_as_of,
      (
        now()
        at time zone
        v_timezone
      )::date
    );


  -- ---------------------------------------------------------
  -- DERIVED RECEIVABLE MODEL
  -- ---------------------------------------------------------

  with

  invoice_terms as (

    select
      so.id
        as sales_order_id,

      so.site_id,

      so.invoice_no,

      so.status
        as sales_status,

      so.customer_ref,

      so.customer_name
        as invoice_customer_name,

      so.credit_terms,

      so.sold_at,

      (
        so.sold_at
        at time zone
        v_timezone
      )::date
        as sold_date,

      so.grand_total,

      case
        when coalesce(
          so.credit_terms,
          ''
        ) ~*
        '^[[:space:]]*[0-9]+[[:space:]]+days?[[:space:]]*$'

        then substring(
          so.credit_terms
          from '([0-9]+)'
        )::integer

        else null
      end
        as credit_days,

      round(
        coalesce(
          (
            select sum(
              sr.grand_total_credit
            )
            from public.sales_returns sr
            where sr.tenant_id =
                  so.tenant_id
              and sr.sales_order_id =
                  so.id
              and sr.status =
                  'posted'
              and (
                sr.returned_at
                at time zone
                v_timezone
              )::date <= v_as_of
          ),
          0
        ),
        6
      )
        as credit_note_total,

      round(
        coalesce(
          (
            select sum(
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
              and (
                rp.received_at
                at time zone
                v_timezone
              )::date <= v_as_of
          ),
          0
        ),
        6
      )
        as payment_total

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
          ) = 'CREDIT'

      and so.status in (
        'posted',
        'partially_returned',
        'returned'
      )

      and (
        so.sold_at
        at time zone
        v_timezone
      )::date <= v_as_of

  ),


  invoice_calc as (

    select
      i.*,

      case
        when i.credit_days is null
          then null

        else
          i.sold_date
          + i.credit_days
      end
        as due_date,

      round(
        i.grand_total
        - i.credit_note_total
        - i.payment_total,
        6
      )
        as raw_position

    from invoice_terms i

  ),


  invoice_final as (

    select
      i.*,

      round(
        greatest(
          i.raw_position,
          0
        ),
        6
      )
        as outstanding,

      round(
        greatest(
          -i.raw_position,
          0
        ),
        6
      )
        as customer_credit,

      case
        when i.raw_position < 0
          then 'CUSTOMER_CREDIT'

        when i.raw_position = 0
          then 'SETTLED'

        when i.raw_position
             < i.grand_total
          then 'PARTIAL'

        else 'OPEN'
      end
        as ar_status,

      case
        when i.raw_position <= 0
          then 0

        when i.due_date is null
          then null

        else greatest(
          v_as_of
          - i.due_date,
          0
        )
      end
        as days_past_due,

      case
        when i.raw_position <= 0
          then 'SETTLED'

        when i.due_date is null
          then 'UNKNOWN'

        when v_as_of <= i.due_date
          then 'CURRENT'

        when (
          v_as_of
          - i.due_date
        ) between 1 and 30
          then '1-30'

        when (
          v_as_of
          - i.due_date
        ) between 31 and 60
          then '31-60'

        when (
          v_as_of
          - i.due_date
        ) between 61 and 90
          then '61-90'

        else '90+'
      end
        as aging_bucket

    from invoice_calc i

  ),


  scope_invoice_final as (

    select i.*
    from invoice_final i
    where p_site_id is null
       or i.site_id = p_site_id

  ),


  statement_raw as (

    -- -------------------------------------------------------
    -- CREDIT SALES = DEBIT
    -- -------------------------------------------------------

    select
      so.sold_at
        as event_at,

      10
        as event_order,

      'INVOICE'::text
        as event_type,

      so.id
        as source_id,

      so.site_id,

      so.invoice_no
        as document_no,

      so.invoice_no
        as related_invoice_no,

      round(
        so.grand_total,
        6
      )
        as debit_amount,

      0::numeric
        as credit_amount,

      null::text
        as reference_no,

      so.invoice_remark
        as note

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
          ) = 'CREDIT'

      and so.status in (
        'posted',
        'partially_returned',
        'returned'
      )

      and (
        so.sold_at
        at time zone
        v_timezone
      )::date <= v_as_of

      and (
        p_site_id is null
        or so.site_id =
           p_site_id
      )


    union all


    -- -------------------------------------------------------
    -- POSTED CREDIT NOTE = CREDIT
    -- -------------------------------------------------------

    select
      sr.returned_at
        as event_at,

      20
        as event_order,

      'CREDIT_NOTE'::text
        as event_type,

      sr.id
        as source_id,

      sr.site_id,

      sr.credit_note_no
        as document_no,

      so.invoice_no
        as related_invoice_no,

      0::numeric
        as debit_amount,

      round(
        sr.grand_total_credit,
        6
      )
        as credit_amount,

      null::text
        as reference_no,

      sr.reason
        as note

    from public.sales_returns sr

    join public.sales_orders so
      on so.id =
         sr.sales_order_id
     and so.tenant_id =
         sr.tenant_id

    where sr.tenant_id =
          p_tenant_id

      and so.customer_id =
          p_customer_id

      and upper(
            coalesce(
              so.payment_method,
              ''
            )
          ) = 'CREDIT'

      and sr.status =
          'posted'

      and (
        sr.returned_at
        at time zone
        v_timezone
      )::date <= v_as_of

      and (
        p_site_id is null
        or sr.site_id =
           p_site_id
      )


    union all


    -- -------------------------------------------------------
    -- RECEIVABLE PAYMENT = CREDIT
    -- -------------------------------------------------------

    select
      rp.received_at
        as event_at,

      30
        as event_order,

      'PAYMENT'::text
        as event_type,

      rp.id
        as source_id,

      rp.site_id,

      rp.receipt_no
        as document_no,

      null::text
        as related_invoice_no,

      0::numeric
        as debit_amount,

      round(
        rp.amount,
        6
      )
        as credit_amount,

      rp.reference_no,

      rp.note

    from public.sales_receivable_payments rp

    where rp.tenant_id =
          p_tenant_id

      and rp.customer_id =
          p_customer_id

      and (
        rp.received_at
        at time zone
        v_timezone
      )::date <= v_as_of

      and (
        p_site_id is null
        or rp.site_id =
           p_site_id
      )

  ),


  statement_calc as (

    select
      s.*,

      round(
        sum(
          s.debit_amount
          - s.credit_amount
        )
        over (
          order by
            s.event_at,
            s.event_order,
            s.source_id
        ),
        6
      )
        as running_net_balance

    from statement_raw s

  )


  select jsonb_build_object(

    -- -------------------------------------------------------
    -- REPORT SCOPE
    -- -------------------------------------------------------

    'as_of',
      v_as_of,

    'timezone',
      v_timezone,

    'site_id',
      p_site_id,


    -- -------------------------------------------------------
    -- CURRENT CUSTOMER MASTER
    -- -------------------------------------------------------

    'customer',
      jsonb_build_object(

        'id',
          v_customer.id,

        'customer_code',
          v_customer.customer_code,

        'name',
          v_customer.name,

        'phone',
          v_customer.phone,

        'address',
          v_customer.address,

        'is_active',
          v_customer.is_active,

        'credit_enabled',
          v_customer.credit_enabled,

        'credit_hold',
          v_customer.credit_hold,

        'credit_limit',
          v_customer.credit_limit,

        'credit_days',
          v_customer.credit_days

      ),


    -- -------------------------------------------------------
    -- AR SUMMARY
    -- -------------------------------------------------------

    'summary',
      (
        select jsonb_build_object(

          'invoice_count',
            count(*),

          'open_invoice_count',
            count(*) filter (
              where i.outstanding > 0
            ),

          'total_credit_sales',
            round(
              coalesce(
                sum(i.grand_total),
                0
              ),
              6
            ),

          'total_credit_notes',
            round(
              coalesce(
                sum(i.credit_note_total),
                0
              ),
              6
            ),

          'total_payments',
            round(
              coalesce(
                sum(i.payment_total),
                0
              ),
              6
            ),

          'outstanding_balance',
            round(
              coalesce(
                sum(i.outstanding),
                0
              ),
              6
            ),

          'customer_credit_balance',
            round(
              coalesce(
                sum(i.customer_credit),
                0
              ),
              6
            ),

          'net_account_position',
            round(
              coalesce(
                sum(i.outstanding),
                0
              )
              -
              coalesce(
                sum(i.customer_credit),
                0
              ),
              6
            ),

          'overdue_balance',
            round(
              coalesce(
                sum(i.outstanding)
                filter (
                  where i.outstanding > 0
                    and i.due_date
                        < v_as_of
                ),
                0
              ),
              6
            ),

          'credit_limit',
            v_customer.credit_limit,

          'available_credit',
            round(
              greatest(
                v_customer.credit_limit
                -
                coalesce(
                  (
                    select sum(
                      g.outstanding
                    )
                    from invoice_final g
                  ),
                  0
                ),
                0
              ),
              6
            ),

          'credit_available_for_new_sales',
            case
              when v_customer.is_active
                   and
                   v_customer.credit_enabled
                   and
                   not v_customer.credit_hold

              then round(
                greatest(
                  v_customer.credit_limit
                  -
                  coalesce(
                    (
                      select sum(
                        g.outstanding
                      )
                      from invoice_final g
                    ),
                    0
                  ),
                  0
                ),
                6
              )

              else 0::numeric
            end

        )
        from scope_invoice_final i
      ),


    -- -------------------------------------------------------
    -- AGING SUMMARY
    -- -------------------------------------------------------

    'aging',
      (
        select jsonb_build_object(

          'CURRENT',
            round(
              coalesce(
                sum(i.outstanding)
                filter (
                  where i.aging_bucket =
                        'CURRENT'
                ),
                0
              ),
              6
            ),

          '1-30',
            round(
              coalesce(
                sum(i.outstanding)
                filter (
                  where i.aging_bucket =
                        '1-30'
                ),
                0
              ),
              6
            ),

          '31-60',
            round(
              coalesce(
                sum(i.outstanding)
                filter (
                  where i.aging_bucket =
                        '31-60'
                ),
                0
              ),
              6
            ),

          '61-90',
            round(
              coalesce(
                sum(i.outstanding)
                filter (
                  where i.aging_bucket =
                        '61-90'
                ),
                0
              ),
              6
            ),

          '90+',
            round(
              coalesce(
                sum(i.outstanding)
                filter (
                  where i.aging_bucket =
                        '90+'
                ),
                0
              ),
              6
            ),

          'UNKNOWN',
            round(
              coalesce(
                sum(i.outstanding)
                filter (
                  where i.aging_bucket =
                        'UNKNOWN'
                ),
                0
              ),
              6
            )

        )
        from scope_invoice_final i
      ),


    -- -------------------------------------------------------
    -- INVOICE-LEVEL POSITION
    -- -------------------------------------------------------

    'invoices',
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(

              'sales_order_id',
                i.sales_order_id,

              'site_id',
                i.site_id,

              'invoice_no',
                i.invoice_no,

              'sales_status',
                i.sales_status,

              'ar_status',
                i.ar_status,

              'customer_ref',
                i.customer_ref,

              'invoice_customer_name',
                i.invoice_customer_name,

              'sold_at',
                i.sold_at,

              'sold_date',
                i.sold_date,

              'credit_terms',
                i.credit_terms,

              'credit_days',
                i.credit_days,

              'due_date',
                i.due_date,

              'grand_total',
                i.grand_total,

              'credit_note_total',
                i.credit_note_total,

              'payment_total',
                i.payment_total,

              'outstanding',
                i.outstanding,

              'customer_credit',
                i.customer_credit,

              'days_past_due',
                i.days_past_due,

              'aging_bucket',
                i.aging_bucket

            )
            order by
              i.sold_at,
              i.invoice_no
          ),
          '[]'::jsonb
        )
        from scope_invoice_final i
      ),


    -- -------------------------------------------------------
    -- CUSTOMER STATEMENT
    --
    -- Positive running_net_balance = amount due.
    -- Negative running_net_balance = customer credit.
    -- -------------------------------------------------------

    'statement',
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(

              'event_at',
                s.event_at,

              'event_type',
                s.event_type,

              'source_id',
                s.source_id,

              'site_id',
                s.site_id,

              'document_no',
                s.document_no,

              'related_invoice_no',
                s.related_invoice_no,

              'debit',
                s.debit_amount,

              'credit',
                s.credit_amount,

              'reference_no',
                s.reference_no,

              'note',
                s.note,

              'running_net_balance',
                s.running_net_balance,

              'running_balance_type',
                case
                  when s.running_net_balance > 0
                    then 'DUE'

                  when s.running_net_balance < 0
                    then 'CUSTOMER_CREDIT'

                  else 'SETTLED'
                end

            )
            order by
              s.event_at,
              s.event_order,
              s.source_id
          ),
          '[]'::jsonb
        )
        from statement_calc s
      )

  )
  into v_result;


  return v_result;

end;

$function$;


-- ============================================================
-- 2. PUBLIC CONTROLLED READ WRAPPER
-- ============================================================

create or replace function
public.get_customer_receivable(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_site_id uuid default null,
  p_as_of date default null
)
returns jsonb
language sql
stable
security invoker
set search_path to 'pg_catalog'
as $function$

  select app_private.get_customer_receivable_impl(
    p_tenant_id,
    p_customer_id,
    p_site_id,
    p_as_of
  );

$function$;


-- ============================================================
-- 3. EXECUTE PRIVILEGES
-- ============================================================

revoke all
on function
app_private.get_customer_receivable_impl(
  uuid,
  uuid,
  uuid,
  date
)
from public,
     anon;


grant execute
on function
app_private.get_customer_receivable_impl(
  uuid,
  uuid,
  uuid,
  date
)
to authenticated,
   service_role;


revoke all
on function
public.get_customer_receivable(
  uuid,
  uuid,
  uuid,
  date
)
from public,
     anon;


grant execute
on function
public.get_customer_receivable(
  uuid,
  uuid,
  uuid,
  date
)
to authenticated,
   service_role;


-- ============================================================
-- 4. DOCUMENTATION
-- ============================================================

comment on function
public.get_customer_receivable(
  uuid,
  uuid,
  uuid,
  date
) is
  'Controlled Customer Accounts Receivable read-side. Returns derived invoice outstanding, Customer Credit, Aging, available credit context and Customer Statement. Requires sales.receivable_view. Legacy paid-status flag is not AR authority.';


comment on function
app_private.get_customer_receivable_impl(
  uuid,
  uuid,
  uuid,
  date
) is
  'Security-definer Customer Receivable read implementation. Outstanding is derived invoice-by-invoice from CREDIT Sales less posted Credit Notes and posted Payment Allocations. Malformed historical credit terms are classified as UNKNOWN Aging rather than guessed.';
