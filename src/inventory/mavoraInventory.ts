import { mavoraSupabase } from '../mavoraSupabase';

export type MavoraProductType =
  | 'RM'
  | 'SFG'
  | 'FG'
  | 'PKG'
  | 'SPARE'
  | 'CONSUMABLE'
  | 'OTHER';

export type MavoraTrackingMode =
  | 'none'
  | 'lot'
  | 'batch';

export type MavoraLotStatus =
  | 'released'
  | 'quarantine'
  | 'blocked'
  | 'expired'
  | 'consumed';

export type MavoraMovementType =
  | 'opening'
  | 'receipt'
  | 'issue'
  | 'production_consume'
  | 'production_output'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'return_in'
  | 'return_out'
  | 'wastage';

export interface MavoraWarehouse {
  id: string;
  tenant_id: string;
  site_id: string;
  code: string;
  name: string;
  warehouse_type: string;
  is_active: boolean;
}

export interface MavoraUnit {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  symbol: string | null;
  unit_type: string | null;
  is_base_unit: boolean;
  is_active: boolean;
}

export interface MavoraProductCategory {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  code: string;
  name: string;
  category_type: string;
  is_active: boolean;
}

export interface MavoraProduct {
  id: string;
  tenant_id: string;
  category_id: string | null;
  base_unit_id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  product_type: MavoraProductType;
  tracking_mode: MavoraTrackingMode;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MavoraInventoryLot {
  id: string;
  tenant_id: string;
  product_id: string;
  lot_no: string;
  batch_no: string | null;
  manufactured_at: string | null;
  expires_at: string | null;
  status: MavoraLotStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MavoraInventoryBalance {
  id: string;
  tenant_id: string;
  warehouse_id: string;
  product_id: string;
  lot_id: string | null;
  quantity: number;
  reserved_quantity: number;
  average_unit_cost: number | null;
  updated_at: string;
}

export interface MavoraInventoryMovement {
  id: string;
  movement_group_id: string;
  tenant_id: string;
  site_id: string;
  warehouse_id: string;
  product_id: string;
  lot_id: string | null;
  movement_type: string;
  quantity: number;
  unit_cost: number | null;
  posting_key: string | null;
  reference_type: string | null;
  reference_id: string | null;
  reason: string | null;
  occurred_at: string;
  created_by: string | null;
  created_at: string;
}

export interface MavoraInventorySnapshot {
  products: MavoraProduct[];
  warehouses: MavoraWarehouse[];
  units: MavoraUnit[];
  categories: MavoraProductCategory[];
  lots: MavoraInventoryLot[];
  balances: MavoraInventoryBalance[];
  movements: MavoraInventoryMovement[];
}

export interface CreateMavoraProductInput {
  tenantId: string;
  categoryId?: string | null;
  baseUnitId: string;
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  productType: MavoraProductType;
  trackingMode?: MavoraTrackingMode;
}

export interface UpdateMavoraProductNameInput {
  tenantId: string;
  productId: string;
  name: string;
}

export interface CreateMavoraInventoryLotInput {
  tenantId: string;
  productId: string;
  lotNo: string;
  batchNo?: string | null;
  manufacturedAt?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
}

export interface ChangeMavoraInventoryLotStatusInput {
  tenantId: string;
  lotId: string;
  newStatus: Exclude<MavoraLotStatus, 'consumed'>;
  reason: string;
}

export interface PostInventoryMovementInput {
  tenantId: string;
  warehouseId: string;
  productId: string;
  movementType: MavoraMovementType;
  quantity: number;
  postingKey: string;
  lotId?: string | null;
  unitCost?: number | null;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  occurredAt?: string | null;
}

export interface PostInventoryTransferInput {
  tenantId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  productId: string;
  quantity: number;
  postingKey: string;
  lotId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  occurredAt?: string | null;
}

const throwIfError = (
  error: { message?: string } | null,
  fallback: string
) => {
  if (error) {
    throw new Error(error.message || fallback);
  }
};

export const createInventoryPostingKey = (
  prefix = 'inventory'
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

export const loadMavoraInventorySnapshot = async (
  tenantId: string
): Promise<MavoraInventorySnapshot> => {
  const [
    productsResult,
    warehousesResult,
    unitsResult,
    categoriesResult,
    lotsResult,
    balancesResult,
    movementsResult,
  ] = await Promise.all([
    mavoraSupabase
      .from('products')
      .select(
        'id, tenant_id, category_id, base_unit_id, sku, barcode, name, description, product_type, tracking_mode, is_active, created_at, updated_at'
      )
      .eq('tenant_id', tenantId)
      .order('sku', { ascending: true }),

    mavoraSupabase
      .from('warehouses')
      .select(
        'id, tenant_id, site_id, code, name, warehouse_type, is_active'
      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('code', { ascending: true }),

    mavoraSupabase
      .from('units')
      .select(
        'id, tenant_id, code, name, symbol, unit_type, is_base_unit, is_active'
      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('code', { ascending: true }),

    mavoraSupabase
      .from('product_categories')
      .select(
        'id, tenant_id, parent_id, code, name, category_type, is_active'
      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('code', { ascending: true }),

    mavoraSupabase
      .from('inventory_lots')
      .select(
        'id, tenant_id, product_id, lot_no, batch_no, manufactured_at, expires_at, status, notes, created_at, updated_at'
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),

    mavoraSupabase
      .from('inventory_balances')
      .select(
        'id, tenant_id, warehouse_id, product_id, lot_id, quantity, reserved_quantity, average_unit_cost, updated_at'
      )
      .eq('tenant_id', tenantId),

    mavoraSupabase
      .from('inventory_movements')
      .select(
        'id, movement_group_id, tenant_id, site_id, warehouse_id, product_id, lot_id, movement_type, quantity, unit_cost, posting_key, reference_type, reference_id, reason, occurred_at, created_by, created_at'
      )
      .eq('tenant_id', tenantId)
      .order('occurred_at', { ascending: false })
      .limit(200),
  ]);

  throwIfError(
    productsResult.error,
    'Unable to load products'
  );
  throwIfError(
    warehousesResult.error,
    'Unable to load warehouses'
  );
  throwIfError(
    unitsResult.error,
    'Unable to load units'
  );
  throwIfError(
    categoriesResult.error,
    'Unable to load product categories'
  );
  throwIfError(
    lotsResult.error,
    'Unable to load inventory lots'
  );
  throwIfError(
    balancesResult.error,
    'Unable to load inventory balances'
  );
  throwIfError(
    movementsResult.error,
    'Unable to load inventory movements'
  );

  return {
    products:
      (productsResult.data as MavoraProduct[]) ?? [],
    warehouses:
      (warehousesResult.data as MavoraWarehouse[]) ?? [],
    units:
      (unitsResult.data as MavoraUnit[]) ?? [],
    categories:
      (categoriesResult.data as MavoraProductCategory[]) ??
      [],
    lots:
      (lotsResult.data as MavoraInventoryLot[]) ?? [],
    balances:
      (balancesResult.data as MavoraInventoryBalance[]) ??
      [],
    movements:
      (movementsResult.data as MavoraInventoryMovement[]) ??
      [],
  };
};

export const createMavoraProduct = async (
  input: CreateMavoraProductInput
): Promise<MavoraProduct> => {
  const sku = input.sku.trim();
  const name = input.name.trim();

  if (!sku) {
    throw new Error('SKU is required');
  }

  if (!name) {
    throw new Error('Product name is required');
  }

  const { data, error } = await mavoraSupabase
    .from('products')
    .insert({
      tenant_id: input.tenantId,
      category_id: input.categoryId || null,
      base_unit_id: input.baseUnitId,
      sku,
      barcode: input.barcode?.trim() || null,
      name,
      description: input.description?.trim() || null,
      product_type: input.productType,
      tracking_mode: input.trackingMode ?? 'none',
      is_active: true,
    })
    .select(
      'id, tenant_id, category_id, base_unit_id, sku, barcode, name, description, product_type, tracking_mode, is_active, created_at, updated_at'
    )
    .single();

  throwIfError(error, 'Unable to create product');

  return data as MavoraProduct;
};

export const updateMavoraProductName = async (
  input: UpdateMavoraProductNameInput
): Promise<MavoraProduct> => {
  const name = input.name.trim();

  if (!name) {
    throw new Error('Product name is required');
  }

  const { data, error } = await mavoraSupabase
    .from('products')
    .update({
      name,
    })
    .eq('id', input.productId)
    .eq('tenant_id', input.tenantId)
    .select(
      'id, tenant_id, category_id, base_unit_id, sku, barcode, name, description, product_type, tracking_mode, is_active, created_at, updated_at'
    )
    .single();

  throwIfError(
    error,
    'Unable to update product name'
  );

  return data as MavoraProduct;
};

export const createMavoraInventoryLot = async (
  input: CreateMavoraInventoryLotInput
) => {
  const lotNo = input.lotNo.trim();
  const batchNo = input.batchNo?.trim() || null;
  const notes = input.notes?.trim() || null;

  if (!lotNo) {
    throw new Error('Lot number is required');
  }

  const { data, error } = await mavoraSupabase.rpc(
    'create_inventory_lot',
    {
      p_tenant_id: input.tenantId,
      p_product_id: input.productId,
      p_lot_no: lotNo,
      p_batch_no: batchNo,
      p_manufactured_at: input.manufacturedAt || null,
      p_expires_at: input.expiresAt || null,
      p_notes: notes,
    }
  );

  throwIfError(
    error,
    'Unable to create inventory lot/batch'
  );

  return data;
};

export const changeMavoraInventoryLotStatus = async (
  input: ChangeMavoraInventoryLotStatusInput
) => {
  const reason = input.reason.trim();

  if (!reason) {
    throw new Error(
      'Reason is required for lot status changes'
    );
  }

  const { data, error } = await mavoraSupabase.rpc(
    'change_inventory_lot_status',
    {
      p_tenant_id: input.tenantId,
      p_lot_id: input.lotId,
      p_new_status: input.newStatus,
      p_reason: reason,
    }
  );

  throwIfError(
    error,
    'Unable to change inventory lot status'
  );

  return data;
};

export const postMavoraInventoryMovement = async (
  input: PostInventoryMovementInput
) => {
  const { data, error } = await mavoraSupabase.rpc(
    'post_inventory_movement',
    {
      p_tenant_id: input.tenantId,
      p_warehouse_id: input.warehouseId,
      p_product_id: input.productId,
      p_movement_type: input.movementType,
      p_quantity: input.quantity,
      p_posting_key: input.postingKey,
      p_lot_id: input.lotId ?? null,
      p_unit_cost: input.unitCost ?? null,
      p_reference_type: input.referenceType ?? null,
      p_reference_id: input.referenceId ?? null,
      p_reason: input.reason ?? null,
      p_occurred_at: input.occurredAt ?? null,
    }
  );

  throwIfError(
    error,
    'Unable to post inventory movement'
  );

  return data;
};

export const postMavoraInventoryTransfer = async (
  input: PostInventoryTransferInput
) => {
  const { data, error } = await mavoraSupabase.rpc(
    'post_inventory_transfer',
    {
      p_tenant_id: input.tenantId,
      p_source_warehouse_id:
        input.sourceWarehouseId,
      p_destination_warehouse_id:
        input.destinationWarehouseId,
      p_product_id: input.productId,
      p_quantity: input.quantity,
      p_posting_key: input.postingKey,
      p_lot_id: input.lotId ?? null,
      p_reference_type: input.referenceType ?? null,
      p_reference_id: input.referenceId ?? null,
      p_reason: input.reason ?? null,
      p_occurred_at: input.occurredAt ?? null,
    }
  );

  throwIfError(
    error,
    'Unable to post inventory transfer'
  );

  return data;
};

export interface SimpleReceiveInventoryInput {
  tenantId: string;
  warehouseId: string;
  productId: string;
  quantity: number;
  unitCost: number;
  postingKey: string;
  lotNo?: string | null;
  batchNo?: string | null;
  manufacturedAt?: string | null;
  expiresAt?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  occurredAt?: string | null;
}

export interface MavoraSimpleReceiveResult {
  ok: boolean;
  workflow: string;
  tracked: boolean;
  tracking_mode: MavoraTrackingMode;
  warehouse_type: string;
  lot_id: string | null;
  lot_no: string | null;
  batch_no: string | null;
  lot_status: string | null;
  idempotent: boolean;
}

export const receiveMavoraInventory = async (
  input: SimpleReceiveInventoryInput
): Promise<MavoraSimpleReceiveResult> => {
  const { data, error } = await mavoraSupabase.rpc(
    'receive_inventory',
    {
      p_tenant_id: input.tenantId,
      p_warehouse_id: input.warehouseId,
      p_product_id: input.productId,
      p_quantity: input.quantity,
      p_unit_cost: input.unitCost,
      p_posting_key: input.postingKey,
      p_lot_no: input.lotNo ?? null,
      p_batch_no: input.batchNo ?? null,
      p_manufactured_at: input.manufacturedAt ?? null,
      p_expires_at: input.expiresAt ?? null,
      p_reference_id: input.referenceId ?? null,
      p_notes: input.notes ?? null,
      p_occurred_at: input.occurredAt ?? null,
    }
  );

  throwIfError(
    error,
    'Unable to receive inventory'
  );

  return data as MavoraSimpleReceiveResult;
};
