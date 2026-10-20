import { mavoraSupabase } from '../mavoraSupabase';

export interface MavoraExecutionWarehouse {
  id: string;
  tenant_id: string;
  site_id: string;
  code: string;
  name: string;
  warehouse_type: string;
  is_active: boolean;
}

export interface MavoraExecutionLot {
  id: string;
  tenant_id: string;
  product_id: string;
  lot_no: string;
  batch_no: string | null;
  manufactured_at: string | null;
  expires_at: string | null;
  status:
    | 'released'
    | 'quarantine'
    | 'blocked'
    | 'expired'
    | 'consumed';
}

export interface MavoraExecutionBalance {
  id: string;
  tenant_id: string;
  warehouse_id: string;
  product_id: string;
  lot_id: string | null;
  quantity: number;
  reserved_quantity: number;
  average_unit_cost: number | null;
}

export interface MavoraMaterialConsumption {
  id: string;
  tenant_id: string;
  site_id: string;
  production_order_id: string;
  production_order_material_id: string;
  warehouse_id: string;
  input_product_id: string;
  input_unit_id: string;
  lot_id: string | null;
  actual_qty: number;
  inventory_movement_id: string;
  variance_reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface MavoraProductionOutput {
  id: string;
  tenant_id: string;
  site_id: string;
  production_order_id: string;
  warehouse_id: string;
  output_product_id: string;
  output_unit_id: string;
  lot_id: string | null;
  actual_qty: number;
  inventory_movement_id: string;
  created_by: string | null;
  created_at: string;
}

export interface MavoraProductionExecutionSnapshot {
  warehouses: MavoraExecutionWarehouse[];
  lots: MavoraExecutionLot[];
  balances: MavoraExecutionBalance[];
  consumptions: MavoraMaterialConsumption[];
  outputs: MavoraProductionOutput[];
}

export interface ReleaseProductionOrderInput {
  tenantId: string;
  productionOrderId: string;
  reason?: string | null;
}

export interface ReleaseProductionOrderResult {
  ok: boolean;
  idempotent: boolean;
  production_order_id: string;
  order_no: string;
  status: 'released';
  released_at: string;
}

export interface StartProductionOrderInput {
  tenantId: string;
  productionOrderId: string;
  reason?: string | null;
}

export interface StartProductionOrderResult {
  ok: boolean;
  idempotent: boolean;
  production_order_id: string;
  order_no: string;
  status: 'in_progress';
  actual_start_at: string;
}

export interface ConsumeProductionMaterialInput {
  tenantId: string;
  productionOrderId: string;
  productionOrderMaterialId: string;
  warehouseId: string;
  lotId?: string | null;
  actualQty: number;
  postingKey: string;
  varianceReason?: string | null;
  reason?: string | null;
  occurredAt?: string | null;
}

export interface ConsumeProductionMaterialResult {
  ok: boolean;
  idempotent: boolean;
  production_order_id: string;
  production_order_material_id: string;
  consumption_id: string;
  inventory_movement_id: string;
  actual_qty: number;
}

export interface RecordProductionOutputInput {
  tenantId: string;
  productionOrderId: string;
  warehouseId: string;
  lotId?: string | null;
  actualQty: number;
  postingKey: string;
  reason?: string | null;
  occurredAt?: string | null;
}

export interface RecordProductionOutputResult {
  ok: boolean;
  idempotent: boolean;
  production_order_id: string;
  output_id: string;
  inventory_movement_id: string;
  actual_qty: number;
}

export interface CompleteProductionOrderInput {
  tenantId: string;
  productionOrderId: string;
  reason?: string | null;
}

export interface CompleteProductionOrderResult {
  ok: boolean;
  idempotent: boolean;
  production_order_id: string;
  order_no: string;
  status: 'completed';
  actual_output_qty: number;
  yield_pct: number;
  completed_at: string;
}

const throwIfError = (
  error: { message?: string } | null,
  fallback: string
) => {
  if (error) {
    throw new Error(error.message || fallback);
  }
};

const requireId = (
  value: string,
  label: string
): string => {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(`${label} is required`);
  }

  return normalized;
};

const optionalText = (
  value: string | null | undefined,
  label: string,
  maxLength = 2000
): string | null => {
  const normalized = value?.trim() || null;

  if (
    normalized &&
    normalized.length > maxLength
  ) {
    throw new Error(
      `${label} cannot exceed ${maxLength} characters`
    );
  }

  return normalized;
};

const requireQuantity = (
  value: number,
  label: string
): number => {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      `${label} must be greater than zero`
    );
  }

  const normalized =
    Number(value.toFixed(6));

  if (normalized <= 0) {
    throw new Error(
      `${label} is too small`
    );
  }

  return normalized;
};

const requirePostingKey = (
  value: string
): string => {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(
      'Posting key is required'
    );
  }

  if (normalized.length > 200) {
    throw new Error(
      'Posting key cannot exceed 200 characters'
    );
  }

  return normalized;
};

export const createProductionExecutionPostingKey = (
  prefix: string
): string => {
  const safePrefix =
    prefix
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .slice(0, 80) ||
    'production';

  const token =
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`;

  return `${safePrefix}-${token}`;
};

export const loadMavoraProductionExecutionSnapshot =
  async (
    tenantId: string
  ): Promise<MavoraProductionExecutionSnapshot> => {
    const normalizedTenantId =
      requireId(
        tenantId,
        'Tenant'
      );

    const [
      warehousesResult,
      lotsResult,
      balancesResult,
      consumptionsResult,
      outputsResult,
    ] = await Promise.all([
      mavoraSupabase
        .from('warehouses')
        .select(
          'id, tenant_id, site_id, code, name, warehouse_type, is_active'
        )
        .eq(
          'tenant_id',
          normalizedTenantId
        )
        .eq('is_active', true)
        .order('code'),

      mavoraSupabase
        .from('inventory_lots')
        .select(
          'id, tenant_id, product_id, lot_no, batch_no, manufactured_at, expires_at, status'
        )
        .eq(
          'tenant_id',
          normalizedTenantId
        )
        .order(
          'created_at',
          { ascending: false }
        ),

      mavoraSupabase
        .from('inventory_balances')
        .select(
          'id, tenant_id, warehouse_id, product_id, lot_id, quantity, reserved_quantity, average_unit_cost'
        )
        .eq(
          'tenant_id',
          normalizedTenantId
        ),

      mavoraSupabase
        .from(
          'production_order_material_consumptions'
        )
        .select(
          'id, tenant_id, site_id, production_order_id, production_order_material_id, warehouse_id, input_product_id, input_unit_id, lot_id, actual_qty, inventory_movement_id, variance_reason, created_by, created_at'
        )
        .eq(
          'tenant_id',
          normalizedTenantId
        )
        .order(
          'created_at',
          { ascending: false }
        ),

      mavoraSupabase
        .from(
          'production_order_outputs'
        )
        .select(
          'id, tenant_id, site_id, production_order_id, warehouse_id, output_product_id, output_unit_id, lot_id, actual_qty, inventory_movement_id, created_by, created_at'
        )
        .eq(
          'tenant_id',
          normalizedTenantId
        )
        .order(
          'created_at',
          { ascending: false }
        ),
    ]);

    throwIfError(
      warehousesResult.error,
      'Unable to load Production execution warehouses'
    );

    throwIfError(
      lotsResult.error,
      'Unable to load Production execution lots'
    );

    throwIfError(
      balancesResult.error,
      'Unable to load Production execution balances'
    );

    throwIfError(
      consumptionsResult.error,
      'Unable to load Production material consumption history'
    );

    throwIfError(
      outputsResult.error,
      'Unable to load Production output history'
    );

    return {
      warehouses:
        (warehousesResult.data as MavoraExecutionWarehouse[]) ??
        [],
      lots:
        (lotsResult.data as MavoraExecutionLot[]) ??
        [],
      balances:
        (balancesResult.data as MavoraExecutionBalance[]) ??
        [],
      consumptions:
        (consumptionsResult.data as MavoraMaterialConsumption[]) ??
        [],
      outputs:
        (outputsResult.data as MavoraProductionOutput[]) ??
        [],
    };
  };

export const releaseProductionOrder =
  async (
    input: ReleaseProductionOrderInput
  ): Promise<ReleaseProductionOrderResult> => {
    const { data, error } =
      await mavoraSupabase.rpc(
        'release_production_order',
        {
          p_tenant_id:
            requireId(
              input.tenantId,
              'Tenant'
            ),
          p_production_order_id:
            requireId(
              input.productionOrderId,
              'Production Order'
            ),
          p_reason:
            optionalText(
              input.reason,
              'Release reason'
            ),
        }
      );

    throwIfError(
      error,
      'Unable to release Production Order'
    );

    const result =
      data as ReleaseProductionOrderResult | null;

    if (
      !result?.ok ||
      result.status !== 'released'
    ) {
      throw new Error(
        'Release Production Order returned an invalid result'
      );
    }

    return result;
  };

export const startProductionOrder =
  async (
    input: StartProductionOrderInput
  ): Promise<StartProductionOrderResult> => {
    const { data, error } =
      await mavoraSupabase.rpc(
        'start_production_order',
        {
          p_tenant_id:
            requireId(
              input.tenantId,
              'Tenant'
            ),
          p_production_order_id:
            requireId(
              input.productionOrderId,
              'Production Order'
            ),
          p_reason:
            optionalText(
              input.reason,
              'Start reason'
            ),
        }
      );

    throwIfError(
      error,
      'Unable to start Production Order'
    );

    const result =
      data as StartProductionOrderResult | null;

    if (
      !result?.ok ||
      result.status !== 'in_progress'
    ) {
      throw new Error(
        'Start Production Order returned an invalid result'
      );
    }

    return result;
  };

export const consumeProductionMaterial =
  async (
    input: ConsumeProductionMaterialInput
  ): Promise<ConsumeProductionMaterialResult> => {
    const actualQty =
      requireQuantity(
        input.actualQty,
        'Actual consumption quantity'
      );

    const { data, error } =
      await mavoraSupabase.rpc(
        'consume_production_material',
        {
          p_tenant_id:
            requireId(
              input.tenantId,
              'Tenant'
            ),
          p_production_order_id:
            requireId(
              input.productionOrderId,
              'Production Order'
            ),
          p_production_order_material_id:
            requireId(
              input.productionOrderMaterialId,
              'Production material'
            ),
          p_warehouse_id:
            requireId(
              input.warehouseId,
              'Source warehouse'
            ),
          p_lot_id:
            input.lotId?.trim() || null,
          p_actual_qty: actualQty,
          p_posting_key:
            requirePostingKey(
              input.postingKey
            ),
          p_variance_reason:
            optionalText(
              input.varianceReason,
              'Variance reason'
            ),
          p_reason:
            optionalText(
              input.reason,
              'Consumption reason'
            ),
          p_occurred_at:
            input.occurredAt || null,
        }
      );

    throwIfError(
      error,
      'Unable to consume Production material'
    );

    const result =
      data as ConsumeProductionMaterialResult | null;

    if (
      !result?.ok ||
      !result.consumption_id ||
      !result.inventory_movement_id
    ) {
      throw new Error(
        'Production material consumption returned an invalid result'
      );
    }

    return result;
  };

export const recordProductionOutput =
  async (
    input: RecordProductionOutputInput
  ): Promise<RecordProductionOutputResult> => {
    const actualQty =
      requireQuantity(
        input.actualQty,
        'Actual output quantity'
      );

    const { data, error } =
      await mavoraSupabase.rpc(
        'record_production_output',
        {
          p_tenant_id:
            requireId(
              input.tenantId,
              'Tenant'
            ),
          p_production_order_id:
            requireId(
              input.productionOrderId,
              'Production Order'
            ),
          p_warehouse_id:
            requireId(
              input.warehouseId,
              'Output warehouse'
            ),
          p_lot_id:
            input.lotId?.trim() || null,
          p_actual_qty: actualQty,
          p_posting_key:
            requirePostingKey(
              input.postingKey
            ),
          p_reason:
            optionalText(
              input.reason,
              'Output reason'
            ),
          p_occurred_at:
            input.occurredAt || null,
        }
      );

    throwIfError(
      error,
      'Unable to record Production output'
    );

    const result =
      data as RecordProductionOutputResult | null;

    if (
      !result?.ok ||
      !result.output_id ||
      !result.inventory_movement_id
    ) {
      throw new Error(
        'Production output returned an invalid result'
      );
    }

    return result;
  };

export const completeProductionOrder =
  async (
    input: CompleteProductionOrderInput
  ): Promise<CompleteProductionOrderResult> => {
    const { data, error } =
      await mavoraSupabase.rpc(
        'complete_production_order',
        {
          p_tenant_id:
            requireId(
              input.tenantId,
              'Tenant'
            ),
          p_production_order_id:
            requireId(
              input.productionOrderId,
              'Production Order'
            ),
          p_reason:
            optionalText(
              input.reason,
              'Completion reason'
            ),
        }
      );

    throwIfError(
      error,
      'Unable to complete Production Order'
    );

    const result =
      data as CompleteProductionOrderResult | null;

    if (
      !result?.ok ||
      result.status !== 'completed'
    ) {
      throw new Error(
        'Complete Production Order returned an invalid result'
      );
    }

    return result;
  };
