import { mavoraSupabase } from '../mavoraSupabase';

export interface MavoraManufacturingCostOverviewItem {
  product_id: string;
  sku: string;
  name: string;
  product_type: 'SFG' | 'FG';

  currency_code: string | null;

  latest_actual_unit_cost: number | null;
  latest_actual_cost_order_no: string | null;
  latest_actual_cost_finalized_at: string | null;

  policy_id: string | null;
  policy_version_no: number | null;

  standard_unit_cost: number | null;
  minimum_margin_pct: number | null;
  minimum_allowed_price: number | null;

  factory_selling_price: number | null;
  distributor_transfer_price: number | null;
  wholesale_transfer_price: number | null;

  standard_vs_actual_variance: number | null;
  standard_vs_actual_variance_pct: number | null;

  factory_margin_pct: number | null;
  distributor_margin_pct: number | null;
  wholesale_margin_pct: number | null;

  policy_effective_from: string | null;
}

export interface MavoraManufacturingCostOverview {
  ok: true;
  items: MavoraManufacturingCostOverviewItem[];
}

export interface UpsertManufacturingCostPolicyInput {
  tenantId: string;
  productId: string;

  standardUnitCost: number;
  minimumMarginPct: number;

  currencyCode?: string;

  factorySellingPrice?: number | null;
  distributorTransferPrice?: number | null;
  wholesaleTransferPrice?: number | null;

  reason?: string | null;
}

export interface UpsertManufacturingCostPolicyResult {
  ok: true;

  policy_id: string;
  product_id: string;
  product_sku: string;
  product_name: string;

  version_no: number;

  currency_code: string;

  standard_unit_cost: number;
  minimum_margin_pct: number;
  minimum_allowed_price: number;

  factory_selling_price: number | null;
  distributor_transfer_price: number | null;
  wholesale_transfer_price: number | null;

  effective_from: string;
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

const numberOrNull = (
  value: unknown
): number | null => {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
};

const requiredNumber = (
  value: unknown,
  field: string
): number => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(
      `${field} returned an invalid number`
    );
  }

  return parsed;
};

const normalizeOverviewItem = (
  value: unknown
): MavoraManufacturingCostOverviewItem => {
  const item =
    (value || {}) as Record<string, unknown>;

  return {
    product_id:
      String(item.product_id || ''),

    sku:
      String(item.sku || ''),

    name:
      String(item.name || ''),

    product_type:
      item.product_type === 'SFG'
        ? 'SFG'
        : 'FG',

    currency_code:
      item.currency_code
        ? String(item.currency_code)
        : null,

    latest_actual_unit_cost:
      numberOrNull(
        item.latest_actual_unit_cost
      ),

    latest_actual_cost_order_no:
      item.latest_actual_cost_order_no
        ? String(
            item.latest_actual_cost_order_no
          )
        : null,

    latest_actual_cost_finalized_at:
      item.latest_actual_cost_finalized_at
        ? String(
            item.latest_actual_cost_finalized_at
          )
        : null,

    policy_id:
      item.policy_id
        ? String(item.policy_id)
        : null,

    policy_version_no:
      numberOrNull(
        item.policy_version_no
      ),

    standard_unit_cost:
      numberOrNull(
        item.standard_unit_cost
      ),

    minimum_margin_pct:
      numberOrNull(
        item.minimum_margin_pct
      ),

    minimum_allowed_price:
      numberOrNull(
        item.minimum_allowed_price
      ),

    factory_selling_price:
      numberOrNull(
        item.factory_selling_price
      ),

    distributor_transfer_price:
      numberOrNull(
        item.distributor_transfer_price
      ),

    wholesale_transfer_price:
      numberOrNull(
        item.wholesale_transfer_price
      ),

    standard_vs_actual_variance:
      numberOrNull(
        item.standard_vs_actual_variance
      ),

    standard_vs_actual_variance_pct:
      numberOrNull(
        item.standard_vs_actual_variance_pct
      ),

    factory_margin_pct:
      numberOrNull(
        item.factory_margin_pct
      ),

    distributor_margin_pct:
      numberOrNull(
        item.distributor_margin_pct
      ),

    wholesale_margin_pct:
      numberOrNull(
        item.wholesale_margin_pct
      ),

    policy_effective_from:
      item.policy_effective_from
        ? String(
            item.policy_effective_from
          )
        : null,
  };
};

export const loadManufacturingCostOverview =
  async (
    tenantId: string
  ): Promise<MavoraManufacturingCostOverview> => {
    if (!tenantId) {
      throw new Error(
        'Tenant is required'
      );
    }

    const { data, error } =
      await mavoraSupabase.rpc(
        'list_manufacturing_cost_overview',
        {
          p_tenant_id: tenantId,
        }
      );

    throwIfError(
      error,
      'Unable to load Manufacturing Cost overview'
    );

    const payload =
      data as {
        ok?: unknown;
        items?: unknown;
      } | null;

    if (
      !payload ||
      payload.ok !== true ||
      !Array.isArray(payload.items)
    ) {
      throw new Error(
        'Manufacturing Cost overview returned an invalid result'
      );
    }

    return {
      ok: true,
      items:
        payload.items.map(
          normalizeOverviewItem
        ),
    };
  };

export const upsertManufacturingCostPolicy =
  async (
    input: UpsertManufacturingCostPolicyInput
  ): Promise<UpsertManufacturingCostPolicyResult> => {
    if (!input.tenantId) {
      throw new Error(
        'Tenant is required'
      );
    }

    if (!input.productId) {
      throw new Error(
        'Product is required'
      );
    }

    if (
      !Number.isFinite(
        input.standardUnitCost
      ) ||
      input.standardUnitCost < 0
    ) {
      throw new Error(
        'Standard Unit Cost cannot be negative'
      );
    }

    if (
      !Number.isFinite(
        input.minimumMarginPct
      ) ||
      input.minimumMarginPct < 0 ||
      input.minimumMarginPct >= 100
    ) {
      throw new Error(
        'Minimum Margin must be between 0 and less than 100 percent'
      );
    }

    const { data, error } =
      await mavoraSupabase.rpc(
        'upsert_manufacturing_cost_policy',
        {
          p_tenant_id:
            input.tenantId,

          p_product_id:
            input.productId,

          p_standard_unit_cost:
            input.standardUnitCost,

          p_minimum_margin_pct:
            input.minimumMarginPct,

          p_currency_code:
            input.currencyCode ||
            'MMK',

          p_factory_selling_price:
            input.factorySellingPrice ??
            null,

          p_distributor_transfer_price:
            input.distributorTransferPrice ??
            null,

          p_wholesale_transfer_price:
            input.wholesaleTransferPrice ??
            null,

          p_reason:
            input.reason?.trim() ||
            null,
        }
      );

    throwIfError(
      error,
      'Unable to save Manufacturing Cost Policy'
    );

    const result =
      data as Record<
        string,
        unknown
      > | null;

    if (
      !result ||
      result.ok !== true ||
      !result.policy_id ||
      !result.product_id
    ) {
      throw new Error(
        'Manufacturing Cost Policy returned an invalid result'
      );
    }

    return {
      ok: true,

      policy_id:
        String(result.policy_id),

      product_id:
        String(result.product_id),

      product_sku:
        String(
          result.product_sku || ''
        ),

      product_name:
        String(
          result.product_name || ''
        ),

      version_no:
        requiredNumber(
          result.version_no,
          'Policy Version'
        ),

      currency_code:
        String(
          result.currency_code ||
          'MMK'
        ),

      standard_unit_cost:
        requiredNumber(
          result.standard_unit_cost,
          'Standard Unit Cost'
        ),

      minimum_margin_pct:
        requiredNumber(
          result.minimum_margin_pct,
          'Minimum Margin'
        ),

      minimum_allowed_price:
        requiredNumber(
          result.minimum_allowed_price,
          'Minimum Allowed Price'
        ),

      factory_selling_price:
        numberOrNull(
          result.factory_selling_price
        ),

      distributor_transfer_price:
        numberOrNull(
          result.distributor_transfer_price
        ),

      wholesale_transfer_price:
        numberOrNull(
          result.wholesale_transfer_price
        ),

      effective_from:
        String(
          result.effective_from || ''
        ),
    };
  };
