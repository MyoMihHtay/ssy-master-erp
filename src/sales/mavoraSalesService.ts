import { mavoraSupabase } from '../mavoraSupabase';

export type MavoraSalesTrackingMode =
  | 'none'
  | 'lot'
  | 'batch';

export interface MavoraSalesWarehouse {
  id: string;
  tenant_id: string;
  site_id: string;
  code: string;
  name: string;
  warehouse_type: string;
  is_active: boolean;
}

export interface MavoraSalesCatalogWarehouse {
  id: string;
  site_id: string;
  code: string;
  name: string;
}

export interface MavoraSalesPriceListSummary {
  id: string;
  code: string;
  name: string;
  currency_code: string;
  is_default: boolean;
}

export interface MavoraSalesCatalogProduct {
  product_id: string;
  sku: string;
  barcode: string | null;
  name: string;

  category_code: string | null;
  category_name: string | null;

  unit_code: string;
  unit_symbol: string | null;

  tracking_mode: MavoraSalesTrackingMode;

  on_hand: number;
  reserved: number;
  available: number;

  price_id: string | null;
  unit_price: number | null;
  min_quantity: number | null;

  price_effective_from: string | null;
  price_effective_to: string | null;

  is_sellable: boolean;
}

export interface MavoraSalesCatalog {
  ok: boolean;
  as_of: string;

  warehouse: MavoraSalesCatalogWarehouse;
  price_list: MavoraSalesPriceListSummary;

  products: MavoraSalesCatalogProduct[];
}

export interface UpsertMavoraSalesPriceListInput {
  tenantId: string;
  code: string;
  name: string;

  currencyCode?: string;
  description?: string | null;

  isDefault?: boolean;
  isActive?: boolean;

  priceListId?: string | null;
}

export interface MavoraSalesPriceListMutationResult {
  ok: boolean;
  price_list_id: string;
  code: string;
  name: string;
  currency_code: string;
  is_default: boolean;
  is_active: boolean;
}

export interface SetMavoraSalesProductPriceInput {
  tenantId: string;
  priceListId: string;
  productId: string;

  unitPrice: number;
  effectiveFrom: string;

  minQuantity?: number;
}

export interface MavoraSalesPriceMutationResult {
  ok: boolean;
  price_id?: string;
  price_list_id?: string;
  product_id?: string;
  unit_price?: number;
  min_quantity?: number;
  effective_from?: string;
  effective_to?: string | null;
}

export interface MavoraSalesCheckoutItemInput {
  productId: string;
  quantity: number;
}

/* =========================================================
 * CONTROLLED CUSTOMER MASTER
 * Phase 2P-6N-6I client service layer
 * ========================================================= */

export interface MavoraSalesCustomer {
  customer_id: string;
  customer_code: string;
  name: string;

  phone: string | null;
  address: string | null;
  shop_type: string | null;
  gps: string | null;

  is_active: boolean;

  credit_enabled: boolean;
  credit_limit: number;
  credit_days: number;
  credit_hold: boolean;

  internal_note: string | null;

  created_at: string;
  updated_at: string;
}

export interface MavoraSalesCustomerListResult {
  ok: boolean;

  filters: {
    search: string | null;
    is_active: boolean | null;
    credit_enabled: boolean | null;
  };

  limit: number;
  offset: number;
  total_count: number;

  customers: MavoraSalesCustomer[];
}

export interface LoadMavoraSalesCustomersInput {
  tenantId: string;

  limit?: number;
  offset?: number;

  search?: string | null;

  isActive?: boolean | null;
  creditEnabled?: boolean | null;
}

export interface MavoraSalesCustomerDetailResult {
  ok: boolean;
  customer: MavoraSalesCustomer;
}

export interface UpsertMavoraSalesCustomerInput {
  tenantId: string;

  customerCode: string;
  name: string;

  phone?: string | null;
  address?: string | null;
  shopType?: string | null;
  gps?: string | null;

  isActive?: boolean | null;
  internalNote?: string | null;

  customerId?: string | null;
  reason?: string | null;
}

export interface MavoraSalesCustomerMutationResult {
  ok: boolean;
  action: string;
  customer: MavoraSalesCustomer;
}

export interface SetMavoraSalesCustomerCreditPolicyInput {
  tenantId: string;
  customerId: string;

  creditEnabled: boolean;
  creditLimit: number;
  creditDays: number;
  creditHold: boolean;

  reason?: string | null;
}

export interface MavoraSalesCustomerCreditPolicyResult {
  ok: boolean;

  customer_id: string;
  customer_code: string;
  name: string;

  credit_policy: {
    credit_enabled: boolean;
    credit_limit: number;
    credit_days: number;
    credit_hold: boolean;
  };

  updated_at: string;
}

export interface CheckoutMavoraSalesOrderInput {
  tenantId: string;
  warehouseId: string;

  postingKey: string;

  customerName: string;

  customerId?: string | null;
  invoiceRemark?: string | null;

  items: MavoraSalesCheckoutItemInput[];

  priceListId?: string | null;
  invoiceNo?: string | null;

  customerRef?: string | null;
  customerPhone?: string | null;
  customerShopType?: string | null;
  customerAddress?: string | null;
  customerGps?: string | null;

  paymentMethod?: string;
  creditTerms?: string | null;

  discountPercent?: number;
  taxPercent?: number;
}

export interface MavoraSalesCheckoutLineResult {
  line_id: string;
  line_no: number;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  tax_amount?: number;
  line_total: number;
  cogs_total: number;
}

export interface MavoraSalesCheckoutResult {
  ok: boolean;
  idempotent: boolean;

  sales_order_id: string;
  invoice_no: string;
  posting_key: string;
  status: string;

  price_list_id?: string;
  price_list_code?: string;
  currency_code?: string;

  subtotal: number;

  discount_percent?: number;
  discount_amount: number;

  tax_percent?: number;
  tax_amount: number;

  grand_total: number;

  total_cogs?: number;

  payment_method?: string;
  is_paid?: boolean;

  customer_id?: string | null;
  invoice_remark?: string | null;
  checkout_version?: 'legacy' | 'v2';

  credit_limit_check?:
    | 'passed'
    | 'historical_retry';

  credit_limit?: number;
  outstanding_after_checkout?: number;
  available_credit_after_checkout?: number;

  movement_group_id: string | null;

  lines: MavoraSalesCheckoutLineResult[];
}


/* =========================================================
 * CUSTOMER ACCOUNTS RECEIVABLE / PAYMENT COLLECTION
 * Phase 2P-6N-8 client service layer
 *
 * Outstanding Balance is DERIVED by the server:
 *
 *   CREDIT Sales
 *   - Credit Notes / Returns
 *   - Payment Allocations
 *
 * No editable or locally persisted outstanding balance.
 * ========================================================= */

export type MavoraReceivablePaymentMethod =
  | 'CASH'
  | 'BANK'
  | 'MOBILE'
  | 'CHEQUE'
  | 'OTHER';

export interface MavoraReceivableCustomer {
  id: string;
  customer_code: string;
  name: string;

  phone: string | null;
  address: string | null;

  is_active: boolean;

  credit_enabled: boolean;
  credit_hold: boolean;

  credit_limit: number;
  credit_days: number;
}

export interface MavoraReceivableSummary {
  invoice_count: number;
  open_invoice_count: number;

  total_credit_sales: number;
  total_credit_notes: number;
  total_payments: number;

  outstanding_balance: number;
  customer_credit_balance: number;
  net_account_position: number;

  overdue_balance: number;

  credit_limit: number;
  available_credit: number;
  credit_available_for_new_sales: number;
}

export interface MavoraReceivableAging {
  CURRENT: number;
  '1-30': number;
  '31-60': number;
  '61-90': number;
  '90+': number;
  UNKNOWN: number;
}

export interface MavoraReceivableInvoice {
  sales_order_id: string;
  site_id: string;

  invoice_no: string;

  sales_status: string;
  ar_status:
    | 'OPEN'
    | 'PARTIAL'
    | 'SETTLED'
    | 'CUSTOMER_CREDIT'
    | string;

  customer_ref: string | null;
  invoice_customer_name: string | null;

  sold_at: string;
  sold_date: string;

  credit_terms: string | null;
  credit_days: number | null;
  due_date: string | null;

  grand_total: number;

  credit_note_total: number;
  payment_total: number;

  outstanding: number;
  customer_credit: number;

  days_past_due: number | null;

  aging_bucket:
    | 'CURRENT'
    | '1-30'
    | '31-60'
    | '61-90'
    | '90+'
    | 'UNKNOWN'
    | 'SETTLED'
    | string;
}

export interface MavoraReceivableStatementEvent {
  event_at: string;

  event_type:
    | 'INVOICE'
    | 'CREDIT_NOTE'
    | 'PAYMENT'
    | string;

  source_id: string;
  site_id: string;

  document_no: string | null;
  related_invoice_no: string | null;

  debit: number;
  credit: number;

  reference_no: string | null;
  note: string | null;

  running_net_balance: number;

  running_balance_type:
    | 'DUE'
    | 'CUSTOMER_CREDIT'
    | 'SETTLED'
    | string;
}

export interface MavoraCustomerReceivableResult {
  as_of: string;
  timezone: string;

  site_id: string | null;

  customer: MavoraReceivableCustomer;

  summary: MavoraReceivableSummary;
  aging: MavoraReceivableAging;

  invoices: MavoraReceivableInvoice[];

  statement: MavoraReceivableStatementEvent[];
}

export interface LoadMavoraCustomerReceivableInput {
  tenantId: string;
  customerId: string;

  siteId?: string | null;
  asOf?: string | null;
}

export interface MavoraReceivablePaymentAllocationInput {
  salesOrderId: string;
  allocatedAmount: number;
}

export interface PostMavoraReceivablePaymentInput {
  tenantId: string;
  siteId: string;
  customerId: string;

  postingKey: string;

  paymentMethod: MavoraReceivablePaymentMethod;

  amount: number;

  allocations: MavoraReceivablePaymentAllocationInput[];

  referenceNo?: string | null;
  note?: string | null;

  receivedAt?: string | null;
}

export interface MavoraReceivablePaymentAllocationResult {
  sales_order_id: string;
  invoice_no: string;

  invoice_total: number;

  credit_note_total: number;
  prior_payment_total: number;

  outstanding_before: number;
  allocated_amount: number;
  outstanding_after: number;
}

export interface MavoraReceivablePaymentResult {
  payment_id: string;
  receipt_no: string;

  tenant_id?: string;
  site_id: string;

  customer_id: string;
  customer_code: string;
  customer_name: string;

  posting_key?: string;

  payment_method: MavoraReceivablePaymentMethod;

  amount: number;

  reference_no: string | null;
  note: string | null;

  received_at: string;

  already_posted: boolean;

  allocations:
    MavoraReceivablePaymentAllocationResult[];
}

const throwIfError = (
  error: { message?: string } | null,
  fallback: string
) => {
  if (error) {
    throw new Error(
      error.message || fallback
    );
  }
};

const requirePositiveNumber = (
  value: number,
  label: string
) => {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      `${label} must be greater than zero`
    );
  }
};

const requireNonNegativeNumber = (
  value: number,
  label: string
) => {
  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new Error(
      `${label} cannot be negative`
    );
  }
};

export const createSalesPostingKey = (
  prefix = 'sales'
): string => {
  const uuid =
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`;

  return `${prefix}-${uuid}`;
};

export const loadMavoraSalesWarehouses =
  async (
    tenantId: string
  ): Promise<MavoraSalesWarehouse[]> => {
    const { data, error } =
      await mavoraSupabase
        .from('warehouses')
        .select(
          'id, tenant_id, site_id, code, name, warehouse_type, is_active'
        )
        .eq(
          'tenant_id',
          tenantId
        )
        .eq(
          'warehouse_type',
          'FG'
        )
        .eq(
          'is_active',
          true
        )
        .order(
          'code',
          {
            ascending: true,
          }
        );

    throwIfError(
      error,
      'Unable to load Finished Goods warehouses'
    );

    return (
      data as MavoraSalesWarehouse[]
    ) ?? [];
  };

export const loadMavoraSalesCatalog =
  async (
    tenantId: string,
    warehouseId: string,
    priceListId?: string | null
  ): Promise<MavoraSalesCatalog> => {
    const { data, error } =
      await mavoraSupabase.rpc(
        'get_sales_catalog',
        {
          p_tenant_id:
            tenantId,

          p_warehouse_id:
            warehouseId,

          p_price_list_id:
            priceListId ?? null,

          // Server validates operational Site-local date.
          p_as_of:
            null,
        }
      );

    throwIfError(
      error,
      'Unable to load controlled Sales Catalog'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid controlled Sales Catalog response'
      );
    }

    return data as MavoraSalesCatalog;
  };

export const upsertMavoraSalesPriceList =
  async (
    input: UpsertMavoraSalesPriceListInput
  ): Promise<MavoraSalesPriceListMutationResult> => {
    const code =
      input.code.trim();

    const name =
      input.name.trim();

    if (!code) {
      throw new Error(
        'Price List code is required'
      );
    }

    if (!name) {
      throw new Error(
        'Price List name is required'
      );
    }

    const { data, error } =
      await mavoraSupabase.rpc(
        'upsert_sales_price_list',
        {
          p_tenant_id:
            input.tenantId,

          p_code:
            code,

          p_name:
            name,

          p_currency_code:
            (
              input.currencyCode ??
              'MMK'
            )
              .trim()
              .toUpperCase(),

          p_description:
            input.description?.trim() ||
            null,

          p_is_default:
            input.isDefault ??
            false,

          p_is_active:
            input.isActive ??
            true,

          p_price_list_id:
            input.priceListId ??
            null,
        }
      );

    throwIfError(
      error,
      'Unable to create/update Sales Price List'
    );

    return (
      data as MavoraSalesPriceListMutationResult
    );
  };

export const setMavoraSalesProductPrice =
  async (
    input: SetMavoraSalesProductPriceInput
  ): Promise<MavoraSalesPriceMutationResult> => {
    requireNonNegativeNumber(
      input.unitPrice,
      'Unit price'
    );

    requirePositiveNumber(
      input.minQuantity ?? 1,
      'Minimum quantity'
    );

    if (
      !input.effectiveFrom.trim()
    ) {
      throw new Error(
        'Effective date is required'
      );
    }

    const { data, error } =
      await mavoraSupabase.rpc(
        'set_sales_product_price',
        {
          p_tenant_id:
            input.tenantId,

          p_price_list_id:
            input.priceListId,

          p_product_id:
            input.productId,

          p_unit_price:
            input.unitPrice,

          p_effective_from:
            input.effectiveFrom,

          p_min_quantity:
            input.minQuantity ??
            1,
        }
      );

    throwIfError(
      error,
      'Unable to set controlled Sales price'
    );

    return (
      data as MavoraSalesPriceMutationResult
    );
  };

/* =========================================================
 * CONTROLLED CUSTOMER MASTER RPC
 * ========================================================= */

export const loadMavoraSalesCustomers =
  async (
    input: LoadMavoraSalesCustomersInput
  ): Promise<MavoraSalesCustomerListResult> => {
    if (!input.tenantId) {
      throw new Error(
        'Sales customer tenant is required'
      );
    }

    const limit =
      input.limit ?? 50;

    const offset =
      input.offset ?? 0;

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 200
    ) {
      throw new Error(
        'Customer list limit must be between 1 and 200'
      );
    }

    if (
      !Number.isInteger(offset) ||
      offset < 0
    ) {
      throw new Error(
        'Customer list offset cannot be negative'
      );
    }

    const { data, error } =
      await mavoraSupabase.rpc(
        'list_sales_customers',
        {
          p_tenant_id:
            input.tenantId,

          p_limit:
            limit,

          p_offset:
            offset,

          p_search:
            input.search?.trim() ||
            null,

          p_is_active:
            input.isActive ??
            null,

          p_credit_enabled:
            input.creditEnabled ??
            null,
        }
      );

    throwIfError(
      error,
      'Unable to load controlled Customer Master'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid controlled Customer Master response'
      );
    }

    return (
      data as MavoraSalesCustomerListResult
    );
  };


export const loadMavoraSalesCustomer =
  async (
    tenantId: string,
    customerId: string
  ): Promise<MavoraSalesCustomerDetailResult> => {
    if (!tenantId) {
      throw new Error(
        'Sales customer tenant is required'
      );
    }

    if (!customerId) {
      throw new Error(
        'Sales Customer is required'
      );
    }

    const { data, error } =
      await mavoraSupabase.rpc(
        'get_sales_customer',
        {
          p_tenant_id:
            tenantId,

          p_customer_id:
            customerId,
        }
      );

    throwIfError(
      error,
      'Unable to load controlled Sales Customer'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid controlled Sales Customer response'
      );
    }

    return (
      data as MavoraSalesCustomerDetailResult
    );
  };


export const upsertMavoraSalesCustomer =
  async (
    input: UpsertMavoraSalesCustomerInput
  ): Promise<MavoraSalesCustomerMutationResult> => {
    const customerCode =
      input.customerCode.trim();

    const name =
      input.name.trim();

    if (!input.tenantId) {
      throw new Error(
        'Sales customer tenant is required'
      );
    }

    if (!customerCode) {
      throw new Error(
        'Customer Code is required'
      );
    }

    if (!name) {
      throw new Error(
        'Customer name is required'
      );
    }

    const { data, error } =
      await mavoraSupabase.rpc(
        'upsert_sales_customer',
        {
          p_tenant_id:
            input.tenantId,

          p_customer_code:
            customerCode,

          p_name:
            name,

          p_phone:
            input.phone?.trim() ||
            null,

          p_address:
            input.address?.trim() ||
            null,

          p_shop_type:
            input.shopType?.trim() ||
            null,

          p_gps:
            input.gps?.trim() ||
            null,

          p_is_active:
            input.isActive ??
            null,

          p_internal_note:
            input.internalNote?.trim() ||
            null,

          p_customer_id:
            input.customerId ??
            null,

          p_reason:
            input.reason?.trim() ||
            null,
        }
      );

    throwIfError(
      error,
      'Unable to save controlled Sales Customer'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid controlled Sales Customer mutation response'
      );
    }

    return (
      data as MavoraSalesCustomerMutationResult
    );
  };


export const setMavoraSalesCustomerCreditPolicy =
  async (
    input: SetMavoraSalesCustomerCreditPolicyInput
  ): Promise<MavoraSalesCustomerCreditPolicyResult> => {
    if (!input.tenantId) {
      throw new Error(
        'Sales customer tenant is required'
      );
    }

    if (!input.customerId) {
      throw new Error(
        'Sales Customer is required'
      );
    }

    requireNonNegativeNumber(
      input.creditLimit,
      'Customer credit limit'
    );

    if (
      !Number.isInteger(
        input.creditDays
      ) ||
      input.creditDays < 0 ||
      input.creditDays > 3650
    ) {
      throw new Error(
        'Customer credit days must be between 0 and 3650'
      );
    }

    const { data, error } =
      await mavoraSupabase.rpc(
        'set_sales_customer_credit_policy',
        {
          p_tenant_id:
            input.tenantId,

          p_customer_id:
            input.customerId,

          p_credit_enabled:
            input.creditEnabled,

          p_credit_limit:
            input.creditLimit,

          p_credit_days:
            input.creditDays,

          p_credit_hold:
            input.creditHold,

          p_reason:
            input.reason?.trim() ||
            null,
        }
      );

    throwIfError(
      error,
      'Unable to update controlled Customer Credit Policy'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid Customer Credit Policy response'
      );
    }

    return (
      data as MavoraSalesCustomerCreditPolicyResult
    );
  };


export const checkoutMavoraSalesOrder =
  async (
    input: CheckoutMavoraSalesOrderInput
  ): Promise<MavoraSalesCheckoutResult> => {
    const customerName =
      input.customerName.trim();

    const customerId =
      input.customerId?.trim() ||
      null;

    const invoiceRemark =
      input.invoiceRemark?.trim() ||
      null;

    if (
      !customerId &&
      !customerName
    ) {
      throw new Error(
        'Customer name is required'
      );
    }

    const paymentMethod =
      (
        input.paymentMethod ??
        'CASH'
      )
        .trim()
        .toUpperCase();

    if (
      paymentMethod === 'CREDIT' &&
      !customerId
    ) {
      throw new Error(
        'Customer Master selection is required for CREDIT Sales'
      );
    }

    if (
      invoiceRemark &&
      invoiceRemark.length > 500
    ) {
      throw new Error(
        'Invoice Remark cannot exceed 500 characters'
      );
    }

    if (
      !input.postingKey.trim()
    ) {
      throw new Error(
        'Sales posting key is required'
      );
    }

    if (
      !input.items.length
    ) {
      throw new Error(
        'At least one Sales item is required'
      );
    }

    input.items.forEach(
      (item) => {
        if (!item.productId) {
          throw new Error(
            'Product ID is required'
          );
        }

        requirePositiveNumber(
          item.quantity,
          'Sales quantity'
        );
      }
    );

    requireNonNegativeNumber(
      input.discountPercent ?? 0,
      'Discount percent'
    );

    requireNonNegativeNumber(
      input.taxPercent ?? 0,
      'Tax percent'
    );

    if (
      (input.discountPercent ?? 0) >
      100
    ) {
      throw new Error(
        'Discount percent cannot exceed 100'
      );
    }

    if (
      (input.taxPercent ?? 0) >
      100
    ) {
      throw new Error(
        'Tax percent cannot exceed 100'
      );
    }

    const { data, error } =
      await mavoraSupabase.rpc(
        'checkout_sales_order_v2',
        {
          p_tenant_id:
            input.tenantId,

          p_warehouse_id:
            input.warehouseId,

          p_posting_key:
            input.postingKey.trim(),

          p_customer_name:
            customerName,

          p_items:
            input.items.map(
              (item) => ({
                product_id:
                  item.productId,

                quantity:
                  item.quantity,
              })
            ),

          p_customer_id:
            customerId,

          p_invoice_remark:
            invoiceRemark,

          p_price_list_id:
            input.priceListId ??
            null,

          p_invoice_no:
            input.invoiceNo?.trim() ||
            null,

          p_customer_ref:
            input.customerRef?.trim() ||
            null,

          p_customer_phone:
            input.customerPhone?.trim() ||
            null,

          p_customer_shop_type:
            input.customerShopType?.trim() ||
            null,

          p_customer_address:
            input.customerAddress?.trim() ||
            null,

          p_customer_gps:
            input.customerGps?.trim() ||
            null,

          p_payment_method:
            paymentMethod,

          p_credit_terms:
            input.creditTerms?.trim() ||
            null,

          p_discount_percent:
            input.discountPercent ??
            0,

          p_tax_percent:
            input.taxPercent ??
            0,

          // Controlled checkout explicitly rejects client
          // backdating. Always let the server own sold_at.
          p_sold_at:
            null,
        }
      );

    throwIfError(
      error,
      'Unable to complete controlled Sales checkout'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid controlled Sales checkout response'
      );
    }

    return data as MavoraSalesCheckoutResult;
  };


/* =========================================================
 * CONTROLLED CUSTOMER RECEIVABLE RPC
 * ========================================================= */

export const loadMavoraCustomerReceivable =
  async (
    input: LoadMavoraCustomerReceivableInput
  ): Promise<MavoraCustomerReceivableResult> => {
    if (!input.tenantId) {
      throw new Error(
        'Receivable tenant is required'
      );
    }

    if (!input.customerId) {
      throw new Error(
        'Receivable Customer is required'
      );
    }

    const asOf =
      input.asOf?.trim() ||
      null;

    const { data, error } =
      await mavoraSupabase.rpc(
        'get_customer_receivable',
        {
          p_tenant_id:
            input.tenantId,

          p_customer_id:
            input.customerId,

          p_site_id:
            input.siteId ?? null,

          p_as_of:
            asOf,
        }
      );

    throwIfError(
      error,
      'Unable to load Customer Receivable'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid Customer Receivable response'
      );
    }

    return (
      data as MavoraCustomerReceivableResult
    );
  };


export const postMavoraReceivablePayment =
  async (
    input: PostMavoraReceivablePaymentInput
  ): Promise<MavoraReceivablePaymentResult> => {
    if (!input.tenantId) {
      throw new Error(
        'Payment tenant is required'
      );
    }

    if (!input.siteId) {
      throw new Error(
        'Payment Site is required'
      );
    }

    if (!input.customerId) {
      throw new Error(
        'Payment Customer is required'
      );
    }

    const postingKey =
      input.postingKey.trim();

    if (!postingKey) {
      throw new Error(
        'Payment posting key is required'
      );
    }

    requirePositiveNumber(
      input.amount,
      'Payment amount'
    );

    if (
      input.amount !==
      Number(
        input.amount.toFixed(6)
      )
    ) {
      throw new Error(
        'Payment amount cannot exceed 6 decimal places'
      );
    }

    if (!input.allocations.length) {
      throw new Error(
        'At least one invoice allocation is required'
      );
    }

    const seen =
      new Set<string>();

    let allocationTotal =
      0;

    input.allocations.forEach(
      (allocation) => {
        if (!allocation.salesOrderId) {
          throw new Error(
            'Payment allocation Sales Order is required'
          );
        }

        if (
          seen.has(
            allocation.salesOrderId
          )
        ) {
          throw new Error(
            'Duplicate invoice allocation is not allowed'
          );
        }

        seen.add(
          allocation.salesOrderId
        );

        requirePositiveNumber(
          allocation.allocatedAmount,
          'Payment allocation amount'
        );

        if (
          allocation.allocatedAmount !==
          Number(
            allocation.allocatedAmount.toFixed(
              6
            )
          )
        ) {
          throw new Error(
            'Payment allocation cannot exceed 6 decimal places'
          );
        }

        allocationTotal +=
          allocation.allocatedAmount;
      }
    );

    if (
      Number(
        allocationTotal.toFixed(6)
      ) !==
      Number(
        input.amount.toFixed(6)
      )
    ) {
      throw new Error(
        'Payment amount must equal the total invoice allocation'
      );
    }

    const referenceNo =
      input.referenceNo?.trim() ||
      null;

    const note =
      input.note?.trim() ||
      null;

    const { data, error } =
      await mavoraSupabase.rpc(
        'post_receivable_payment',
        {
          p_tenant_id:
            input.tenantId,

          p_site_id:
            input.siteId,

          p_customer_id:
            input.customerId,

          p_posting_key:
            postingKey,

          p_payment_method:
            input.paymentMethod,

          p_amount:
            input.amount,

          p_allocations:
            input.allocations.map(
              (allocation) => ({
                sales_order_id:
                  allocation.salesOrderId,

                allocated_amount:
                  allocation.allocatedAmount,
              })
            ),

          p_reference_no:
            referenceNo,

          p_note:
            note,

          // Server owns the time when null.
          p_received_at:
            input.receivedAt ?? null,
        }
      );

    throwIfError(
      error,
      'Unable to post Receivable Payment'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid Receivable Payment response'
      );
    }

    return (
      data as MavoraReceivablePaymentResult
    );
  };


/* =========================================================
 * CONTROLLED SALES HISTORY / INVOICE
 * Phase 2P-6N-4D UI service layer
 * ========================================================= */

export interface MavoraSalesHistoryWarehouse {
  id: string;
  site_id: string;
  code: string;
  name: string;
  timezone: string;
}

export interface MavoraSalesHistoryOrder {
  sales_order_id: string;
  invoice_no: string;

  customer_id: string | null;
  invoice_remark: string | null;

  customer_ref: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_shop_type: string | null;
  customer_address: string | null;
  customer_gps: string | null;

  payment_method: string;
  credit_terms: string | null;
  is_paid: boolean;
  status: string;

  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  grand_total: number;

  price_list_id: string | null;
  price_list_code: string | null;
  price_list_name: string | null;
  currency_code: string | null;

  line_count: number;
  total_quantity: number;

  sold_at: string;
  created_at: string;
}

export interface MavoraSalesHistoryResult {
  ok: boolean;

  warehouse: MavoraSalesHistoryWarehouse;

  filters: {
    search: string | null;
    from_date: string | null;
    to_date: string | null;
  };

  limit: number;
  offset: number;
  total_count: number;

  orders: MavoraSalesHistoryOrder[];
}

export interface LoadMavoraSalesHistoryInput {
  tenantId: string;
  warehouseId: string;

  limit?: number;
  offset?: number;

  search?: string | null;

  fromDate?: string | null;
  toDate?: string | null;
}

export interface MavoraSalesInvoiceAllocation {
  allocation_id: string;

  lot_id: string | null;
  lot_no: string | null;
  batch_no: string | null;

  manufactured_at: string | null;
  expires_at: string | null;

  quantity: number;

  inventory_movement_id: string;
}

export interface MavoraSalesInvoiceProduct {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;

  tracking_mode: MavoraSalesTrackingMode;

  unit_code: string;
  unit_symbol: string | null;
}

export interface MavoraSalesInvoiceLine {
  line_id: string;
  line_no: number;

  product: MavoraSalesInvoiceProduct;

  quantity: number;
  unit_price: number;

  discount_amount: number;
  tax_amount: number;
  line_total: number;

  allocations: MavoraSalesInvoiceAllocation[];
}

export interface MavoraSalesInvoiceOrder {
  sales_order_id: string;
  invoice_no: string;
  status: string;

  customer_id: string | null;
  invoice_remark: string | null;

  customer_ref: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_shop_type: string | null;
  customer_address: string | null;
  customer_gps: string | null;

  payment_method: string;
  credit_terms: string | null;
  is_paid: boolean;

  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  grand_total: number;

  sold_at: string;
  created_at: string;
  sold_by: string;

  warehouse: MavoraSalesHistoryWarehouse;

  price_list: {
    id: string | null;
    code: string | null;
    name: string | null;
    currency_code: string | null;
  };
}

export interface MavoraSalesInvoiceDetail {
  ok: boolean;

  order: MavoraSalesInvoiceOrder;

  lines: MavoraSalesInvoiceLine[];
}

export const loadMavoraSalesHistory =
  async (
    input: LoadMavoraSalesHistoryInput
  ): Promise<MavoraSalesHistoryResult> => {
    if (!input.tenantId) {
      throw new Error(
        'Sales tenant is required'
      );
    }

    if (!input.warehouseId) {
      throw new Error(
        'Sales warehouse is required'
      );
    }

    const limit =
      input.limit ?? 50;

    const offset =
      input.offset ?? 0;

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 200
    ) {
      throw new Error(
        'Sales History limit must be between 1 and 200'
      );
    }

    if (
      !Number.isInteger(offset) ||
      offset < 0
    ) {
      throw new Error(
        'Sales History offset cannot be negative'
      );
    }

    const search =
      input.search?.trim() ||
      null;

    const fromDate =
      input.fromDate?.trim() ||
      null;

    const toDate =
      input.toDate?.trim() ||
      null;

    const { data, error } =
      await mavoraSupabase.rpc(
        'get_sales_history',
        {
          p_tenant_id:
            input.tenantId,

          p_warehouse_id:
            input.warehouseId,

          p_limit:
            limit,

          p_offset:
            offset,

          p_search:
            search,

          p_from_date:
            fromDate,

          p_to_date:
            toDate,
        }
      );

    throwIfError(
      error,
      'Unable to load controlled Sales History'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid controlled Sales History response'
      );
    }

    return data as MavoraSalesHistoryResult;
  };

export const loadMavoraSalesInvoiceDetail =
  async (
    tenantId: string,
    salesOrderId: string
  ): Promise<MavoraSalesInvoiceDetail> => {
    if (!tenantId) {
      throw new Error(
        'Sales tenant is required'
      );
    }

    if (!salesOrderId) {
      throw new Error(
        'Sales Order is required'
      );
    }

    const { data, error } =
      await mavoraSupabase.rpc(
        'get_sales_invoice_detail',
        {
          p_tenant_id:
            tenantId,

          p_sales_order_id:
            salesOrderId,
        }
      );

    throwIfError(
      error,
      'Unable to load controlled Sales Invoice'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid controlled Sales Invoice response'
      );
    }

    return data as MavoraSalesInvoiceDetail;
  };

/* =========================================================
 * PHASE 2P-6N-7 — CUSTOMER CRM / PRIVATE MEDIA CLIENT
 *
 * Existing Customer Master / Checkout functions above remain
 * backward compatible.
 *
 * Storage contract:
 *   bucket: mavora-media
 *   customer:
 *     <tenant>/customers/<customer>/<uuid>.<ext>
 *   product:
 *     <tenant>/products/<product>/<uuid>.<ext>
 *
 * No public URL is created here.
 * ========================================================= */

export type MavoraCustomerGpsSource =
  | 'device'
  | 'manual'
  | 'imported';

export type MavoraCustomerActivityType =
  | 'visit'
  | 'call'
  | 'message'
  | 'follow_up'
  | 'note'
  | 'collection'
  | 'other';

export type MavoraCustomerMediaKind =
  | 'profile'
  | 'shop_front'
  | 'shop_inside'
  | 'other';

export type MavoraProductMediaKind =
  | 'product'
  | 'packaging'
  | 'label'
  | 'other';

export interface MavoraSalesCustomerCrm {
  id: string;
  tenant_id: string;

  customer_code: string;
  name: string;

  phone: string | null;
  address: string | null;
  shop_type: string | null;
  gps: string | null;

  is_active: boolean;

  credit_enabled: boolean;
  credit_limit: number;
  credit_days: number;
  credit_hold: boolean;

  internal_note: string | null;

  contact_person: string | null;
  email: string | null;
  township: string | null;
  area: string | null;
  route_code: string | null;
  customer_segment: string | null;
  assigned_sales_user_id: string | null;

  latitude: number | null;
  longitude: number | null;
  gps_accuracy_m: number | null;
  gps_source: MavoraCustomerGpsSource | null;
  gps_captured_at: string | null;

  created_by: string | null;
  updated_by: string | null;

  created_at: string;
  updated_at: string;
}

export interface MavoraSalesCustomerCrmResult {
  ok: boolean;
  customer: MavoraSalesCustomerCrm;
}

export interface UpdateMavoraSalesCustomerCrmInput {
  tenantId: string;
  customerId: string;

  contactPerson?: string | null;
  email?: string | null;
  township?: string | null;
  area?: string | null;
  routeCode?: string | null;
  customerSegment?: string | null;

  assignedSalesUserId?: string | null;

  latitude?: number | null;
  longitude?: number | null;
  gpsAccuracyM?: number | null;

  gpsSource?: MavoraCustomerGpsSource | null;
  gpsCapturedAt?: string | null;
}

export interface MavoraSalesCustomerActivity {
  activity_id: string;
  activity_type: MavoraCustomerActivityType;

  subject: string | null;
  note: string | null;
  outcome: string | null;

  occurred_at: string;
  next_follow_up_at: string | null;

  latitude: number | null;
  longitude: number | null;
  gps_accuracy_m: number | null;

  created_by: string | null;
  created_at: string;
}

export interface MavoraSalesCustomerActivityListResult {
  ok: boolean;
  customer_id: string;

  items: MavoraSalesCustomerActivity[];

  limit: number;
  offset: number;
}

export interface AddMavoraSalesCustomerActivityInput {
  tenantId: string;
  customerId: string;

  activityType: MavoraCustomerActivityType;

  subject?: string | null;
  note?: string | null;
  outcome?: string | null;

  occurredAt?: string | null;
  nextFollowUpAt?: string | null;

  latitude?: number | null;
  longitude?: number | null;
  gpsAccuracyM?: number | null;
}

export interface MavoraSalesCustomerActivityResult {
  ok: boolean;
  activity: MavoraSalesCustomerActivity;
}

export interface MavoraSalesCustomerMedia {
  media_id: string;

  media_kind: MavoraCustomerMediaKind;

  storage_bucket: string;
  object_path: string;

  original_file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;

  caption: string | null;

  is_primary: boolean;
  sort_order: number;

  captured_at: string | null;

  latitude: number | null;
  longitude: number | null;
  gps_accuracy_m: number | null;

  uploaded_by: string | null;

  created_at: string;
  updated_at: string;
}

export interface MavoraSalesCustomerMediaListResult {
  ok: boolean;
  customer_id: string;
  items: MavoraSalesCustomerMedia[];
}

export interface RegisterMavoraSalesCustomerMediaInput {
  tenantId: string;
  customerId: string;

  mediaKind: MavoraCustomerMediaKind;
  objectPath: string;

  originalFileName?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;

  caption?: string | null;

  isPrimary?: boolean;
  sortOrder?: number;

  capturedAt?: string | null;

  latitude?: number | null;
  longitude?: number | null;
  gpsAccuracyM?: number | null;
}

export interface MavoraSalesCustomerMediaResult {
  ok: boolean;
  media: MavoraSalesCustomerMedia;
}

export interface MavoraProductMedia {
  media_id: string;
  product_id: string;

  media_kind: MavoraProductMediaKind;

  storage_bucket: string;
  object_path: string;

  original_file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;

  caption: string | null;

  is_primary: boolean;
  sort_order: number;

  uploaded_by: string | null;

  created_at: string;
  updated_at: string;
}

export interface MavoraProductMediaListResult {
  ok: boolean;
  items: MavoraProductMedia[];
}

export interface RegisterMavoraProductMediaInput {
  tenantId: string;
  productId: string;

  mediaKind: MavoraProductMediaKind;
  objectPath: string;

  originalFileName?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;

  caption?: string | null;

  isPrimary?: boolean;
  sortOrder?: number;
}

export interface MavoraProductMediaResult {
  ok: boolean;
  media: MavoraProductMedia;
}

export interface MavoraMediaRemoveResult {
  ok: boolean;

  media_id: string;

  storage_bucket: string;
  object_path: string;
}

export interface UploadMavoraCustomerMediaInput {
  tenantId: string;
  customerId: string;

  file: File;

  mediaKind: MavoraCustomerMediaKind;

  caption?: string | null;

  isPrimary?: boolean;
  sortOrder?: number;

  capturedAt?: string | null;

  latitude?: number | null;
  longitude?: number | null;
  gpsAccuracyM?: number | null;
}

export interface UploadMavoraProductMediaInput {
  tenantId: string;
  productId: string;

  file: File;

  mediaKind?: MavoraProductMediaKind;

  caption?: string | null;

  isPrimary?: boolean;
  sortOrder?: number;
}

export const MAVORA_MEDIA_BUCKET =
  'mavora-media';

const MAVORA_MEDIA_MAX_BYTES =
  20 * 1024 * 1024;

const MAVORA_MEDIA_ALLOWED_TYPES =
  new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/heic',
    'image/heif',
  ]);

const requireMavoraMediaFile = (
  file: File
) => {
  if (!file) {
    throw new Error(
      'Image file is required'
    );
  }

  if (
    !MAVORA_MEDIA_ALLOWED_TYPES.has(
      file.type
    )
  ) {
    throw new Error(
      `Unsupported image type: ${
        file.type || 'unknown'
      }`
    );
  }

  if (
    file.size <= 0 ||
    file.size >
      MAVORA_MEDIA_MAX_BYTES
  ) {
    throw new Error(
      'Image must be greater than 0 bytes and not exceed 20 MB'
    );
  }
};

const mavoraMediaExtension = (
  mimeType: string
): string => {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';

    case 'image/png':
      return 'png';

    case 'image/webp':
      return 'webp';

    case 'image/avif':
      return 'avif';

    case 'image/heic':
      return 'heic';

    case 'image/heif':
      return 'heif';

    default:
      throw new Error(
        `Unsupported image type: ${mimeType}`
      );
  }
};

const createMavoraMediaObjectId =
  (): string => {
    if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID ===
        'function'
    ) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;
  };

const buildMavoraMediaObjectPath = (
  tenantId: string,
  scope: 'customers' | 'products',
  entityId: string,
  mimeType: string
): string => {
  if (!tenantId) {
    throw new Error(
      'Media tenant is required'
    );
  }

  if (!entityId) {
    throw new Error(
      'Media entity is required'
    );
  }

  return [
    tenantId,
    scope,
    entityId,
    `${createMavoraMediaObjectId()}.${mavoraMediaExtension(
      mimeType
    )}`,
  ].join('/');
};

export const loadMavoraSalesCustomerCrm =
  async (
    tenantId: string,
    customerId: string
  ): Promise<MavoraSalesCustomerCrmResult> => {
    if (!tenantId) {
      throw new Error(
        'Sales customer tenant is required'
      );
    }

    if (!customerId) {
      throw new Error(
        'Customer is required'
      );
    }

    const { data, error } =
      await mavoraSupabase.rpc(
        'get_sales_customer_crm',
        {
          p_tenant_id:
            tenantId,

          p_customer_id:
            customerId,
        }
      );

    throwIfError(
      error,
      'Unable to load Customer CRM'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid Customer CRM response'
      );
    }

    return data as MavoraSalesCustomerCrmResult;
  };

export const updateMavoraSalesCustomerCrm =
  async (
    input: UpdateMavoraSalesCustomerCrmInput
  ): Promise<MavoraSalesCustomerCrmResult> => {
    if (!input.tenantId) {
      throw new Error(
        'Sales customer tenant is required'
      );
    }

    if (!input.customerId) {
      throw new Error(
        'Customer is required'
      );
    }

    const hasLatitude =
      input.latitude !== undefined &&
      input.latitude !== null;

    const hasLongitude =
      input.longitude !== undefined &&
      input.longitude !== null;

    if (
      hasLatitude !==
      hasLongitude
    ) {
      throw new Error(
        'Latitude and longitude must be supplied together'
      );
    }

    const { data, error } =
      await mavoraSupabase.rpc(
        'update_sales_customer_crm',
        {
          p_tenant_id:
            input.tenantId,

          p_customer_id:
            input.customerId,

          p_contact_person:
            input.contactPerson?.trim() ||
            null,

          p_email:
            input.email?.trim() ||
            null,

          p_township:
            input.township?.trim() ||
            null,

          p_area:
            input.area?.trim() ||
            null,

          p_route_code:
            input.routeCode?.trim() ||
            null,

          p_customer_segment:
            input.customerSegment?.trim() ||
            null,

          p_assigned_sales_user_id:
            input.assignedSalesUserId ??
            null,

          p_latitude:
            input.latitude ??
            null,

          p_longitude:
            input.longitude ??
            null,

          p_gps_accuracy_m:
            input.gpsAccuracyM ??
            null,

          p_gps_source:
            input.gpsSource ??
            null,

          p_gps_captured_at:
            input.gpsCapturedAt ??
            null,
        }
      );

    throwIfError(
      error,
      'Unable to update Customer CRM'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid Customer CRM update response'
      );
    }

    return data as MavoraSalesCustomerCrmResult;
  };

export const loadMavoraSalesCustomerActivities =
  async (
    tenantId: string,
    customerId: string,
    limit = 100,
    offset = 0
  ): Promise<MavoraSalesCustomerActivityListResult> => {
    if (!tenantId) {
      throw new Error(
        'Sales customer tenant is required'
      );
    }

    if (!customerId) {
      throw new Error(
        'Customer is required'
      );
    }

    const { data, error } =
      await mavoraSupabase.rpc(
        'list_sales_customer_activities',
        {
          p_tenant_id:
            tenantId,

          p_customer_id:
            customerId,

          p_limit:
            limit,

          p_offset:
            offset,
        }
      );

    throwIfError(
      error,
      'Unable to load Customer CRM activities'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid Customer CRM activity response'
      );
    }

    return data as MavoraSalesCustomerActivityListResult;
  };

export const addMavoraSalesCustomerActivity =
  async (
    input: AddMavoraSalesCustomerActivityInput
  ): Promise<MavoraSalesCustomerActivityResult> => {
    if (!input.tenantId) {
      throw new Error(
        'Sales customer tenant is required'
      );
    }

    if (!input.customerId) {
      throw new Error(
        'Customer is required'
      );
    }

    const { data, error } =
      await mavoraSupabase.rpc(
        'add_sales_customer_activity',
        {
          p_tenant_id:
            input.tenantId,

          p_customer_id:
            input.customerId,

          p_activity_type:
            input.activityType,

          p_subject:
            input.subject?.trim() ||
            null,

          p_note:
            input.note?.trim() ||
            null,

          p_outcome:
            input.outcome?.trim() ||
            null,

          p_occurred_at:
            input.occurredAt ??
            null,

          p_next_follow_up_at:
            input.nextFollowUpAt ??
            null,

          p_latitude:
            input.latitude ??
            null,

          p_longitude:
            input.longitude ??
            null,

          p_gps_accuracy_m:
            input.gpsAccuracyM ??
            null,
        }
      );

    throwIfError(
      error,
      'Unable to add Customer CRM activity'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid Customer CRM activity response'
      );
    }

    return data as MavoraSalesCustomerActivityResult;
  };

export const loadMavoraSalesCustomerMedia =
  async (
    tenantId: string,
    customerId: string
  ): Promise<MavoraSalesCustomerMediaListResult> => {
    if (!tenantId) {
      throw new Error(
        'Sales customer tenant is required'
      );
    }

    if (!customerId) {
      throw new Error(
        'Customer is required'
      );
    }

    const { data, error } =
      await mavoraSupabase.rpc(
        'list_sales_customer_media',
        {
          p_tenant_id:
            tenantId,

          p_customer_id:
            customerId,
        }
      );

    throwIfError(
      error,
      'Unable to load Customer media'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid Customer media response'
      );
    }

    return data as MavoraSalesCustomerMediaListResult;
  };

export const registerMavoraSalesCustomerMedia =
  async (
    input: RegisterMavoraSalesCustomerMediaInput
  ): Promise<MavoraSalesCustomerMediaResult> => {
    const { data, error } =
      await mavoraSupabase.rpc(
        'register_sales_customer_media',
        {
          p_tenant_id:
            input.tenantId,

          p_customer_id:
            input.customerId,

          p_media_kind:
            input.mediaKind,

          p_object_path:
            input.objectPath,

          p_original_file_name:
            input.originalFileName?.trim() ||
            null,

          p_mime_type:
            input.mimeType?.trim() ||
            null,

          p_file_size_bytes:
            input.fileSizeBytes ??
            null,

          p_caption:
            input.caption?.trim() ||
            null,

          p_is_primary:
            input.isPrimary ??
            false,

          p_sort_order:
            input.sortOrder ??
            0,

          p_captured_at:
            input.capturedAt ??
            null,

          p_latitude:
            input.latitude ??
            null,

          p_longitude:
            input.longitude ??
            null,

          p_gps_accuracy_m:
            input.gpsAccuracyM ??
            null,
        }
      );

    throwIfError(
      error,
      'Unable to register Customer media'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid Customer media registration response'
      );
    }

    return data as MavoraSalesCustomerMediaResult;
  };

export const removeMavoraSalesCustomerMediaMetadata =
  async (
    tenantId: string,
    mediaId: string
  ): Promise<MavoraMediaRemoveResult> => {
    const { data, error } =
      await mavoraSupabase.rpc(
        'remove_sales_customer_media',
        {
          p_tenant_id:
            tenantId,

          p_media_id:
            mediaId,
        }
      );

    throwIfError(
      error,
      'Unable to remove Customer media metadata'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid Customer media removal response'
      );
    }

    return data as MavoraMediaRemoveResult;
  };

export const loadMavoraProductMedia =
  async (
    tenantId: string,
    productId?: string | null,
    primaryOnly = false,
    limit = 500
  ): Promise<MavoraProductMediaListResult> => {
    if (!tenantId) {
      throw new Error(
        'Product media tenant is required'
      );
    }

    const { data, error } =
      await mavoraSupabase.rpc(
        'list_product_media',
        {
          p_tenant_id:
            tenantId,

          p_product_id:
            productId ||
            null,

          p_primary_only:
            primaryOnly,

          p_limit:
            limit,
        }
      );

    throwIfError(
      error,
      'Unable to load Product media'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid Product media response'
      );
    }

    return data as MavoraProductMediaListResult;
  };

export const registerMavoraProductMedia =
  async (
    input: RegisterMavoraProductMediaInput
  ): Promise<MavoraProductMediaResult> => {
    const { data, error } =
      await mavoraSupabase.rpc(
        'register_product_media',
        {
          p_tenant_id:
            input.tenantId,

          p_product_id:
            input.productId,

          p_media_kind:
            input.mediaKind,

          p_object_path:
            input.objectPath,

          p_original_file_name:
            input.originalFileName?.trim() ||
            null,

          p_mime_type:
            input.mimeType?.trim() ||
            null,

          p_file_size_bytes:
            input.fileSizeBytes ??
            null,

          p_caption:
            input.caption?.trim() ||
            null,

          p_is_primary:
            input.isPrimary ??
            false,

          p_sort_order:
            input.sortOrder ??
            0,
        }
      );

    throwIfError(
      error,
      'Unable to register Product media'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid Product media registration response'
      );
    }

    return data as MavoraProductMediaResult;
  };

export const removeMavoraProductMediaMetadata =
  async (
    tenantId: string,
    mediaId: string
  ): Promise<MavoraMediaRemoveResult> => {
    const { data, error } =
      await mavoraSupabase.rpc(
        'remove_product_media',
        {
          p_tenant_id:
            tenantId,

          p_media_id:
            mediaId,
        }
      );

    throwIfError(
      error,
      'Unable to remove Product media metadata'
    );

    if (
      !data ||
      typeof data !== 'object'
    ) {
      throw new Error(
        'Invalid Product media removal response'
      );
    }

    return data as MavoraMediaRemoveResult;
  };

export const createMavoraPrivateMediaSignedUrl =
  async (
    objectPath: string,
    expiresInSeconds = 3600
  ): Promise<string> => {
    if (!objectPath) {
      throw new Error(
        'Media object path is required'
      );
    }

    const { data, error } =
      await mavoraSupabase.storage
        .from(
          MAVORA_MEDIA_BUCKET
        )
        .createSignedUrl(
          objectPath,
          expiresInSeconds
        );

    throwIfError(
      error,
      'Unable to create private media URL'
    );

    if (!data?.signedUrl) {
      throw new Error(
        'Invalid private media URL response'
      );
    }

    return data.signedUrl;
  };

const uploadMavoraPrivateMediaObject =
  async (
    objectPath: string,
    file: File
  ): Promise<void> => {
    requireMavoraMediaFile(
      file
    );

    const { error } =
      await mavoraSupabase.storage
        .from(
          MAVORA_MEDIA_BUCKET
        )
        .upload(
          objectPath,
          file,
          {
            cacheControl:
              '3600',

            contentType:
              file.type,

            upsert:
              false,
          }
        );

    throwIfError(
      error,
      'Unable to upload private media'
    );
  };

const deleteMavoraPrivateMediaObject =
  async (
    objectPath: string
  ): Promise<void> => {
    if (!objectPath) {
      return;
    }

    const { error } =
      await mavoraSupabase.storage
        .from(
          MAVORA_MEDIA_BUCKET
        )
        .remove([
          objectPath,
        ]);

    throwIfError(
      error,
      'Unable to remove private media object'
    );
  };

export const uploadMavoraSalesCustomerMedia =
  async (
    input: UploadMavoraCustomerMediaInput
  ): Promise<MavoraSalesCustomerMediaResult> => {
    requireMavoraMediaFile(
      input.file
    );

    const objectPath =
      buildMavoraMediaObjectPath(
        input.tenantId,
        'customers',
        input.customerId,
        input.file.type
      );

    await uploadMavoraPrivateMediaObject(
      objectPath,
      input.file
    );

    try {
      return await registerMavoraSalesCustomerMedia(
        {
          tenantId:
            input.tenantId,

          customerId:
            input.customerId,

          mediaKind:
            input.mediaKind,

          objectPath,

          originalFileName:
            input.file.name
              .slice(
                0,
                255
              ),

          mimeType:
            input.file.type,

          fileSizeBytes:
            input.file.size,

          caption:
            input.caption,

          isPrimary:
            input.isPrimary,

          sortOrder:
            input.sortOrder,

          capturedAt:
            input.capturedAt,

          latitude:
            input.latitude,

          longitude:
            input.longitude,

          gpsAccuracyM:
            input.gpsAccuracyM,
        }
      );
    } catch (error) {
      try {
        await deleteMavoraPrivateMediaObject(
          objectPath
        );
      } catch {
        // Best-effort orphan cleanup only.
      }

      throw error;
    }
  };

export const uploadMavoraProductMedia =
  async (
    input: UploadMavoraProductMediaInput
  ): Promise<MavoraProductMediaResult> => {
    requireMavoraMediaFile(
      input.file
    );

    const objectPath =
      buildMavoraMediaObjectPath(
        input.tenantId,
        'products',
        input.productId,
        input.file.type
      );

    await uploadMavoraPrivateMediaObject(
      objectPath,
      input.file
    );

    try {
      return await registerMavoraProductMedia(
        {
          tenantId:
            input.tenantId,

          productId:
            input.productId,

          mediaKind:
            input.mediaKind ??
            'product',

          objectPath,

          originalFileName:
            input.file.name
              .slice(
                0,
                255
              ),

          mimeType:
            input.file.type,

          fileSizeBytes:
            input.file.size,

          caption:
            input.caption,

          isPrimary:
            input.isPrimary,

          sortOrder:
            input.sortOrder,
        }
      );
    } catch (error) {
      try {
        await deleteMavoraPrivateMediaObject(
          objectPath
        );
      } catch {
        // Best-effort orphan cleanup only.
      }

      throw error;
    }
  };

export const deleteMavoraSalesCustomerMedia =
  async (
    tenantId: string,
    media: MavoraSalesCustomerMedia
  ): Promise<MavoraMediaRemoveResult> => {
    await deleteMavoraPrivateMediaObject(
      media.object_path
    );

    return removeMavoraSalesCustomerMediaMetadata(
      tenantId,
      media.media_id
    );
  };

export const deleteMavoraProductMedia =
  async (
    tenantId: string,
    media: MavoraProductMedia
  ): Promise<MavoraMediaRemoveResult> => {
    await deleteMavoraPrivateMediaObject(
      media.object_path
    );

    return removeMavoraProductMediaMetadata(
      tenantId,
      media.media_id
    );
  };
