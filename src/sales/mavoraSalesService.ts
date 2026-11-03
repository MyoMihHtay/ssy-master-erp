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

export interface CheckoutMavoraSalesOrderInput {
  tenantId: string;
  warehouseId: string;

  postingKey: string;

  customerName: string;

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

  movement_group_id: string | null;

  lines: MavoraSalesCheckoutLineResult[];
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

export const checkoutMavoraSalesOrder =
  async (
    input: CheckoutMavoraSalesOrderInput
  ): Promise<MavoraSalesCheckoutResult> => {
    const customerName =
      input.customerName.trim();

    if (!customerName) {
      throw new Error(
        'Customer name is required'
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
        'checkout_sales_order',
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
            (
              input.paymentMethod ??
              'CASH'
            )
              .trim()
              .toUpperCase(),

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
