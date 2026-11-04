-- =========================================================
-- MAVORA ERP
-- Controlled Customer Master RPC
--
-- Phase 2P-6N-6E
--
-- Security boundaries:
--   * sales_customers remains closed to authenticated direct SQL.
--   * READ requires sales.customer_view.
--   * Customer profile create/update requires sales.customer_manage.
--   * Credit policy update requires sales.credit_manage.
--   * Customer profile RPC never changes credit policy fields.
--   * No Customer delete RPC is introduced.
--   * Inactive customers remain available for historical trace.
--   * Outstanding Balance is intentionally out of scope.
--   * Checkout credit enforcement is intentionally out of scope.
-- =========================================================


-- =========================================================
-- 1. PRIVATE CUSTOMER LIST
-- =========================================================

create or replace function
app_private.list_sales_customers_impl(
  p_tenant_id uuid,
  p_limit integer default 50,
  p_offset integer default 0,
  p_search text default null,
  p_is_active boolean default null,
  p_credit_enabled boolean default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_limit integer :=
    coalesce(p_limit, 50);

  v_offset integer :=
    coalesce(p_offset, 0);

  v_search text :=
    nullif(
      btrim(p_search),
      ''
    );

  v_result jsonb;
begin

  if p_tenant_id is null then
    raise exception
      'Sales customer tenant is required';
  end if;

  if v_limit < 1
     or v_limit > 200 then
    raise exception
      'Customer list limit must be between 1 and 200';
  end if;

  if v_offset < 0 then
    raise exception
      'Customer list offset cannot be negative';
  end if;

  if v_search is not null
     and length(v_search) > 200 then
    raise exception
      'Customer search cannot exceed 200 characters';
  end if;


  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.customer_view',
    null
  );


  with filtered as (
    select
      c.*
    from public.sales_customers c
    where c.tenant_id = p_tenant_id

      and (
        p_is_active is null
        or c.is_active = p_is_active
      )

      and (
        p_credit_enabled is null
        or c.credit_enabled = p_credit_enabled
      )

      and (
        v_search is null

        or c.customer_code
             ilike
             '%' || v_search || '%'

        or c.name
             ilike
             '%' || v_search || '%'

        or coalesce(c.phone, '')
             ilike
             '%' || v_search || '%'

        or coalesce(c.shop_type, '')
             ilike
             '%' || v_search || '%'

        or coalesce(c.address, '')
             ilike
             '%' || v_search || '%'
      )
  )

  select
    jsonb_build_object(
      'ok',
        true,

      'filters',
        jsonb_build_object(
          'search',
            v_search,
          'is_active',
            p_is_active,
          'credit_enabled',
            p_credit_enabled
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

      'customers',
        coalesce(
          (
            select
              jsonb_agg(
                jsonb_build_object(
                  'customer_id',
                    page.id,

                  'customer_code',
                    page.customer_code,

                  'name',
                    page.name,

                  'phone',
                    page.phone,

                  'address',
                    page.address,

                  'shop_type',
                    page.shop_type,

                  'gps',
                    page.gps,

                  'is_active',
                    page.is_active,

                  'credit_enabled',
                    page.credit_enabled,

                  'credit_limit',
                    page.credit_limit,

                  'credit_days',
                    page.credit_days,

                  'credit_hold',
                    page.credit_hold,

                  'internal_note',
                    page.internal_note,

                  'created_at',
                    page.created_at,

                  'updated_at',
                    page.updated_at
                )
                order by
                  lower(page.name),
                  upper(page.customer_code),
                  page.id
              )
            from (
              select *
              from filtered
              order by
                lower(name),
                upper(customer_code),
                id
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
app_private.list_sales_customers_impl(
  uuid,
  integer,
  integer,
  text,
  boolean,
  boolean
)
from public, anon;


grant execute
on function
app_private.list_sales_customers_impl(
  uuid,
  integer,
  integer,
  text,
  boolean,
  boolean
)
to authenticated, service_role;


-- =========================================================
-- 2. PUBLIC CUSTOMER LIST
-- =========================================================

create or replace function
public.list_sales_customers(
  p_tenant_id uuid,
  p_limit integer default 50,
  p_offset integer default 0,
  p_search text default null,
  p_is_active boolean default null,
  p_credit_enabled boolean default null
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $function$

  select app_private.list_sales_customers_impl(
    p_tenant_id,
    p_limit,
    p_offset,
    p_search,
    p_is_active,
    p_credit_enabled
  );

$function$;


revoke all
on function
public.list_sales_customers(
  uuid,
  integer,
  integer,
  text,
  boolean,
  boolean
)
from public, anon;


grant execute
on function
public.list_sales_customers(
  uuid,
  integer,
  integer,
  text,
  boolean,
  boolean
)
to authenticated, service_role;


-- =========================================================
-- 3. PRIVATE CUSTOMER DETAIL
-- =========================================================

create or replace function
app_private.get_sales_customer_impl(
  p_tenant_id uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_customer public.sales_customers%rowtype;
begin

  if p_tenant_id is null then
    raise exception
      'Sales customer tenant is required';
  end if;

  if p_customer_id is null then
    raise exception
      'Sales customer id is required';
  end if;


  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.customer_view',
    null
  );


  select *
  into v_customer
  from public.sales_customers
  where id = p_customer_id
    and tenant_id = p_tenant_id;


  if not found then
    raise exception
      'Sales customer was not found';
  end if;


  return jsonb_build_object(
    'ok',
      true,

    'customer',
      jsonb_build_object(
        'customer_id',
          v_customer.id,

        'customer_code',
          v_customer.customer_code,

        'name',
          v_customer.name,

        'phone',
          v_customer.phone,

        'address',
          v_customer.address,

        'shop_type',
          v_customer.shop_type,

        'gps',
          v_customer.gps,

        'is_active',
          v_customer.is_active,

        'credit_enabled',
          v_customer.credit_enabled,

        'credit_limit',
          v_customer.credit_limit,

        'credit_days',
          v_customer.credit_days,

        'credit_hold',
          v_customer.credit_hold,

        'internal_note',
          v_customer.internal_note,

        'created_at',
          v_customer.created_at,

        'updated_at',
          v_customer.updated_at
      )
  );

end;
$function$;


revoke all
on function
app_private.get_sales_customer_impl(
  uuid,
  uuid
)
from public, anon;


grant execute
on function
app_private.get_sales_customer_impl(
  uuid,
  uuid
)
to authenticated, service_role;


-- =========================================================
-- 4. PUBLIC CUSTOMER DETAIL
-- =========================================================

create or replace function
public.get_sales_customer(
  p_tenant_id uuid,
  p_customer_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $function$

  select app_private.get_sales_customer_impl(
    p_tenant_id,
    p_customer_id
  );

$function$;


revoke all
on function
public.get_sales_customer(
  uuid,
  uuid
)
from public, anon;


grant execute
on function
public.get_sales_customer(
  uuid,
  uuid
)
to authenticated, service_role;


-- =========================================================
-- 5. PRIVATE CUSTOMER PROFILE UPSERT
--
-- IMPORTANT:
-- This function intentionally does NOT accept or mutate:
--   credit_enabled
--   credit_limit
--   credit_days
--   credit_hold
--
-- Credit policy is controlled separately by
-- sales.credit_manage.
-- =========================================================

create or replace function
app_private.upsert_sales_customer_impl(
  p_tenant_id uuid,
  p_customer_code text,
  p_name text,

  p_phone text default null,
  p_address text default null,
  p_shop_type text default null,
  p_gps text default null,

  p_is_active boolean default null,
  p_internal_note text default null,

  p_customer_id uuid default null,
  p_reason text default null
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

  v_phone text;
  v_address text;
  v_shop_type text;
  v_gps text;

  v_internal_note text;
  v_reason text;

  v_existing public.sales_customers%rowtype;
  v_result public.sales_customers%rowtype;

  v_before jsonb;
  v_action text;
begin

  if p_tenant_id is null then
    raise exception
      'Sales customer tenant is required';
  end if;


  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.customer_manage',
    null
  );


  v_code :=
    upper(
      nullif(
        btrim(p_customer_code),
        ''
      )
    );

  v_name :=
    nullif(
      btrim(p_name),
      ''
    );

  v_phone :=
    nullif(
      btrim(p_phone),
      ''
    );

  v_address :=
    nullif(
      btrim(p_address),
      ''
    );

  v_shop_type :=
    nullif(
      btrim(p_shop_type),
      ''
    );

  v_gps :=
    nullif(
      btrim(p_gps),
      ''
    );

  v_internal_note :=
    nullif(
      btrim(p_internal_note),
      ''
    );

  v_reason :=
    nullif(
      btrim(p_reason),
      ''
    );


  if v_code is null then
    raise exception
      'Customer Code is required';
  end if;

  if length(v_code) > 100 then
    raise exception
      'Customer Code cannot exceed 100 characters';
  end if;


  if v_name is null then
    raise exception
      'Customer name is required';
  end if;

  if length(v_name) > 300 then
    raise exception
      'Customer name cannot exceed 300 characters';
  end if;


  if v_phone is not null
     and length(v_phone) > 100 then
    raise exception
      'Customer phone cannot exceed 100 characters';
  end if;


  if v_address is not null
     and length(v_address) > 1000 then
    raise exception
      'Customer address cannot exceed 1000 characters';
  end if;


  if v_shop_type is not null
     and length(v_shop_type) > 120 then
    raise exception
      'Customer Shop Type cannot exceed 120 characters';
  end if;


  if v_gps is not null
     and length(v_gps) > 255 then
    raise exception
      'Customer GPS cannot exceed 255 characters';
  end if;


  if v_internal_note is not null
     and length(v_internal_note) > 4000 then
    raise exception
      'Customer Internal Note cannot exceed 4000 characters';
  end if;


  if v_reason is not null
     and length(v_reason) > 1000 then
    raise exception
      'Customer change reason cannot exceed 1000 characters';
  end if;


  if p_customer_id is null then

    insert into public.sales_customers (
      tenant_id,
      customer_code,
      name,

      phone,
      address,
      shop_type,
      gps,

      is_active,
      internal_note,

      created_by,
      updated_by
    )
    values (
      p_tenant_id,
      v_code,
      v_name,

      v_phone,
      v_address,
      v_shop_type,
      v_gps,

      coalesce(p_is_active, true),
      v_internal_note,

      v_user_id,
      v_user_id
    )
    returning *
    into v_result;


    v_before :=
      null;

    v_action :=
      'sales.customer_create';

  else

    select *
    into v_existing
    from public.sales_customers
    where id = p_customer_id
      and tenant_id = p_tenant_id
    for update;


    if not found then
      raise exception
        'Sales customer was not found';
    end if;


    v_before :=
      jsonb_build_object(
        'customer_code',
          v_existing.customer_code,

        'name',
          v_existing.name,

        'phone',
          v_existing.phone,

        'address',
          v_existing.address,

        'shop_type',
          v_existing.shop_type,

        'gps',
          v_existing.gps,

        'is_active',
          v_existing.is_active,

        'internal_note',
          v_existing.internal_note
      );


    update public.sales_customers
    set
      customer_code =
        v_code,

      name =
        v_name,

      phone =
        v_phone,

      address =
        v_address,

      shop_type =
        v_shop_type,

      gps =
        v_gps,

      is_active =
        coalesce(
          p_is_active,
          v_existing.is_active
        ),

      internal_note =
        v_internal_note,

      updated_by =
        v_user_id

    where id = p_customer_id
      and tenant_id = p_tenant_id

    returning *
    into v_result;


    v_action :=
      'sales.customer_update';

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

    v_action,
    'sales_customer',
    v_result.id,

    v_before,

    jsonb_build_object(
      'customer_code',
        v_result.customer_code,

      'name',
        v_result.name,

      'phone',
        v_result.phone,

      'address',
        v_result.address,

      'shop_type',
        v_result.shop_type,

      'gps',
        v_result.gps,

      'is_active',
        v_result.is_active,

      'internal_note',
        v_result.internal_note
    ),

    v_reason,

    jsonb_build_object(
      'capability',
        'sales.customer_manage'
    )
  );


  return jsonb_build_object(
    'ok',
      true,

    'action',
      v_action,

    'customer',
      jsonb_build_object(
        'customer_id',
          v_result.id,

        'customer_code',
          v_result.customer_code,

        'name',
          v_result.name,

        'phone',
          v_result.phone,

        'address',
          v_result.address,

        'shop_type',
          v_result.shop_type,

        'gps',
          v_result.gps,

        'is_active',
          v_result.is_active,

        'credit_enabled',
          v_result.credit_enabled,

        'credit_limit',
          v_result.credit_limit,

        'credit_days',
          v_result.credit_days,

        'credit_hold',
          v_result.credit_hold,

        'internal_note',
          v_result.internal_note,

        'created_at',
          v_result.created_at,

        'updated_at',
          v_result.updated_at
      )
  );

end;
$function$;


revoke all
on function
app_private.upsert_sales_customer_impl(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  uuid,
  text
)
from public, anon;


grant execute
on function
app_private.upsert_sales_customer_impl(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  uuid,
  text
)
to authenticated, service_role;


-- =========================================================
-- 6. PUBLIC CUSTOMER PROFILE UPSERT
-- =========================================================

create or replace function
public.upsert_sales_customer(
  p_tenant_id uuid,
  p_customer_code text,
  p_name text,

  p_phone text default null,
  p_address text default null,
  p_shop_type text default null,
  p_gps text default null,

  p_is_active boolean default null,
  p_internal_note text default null,

  p_customer_id uuid default null,
  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$

  select app_private.upsert_sales_customer_impl(
    p_tenant_id,
    p_customer_code,
    p_name,

    p_phone,
    p_address,
    p_shop_type,
    p_gps,

    p_is_active,
    p_internal_note,

    p_customer_id,
    p_reason
  );

$function$;


revoke all
on function
public.upsert_sales_customer(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  uuid,
  text
)
from public, anon;


grant execute
on function
public.upsert_sales_customer(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  uuid,
  text
)
to authenticated, service_role;


-- =========================================================
-- 7. PRIVATE CREDIT POLICY SETTER
-- =========================================================

create or replace function
app_private.set_sales_customer_credit_policy_impl(
  p_tenant_id uuid,
  p_customer_id uuid,

  p_credit_enabled boolean,
  p_credit_limit numeric,
  p_credit_days integer,
  p_credit_hold boolean,

  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();

  v_reason text;

  v_existing public.sales_customers%rowtype;
  v_result public.sales_customers%rowtype;

  v_before jsonb;
begin

  if p_tenant_id is null then
    raise exception
      'Sales customer tenant is required';
  end if;

  if p_customer_id is null then
    raise exception
      'Sales customer id is required';
  end if;


  perform app_private.require_sales_access(
    p_tenant_id,
    'sales.credit_manage',
    null
  );


  if p_credit_enabled is null then
    raise exception
      'Credit Enabled value is required';
  end if;

  if p_credit_limit is null then
    raise exception
      'Credit Limit value is required';
  end if;

  if p_credit_days is null then
    raise exception
      'Credit Days value is required';
  end if;

  if p_credit_hold is null then
    raise exception
      'Credit Hold value is required';
  end if;


  if p_credit_limit < 0 then
    raise exception
      'Credit Limit cannot be negative';
  end if;

  if p_credit_days < 0
     or p_credit_days > 3650 then
    raise exception
      'Credit Days must be between 0 and 3650';
  end if;


  v_reason :=
    nullif(
      btrim(p_reason),
      ''
    );

  if v_reason is not null
     and length(v_reason) > 1000 then
    raise exception
      'Credit policy reason cannot exceed 1000 characters';
  end if;


  select *
  into v_existing
  from public.sales_customers
  where id = p_customer_id
    and tenant_id = p_tenant_id
  for update;


  if not found then
    raise exception
      'Sales customer was not found';
  end if;


  v_before :=
    jsonb_build_object(
      'credit_enabled',
        v_existing.credit_enabled,

      'credit_limit',
        v_existing.credit_limit,

      'credit_days',
        v_existing.credit_days,

      'credit_hold',
        v_existing.credit_hold
    );


  update public.sales_customers
  set
    credit_enabled =
      p_credit_enabled,

    credit_limit =
      p_credit_limit,

    credit_days =
      p_credit_days,

    credit_hold =
      p_credit_hold,

    updated_by =
      v_user_id

  where id = p_customer_id
    and tenant_id = p_tenant_id

  returning *
  into v_result;


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

    'sales.customer_credit_policy_set',
    'sales_customer',
    v_result.id,

    v_before,

    jsonb_build_object(
      'credit_enabled',
        v_result.credit_enabled,

      'credit_limit',
        v_result.credit_limit,

      'credit_days',
        v_result.credit_days,

      'credit_hold',
        v_result.credit_hold
    ),

    v_reason,

    jsonb_build_object(
      'capability',
        'sales.credit_manage'
    )
  );


  return jsonb_build_object(
    'ok',
      true,

    'customer_id',
      v_result.id,

    'customer_code',
      v_result.customer_code,

    'name',
      v_result.name,

    'credit_policy',
      jsonb_build_object(
        'credit_enabled',
          v_result.credit_enabled,

        'credit_limit',
          v_result.credit_limit,

        'credit_days',
          v_result.credit_days,

        'credit_hold',
          v_result.credit_hold
      ),

    'updated_at',
      v_result.updated_at
  );

end;
$function$;


revoke all
on function
app_private.set_sales_customer_credit_policy_impl(
  uuid,
  uuid,
  boolean,
  numeric,
  integer,
  boolean,
  text
)
from public, anon;


grant execute
on function
app_private.set_sales_customer_credit_policy_impl(
  uuid,
  uuid,
  boolean,
  numeric,
  integer,
  boolean,
  text
)
to authenticated, service_role;


-- =========================================================
-- 8. PUBLIC CREDIT POLICY SETTER
-- =========================================================

create or replace function
public.set_sales_customer_credit_policy(
  p_tenant_id uuid,
  p_customer_id uuid,

  p_credit_enabled boolean,
  p_credit_limit numeric,
  p_credit_days integer,
  p_credit_hold boolean,

  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $function$

  select
    app_private.set_sales_customer_credit_policy_impl(
      p_tenant_id,
      p_customer_id,

      p_credit_enabled,
      p_credit_limit,
      p_credit_days,
      p_credit_hold,

      p_reason
    );

$function$;


revoke all
on function
public.set_sales_customer_credit_policy(
  uuid,
  uuid,
  boolean,
  numeric,
  integer,
  boolean,
  text
)
from public, anon;


grant execute
on function
public.set_sales_customer_credit_policy(
  uuid,
  uuid,
  boolean,
  numeric,
  integer,
  boolean,
  text
)
to authenticated, service_role;


-- =========================================================
-- 9. FUNCTION DOCUMENTATION
-- =========================================================

comment on function
public.list_sales_customers(
  uuid,
  integer,
  integer,
  text,
  boolean,
  boolean
)
is
  'Controlled Customer Master list. Requires sales.customer_view and supports search, active-state, credit-enabled and paging filters.';


comment on function
public.get_sales_customer(
  uuid,
  uuid
)
is
  'Controlled Customer Master detail. Requires sales.customer_view.';


comment on function
public.upsert_sales_customer(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  uuid,
  text
)
is
  'Controlled Customer Master profile create/update. Requires sales.customer_manage and intentionally cannot mutate customer credit policy.';


comment on function
public.set_sales_customer_credit_policy(
  uuid,
  uuid,
  boolean,
  numeric,
  integer,
  boolean,
  text
)
is
  'Controlled Customer Credit Policy update. Requires sales.credit_manage. Credit exposure/outstanding calculation and checkout enforcement are separate phases.';


-- =========================================================
-- END
-- =========================================================
