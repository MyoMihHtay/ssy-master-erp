import { mavoraSupabase } from '../mavoraSupabase';

export interface MavoraProductionSite {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  site_type: string;
  is_active: boolean;
}

export interface MavoraProductionDepartment {
  id: string;
  tenant_id: string;
  site_id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface MavoraWorkCenter {
  id: string;
  tenant_id: string;
  site_id: string;
  department_id: string | null;
  code: string;
  name: string;
  is_active: boolean;
}

export interface MavoraProductionLine {
  id: string;
  tenant_id: string;
  site_id: string;
  work_center_id: string | null;
  code: string;
  name: string;
  capacity_per_hour: number | null;
  is_active: boolean;
}

export interface MavoraProductionProduct {
  id: string;
  tenant_id: string;
  base_unit_id: string;
  sku: string;
  name: string;
  product_type: string;
  tracking_mode: string;
  is_active: boolean;
}

export interface MavoraProductionUnit {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  symbol: string | null;
  unit_type: string | null;
  is_active: boolean;
}

export interface MavoraProductionRecipe {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  process_type: string;
  output_product_id: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MavoraProductionRecipeVersion {
  id: string;
  tenant_id: string;
  recipe_id: string;
  version_no: number;
  status: 'draft' | 'approved' | 'retired';
  standard_output_qty: number;
  output_unit_id: string;
  effective_from: string | null;
  effective_to: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MavoraProductionRecipeComponent {
  id: string;
  tenant_id: string;
  recipe_version_id: string;
  line_no: number;
  input_product_id: string;
  input_unit_id: string;
  required_qty: number;
  wastage_allowance_pct: number;
  is_optional: boolean;
}

export interface MavoraProductionOrder {
  id: string;
  tenant_id: string;
  site_id: string;
  order_no: string;
  recipe_version_id: string;
  output_product_id: string;
  output_unit_id: string;
  work_center_id: string | null;
  production_line_id: string | null;
  status:
    | 'draft'
    | 'released'
    | 'in_progress'
    | 'completed'
    | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  planned_qty: number;
  planned_start_at: string | null;
  planned_end_at: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MavoraProductionOrderMaterial {
  id: string;
  tenant_id: string;
  site_id: string;
  production_order_id: string;
  line_no: number;
  source_component_id: string;
  input_product_id: string;
  input_unit_id: string;
  planned_qty: number;
  wastage_allowance_pct: number;
}

export interface MavoraProductionSnapshot {
  sites: MavoraProductionSite[];
  departments: MavoraProductionDepartment[];
  workCenters: MavoraWorkCenter[];
  productionLines: MavoraProductionLine[];
  products: MavoraProductionProduct[];
  units: MavoraProductionUnit[];
  recipes: MavoraProductionRecipe[];
  recipeVersions: MavoraProductionRecipeVersion[];
  recipeComponents: MavoraProductionRecipeComponent[];
  orders: MavoraProductionOrder[];
  orderMaterials: MavoraProductionOrderMaterial[];
}

const throwIfError = (
  error: { message?: string } | null,
  fallback: string
) => {
  if (error) {
    throw new Error(error.message || fallback);
  }
};

export const loadMavoraProductionSnapshot = async (
  tenantId: string
): Promise<MavoraProductionSnapshot> => {
  const [
    sitesResult,
    departmentsResult,
    workCentersResult,
    linesResult,
    productsResult,
    unitsResult,
    recipesResult,
    versionsResult,
    componentsResult,
    ordersResult,
    materialsResult,
  ] = await Promise.all([
    mavoraSupabase
      .from('sites')
      .select(
        'id, tenant_id, code, name, site_type, is_active'
      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('code'),

    mavoraSupabase
      .from('departments')
      .select(
        'id, tenant_id, site_id, code, name, is_active'
      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('code'),

    mavoraSupabase
      .from('work_centers')
      .select(
        'id, tenant_id, site_id, department_id, code, name, is_active'
      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('code'),

    mavoraSupabase
      .from('production_lines')
      .select(
        'id, tenant_id, site_id, work_center_id, code, name, capacity_per_hour, is_active'
      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('code'),

    mavoraSupabase
      .from('products')
      .select(
        'id, tenant_id, base_unit_id, sku, name, product_type, tracking_mode, is_active'
      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sku'),

    mavoraSupabase
      .from('units')
      .select(
        'id, tenant_id, code, name, symbol, unit_type, is_active'
      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('code'),

    mavoraSupabase
      .from('production_recipes')
      .select(
        'id, tenant_id, code, name, process_type, output_product_id, is_active, notes, created_at, updated_at'
      )
      .eq('tenant_id', tenantId)
      .order('code'),

    mavoraSupabase
      .from('production_recipe_versions')
      .select(
        'id, tenant_id, recipe_id, version_no, status, standard_output_qty, output_unit_id, effective_from, effective_to, approved_at, created_at, updated_at'
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),

    mavoraSupabase
      .from('production_recipe_components')
      .select(
        'id, tenant_id, recipe_version_id, line_no, input_product_id, input_unit_id, required_qty, wastage_allowance_pct, is_optional'
      )
      .eq('tenant_id', tenantId)
      .order('line_no'),

    mavoraSupabase
      .from('production_orders')
      .select(
        'id, tenant_id, site_id, order_no, recipe_version_id, output_product_id, output_unit_id, work_center_id, production_line_id, status, priority, planned_qty, planned_start_at, planned_end_at, actual_start_at, actual_end_at, created_at, updated_at'
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),

    mavoraSupabase
      .from('production_order_materials')
      .select(
        'id, tenant_id, site_id, production_order_id, line_no, source_component_id, input_product_id, input_unit_id, planned_qty, wastage_allowance_pct'
      )
      .eq('tenant_id', tenantId)
      .order('line_no'),
  ]);

  throwIfError(
    sitesResult.error,
    'Unable to load Production sites'
  );

  throwIfError(
    departmentsResult.error,
    'Unable to load Production departments'
  );

  throwIfError(
    workCentersResult.error,
    'Unable to load Work Centers'
  );

  throwIfError(
    linesResult.error,
    'Unable to load Production Lines'
  );

  throwIfError(
    productsResult.error,
    'Unable to load Production products'
  );

  throwIfError(
    unitsResult.error,
    'Unable to load units'
  );

  throwIfError(
    recipesResult.error,
    'Unable to load Production Recipes'
  );

  throwIfError(
    versionsResult.error,
    'Unable to load Recipe Versions'
  );

  throwIfError(
    componentsResult.error,
    'Unable to load BOM components'
  );

  throwIfError(
    ordersResult.error,
    'Unable to load Production Orders'
  );

  throwIfError(
    materialsResult.error,
    'Unable to load Production Order materials'
  );

  return {
    sites:
      (sitesResult.data || []) as MavoraProductionSite[],

    departments:
      (departmentsResult.data ||
        []) as MavoraProductionDepartment[],

    workCenters:
      (workCentersResult.data ||
        []) as MavoraWorkCenter[],

    productionLines:
      (linesResult.data ||
        []) as MavoraProductionLine[],

    products:
      (productsResult.data ||
        []) as MavoraProductionProduct[],

    units:
      (unitsResult.data ||
        []) as MavoraProductionUnit[],

    recipes:
      (recipesResult.data ||
        []) as MavoraProductionRecipe[],

    recipeVersions:
      (versionsResult.data ||
        []) as MavoraProductionRecipeVersion[],

    recipeComponents:
      (componentsResult.data ||
        []) as MavoraProductionRecipeComponent[],

    orders:
      (ordersResult.data ||
        []) as MavoraProductionOrder[],

    orderMaterials:
      (materialsResult.data ||
        []) as MavoraProductionOrderMaterial[],
  };
};

export interface CreateMavoraWorkCenterInput {
  tenantId: string;
  siteId: string;
  departmentId?: string | null;
  code: string;
  name: string;
}

export interface UpdateMavoraWorkCenterInput {
  tenantId: string;
  id: string;
  siteId: string;
  departmentId?: string | null;
  code: string;
  name: string;
}

export interface CreateMavoraProductionLineInput {
  tenantId: string;
  siteId: string;
  workCenterId: string;
  code: string;
  name: string;
  capacityPerHour?: number | null;
}

export interface UpdateMavoraProductionLineInput {
  tenantId: string;
  id: string;
  siteId: string;
  code: string;
  name: string;
  capacityPerHour?: number | null;
}

const normalizeProductionMasterCode = (
  value: string
): string =>
  value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-');

const requireMasterText = (
  value: string,
  field: string
): string => {
  const result = value.trim();

  if (!result) {
    throw new Error(`${field} is required`);
  }

  return result;
};

export const createMavoraWorkCenter = async (
  input: CreateMavoraWorkCenterInput
): Promise<MavoraWorkCenter> => {
  const code = normalizeProductionMasterCode(
    requireMasterText(input.code, 'Work Center code')
  );

  const name = requireMasterText(
    input.name,
    'Work Center name'
  );

  const { data, error } = await mavoraSupabase
    .from('work_centers')
    .insert({
      tenant_id: input.tenantId,
      site_id: input.siteId,
      department_id:
        input.departmentId || null,
      code,
      name,
    })
    .select(
      'id, tenant_id, site_id, department_id, code, name, is_active'
    )
    .single();

  throwIfError(
    error,
    'Unable to create Work Center'
  );

  return data as MavoraWorkCenter;
};

export const updateMavoraWorkCenter = async (
  input: UpdateMavoraWorkCenterInput
): Promise<MavoraWorkCenter> => {
  const code = normalizeProductionMasterCode(
    requireMasterText(input.code, 'Work Center code')
  );

  const name = requireMasterText(
    input.name,
    'Work Center name'
  );

  const { data, error } = await mavoraSupabase
    .from('work_centers')
    .update({
      department_id:
        input.departmentId || null,
      code,
      name,
    })
    .eq('id', input.id)
    .eq('tenant_id', input.tenantId)
    .eq('site_id', input.siteId)
    .select(
      'id, tenant_id, site_id, department_id, code, name, is_active'
    )
    .single();

  throwIfError(
    error,
    'Unable to update Work Center'
  );

  return data as MavoraWorkCenter;
};

export const createMavoraProductionLine = async (
  input: CreateMavoraProductionLineInput
): Promise<MavoraProductionLine> => {
  const code = normalizeProductionMasterCode(
    requireMasterText(
      input.code,
      'Production Line code'
    )
  );

  const name = requireMasterText(
    input.name,
    'Production Line name'
  );

  const { data, error } = await mavoraSupabase
    .from('production_lines')
    .insert({
      tenant_id: input.tenantId,
      site_id: input.siteId,
      work_center_id: input.workCenterId,
      code,
      name,
      capacity_per_hour:
        input.capacityPerHour ?? null,
    })
    .select(
      'id, tenant_id, site_id, work_center_id, code, name, capacity_per_hour, is_active'
    )
    .single();

  throwIfError(
    error,
    'Unable to create Production Line'
  );

  return data as MavoraProductionLine;
};

export const updateMavoraProductionLine = async (
  input: UpdateMavoraProductionLineInput
): Promise<MavoraProductionLine> => {
  const code = normalizeProductionMasterCode(
    requireMasterText(
      input.code,
      'Production Line code'
    )
  );

  const name = requireMasterText(
    input.name,
    'Production Line name'
  );

  const { data, error } = await mavoraSupabase
    .from('production_lines')
    .update({
      code,
      name,
      capacity_per_hour:
        input.capacityPerHour ?? null,
    })
    .eq('id', input.id)
    .eq('tenant_id', input.tenantId)
    .eq('site_id', input.siteId)
    .select(
      'id, tenant_id, site_id, work_center_id, code, name, capacity_per_hour, is_active'
    )
    .single();

  throwIfError(
    error,
    'Unable to update Production Line'
  );

  return data as MavoraProductionLine;
};

export type MavoraRecipeProcessType =
  | 'manufacturing'
  | 'packaging'
  | 'rework';

export interface CreateMavoraProductionRecipeInput {
  tenantId: string;
  code: string;
  name: string;
  processType: MavoraRecipeProcessType;
  outputProductId: string;
}

export interface CreateMavoraRecipeVersionInput {
  tenantId: string;
  recipeId: string;
  versionNo: number;
  standardOutputQty: number;
  outputUnitId: string;
}

export const createMavoraProductionRecipe = async (
  input: CreateMavoraProductionRecipeInput
): Promise<MavoraProductionRecipe> => {
  const code = normalizeProductionMasterCode(
    requireMasterText(
      input.code,
      'Recipe code'
    )
  );

  const name = requireMasterText(
    input.name,
    'Recipe name'
  );

  if (!input.outputProductId) {
    throw new Error(
      'Output product is required'
    );
  }

  const { data, error } = await mavoraSupabase
    .from('production_recipes')
    .insert({
      tenant_id: input.tenantId,
      code,
      name,
      process_type: input.processType,
      output_product_id:
        input.outputProductId,
      is_active: true,
    })
    .select(
      'id, tenant_id, code, name, process_type, output_product_id, is_active, notes, created_at, updated_at'
    )
    .single();

  throwIfError(
    error,
    'Unable to create Production Recipe'
  );

  return data as MavoraProductionRecipe;
};

export const createMavoraRecipeVersion = async (
  input: CreateMavoraRecipeVersionInput
): Promise<MavoraProductionRecipeVersion> => {
  if (
    !Number.isInteger(input.versionNo) ||
    input.versionNo <= 0
  ) {
    throw new Error(
      'Version number must be a positive integer'
    );
  }

  if (
    !Number.isFinite(
      input.standardOutputQty
    ) ||
    input.standardOutputQty <= 0
  ) {
    throw new Error(
      'Standard output quantity must be greater than zero'
    );
  }

  if (!input.outputUnitId) {
    throw new Error(
      'Output unit is required'
    );
  }

  const { data, error } = await mavoraSupabase
    .from('production_recipe_versions')
    .insert({
      tenant_id: input.tenantId,
      recipe_id: input.recipeId,
      version_no: input.versionNo,
      status: 'draft',
      standard_output_qty:
        input.standardOutputQty,
      output_unit_id:
        input.outputUnitId,
    })
    .select(
      'id, tenant_id, recipe_id, version_no, status, standard_output_qty, output_unit_id, effective_from, effective_to, approved_at, created_at, updated_at'
    )
    .single();

  throwIfError(
    error,
    'Unable to create Recipe Version'
  );

  return data as MavoraProductionRecipeVersion;
};

export interface CreateMavoraRecipeComponentInput {
  tenantId: string;
  recipeVersionId: string;
  lineNo: number;
  inputProductId: string;
  inputUnitId: string;
  requiredQty: number;
  wastageAllowancePct?: number;
  isOptional?: boolean;
}

export const createMavoraRecipeComponent = async (
  input: CreateMavoraRecipeComponentInput
): Promise<MavoraProductionRecipeComponent> => {
  if (
    !Number.isInteger(input.lineNo) ||
    input.lineNo <= 0
  ) {
    throw new Error(
      'BOM line number must be a positive integer'
    );
  }

  if (
    !Number.isFinite(input.requiredQty) ||
    input.requiredQty <= 0
  ) {
    throw new Error(
      'Required quantity must be greater than zero'
    );
  }

  const wastage =
    input.wastageAllowancePct ?? 0;

  if (
    !Number.isFinite(wastage) ||
    wastage < 0 ||
    wastage > 100
  ) {
    throw new Error(
      'Wastage allowance must be between 0 and 100'
    );
  }

  const { data, error } = await mavoraSupabase
    .from('production_recipe_components')
    .insert({
      tenant_id: input.tenantId,
      recipe_version_id:
        input.recipeVersionId,
      line_no: input.lineNo,
      input_product_id:
        input.inputProductId,
      input_unit_id:
        input.inputUnitId,
      required_qty:
        input.requiredQty,
      wastage_allowance_pct:
        wastage,
      is_optional:
        input.isOptional ?? false,
    })
    .select(
      'id, tenant_id, recipe_version_id, line_no, input_product_id, input_unit_id, required_qty, wastage_allowance_pct, is_optional'
    )
    .single();

  throwIfError(
    error,
    'Unable to add BOM ingredient'
  );

  return data as MavoraProductionRecipeComponent;
};

export const removeMavoraRecipeComponent = async (
  tenantId: string,
  recipeVersionId: string,
  componentId: string
): Promise<void> => {
  const { error } = await mavoraSupabase
    .from('production_recipe_components')
    .delete()
    .eq('id', componentId)
    .eq('tenant_id', tenantId)
    .eq(
      'recipe_version_id',
      recipeVersionId
    );

  throwIfError(
    error,
    'Unable to remove BOM ingredient'
  );
};

export interface ApproveMavoraRecipeVersionInput {
  tenantId: string;
  recipeVersionId: string;
}

export const approveMavoraRecipeVersion = async (
  input: ApproveMavoraRecipeVersionInput
): Promise<MavoraProductionRecipeVersion> => {
  const { data, error } = await mavoraSupabase
    .from('production_recipe_versions')
    .update({
      status: 'approved',
    })
    .eq(
      'id',
      input.recipeVersionId
    )
    .eq(
      'tenant_id',
      input.tenantId
    )
    .eq('status', 'draft')
    .select(
      'id, tenant_id, recipe_id, version_no, status, standard_output_qty, output_unit_id, effective_from, effective_to, approved_at, created_at, updated_at'
    )
    .single();

  throwIfError(
    error,
    'Unable to approve Recipe Version'
  );

  return data as MavoraProductionRecipeVersion;
};

export interface CreateMavoraProductionOrderPlanInput {
  tenantId: string;
  siteId: string;
  orderNo: string;
  recipeVersionId: string;
  plannedQty: number;
  workCenterId?: string | null;
  productionLineId?: string | null;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  notes?: string | null;
}

export interface CreateMavoraProductionOrderPlanResult {
  production_order_id: string;
  order_no: string;
  status: 'draft';
  planned_qty: number;
  material_count: number;
}

export const createMavoraProductionOrderPlan = async (
  input: CreateMavoraProductionOrderPlanInput
): Promise<CreateMavoraProductionOrderPlanResult> => {
  const orderNo = requireMasterText(
    input.orderNo,
    'Production Order number'
  );

  if (orderNo.length > 100) {
    throw new Error(
      'Production Order number cannot exceed 100 characters'
    );
  }

  if (!input.siteId) {
    throw new Error(
      'Production Site is required'
    );
  }

  if (!input.recipeVersionId) {
    throw new Error(
      'Approved Recipe Version is required'
    );
  }

  if (
    !Number.isFinite(input.plannedQty) ||
    input.plannedQty <= 0
  ) {
    throw new Error(
      'Planned Production quantity must be greater than zero'
    );
  }

  // production_orders.planned_qty is numeric(18,6).
  // Normalize before the RPC so header and BOM scaling use
  // the exact same six-decimal planned quantity.
  const plannedQty =
    Number(input.plannedQty.toFixed(6));

  if (plannedQty <= 0) {
    throw new Error(
      'Planned Production quantity is too small'
    );
  }

  if (
    input.productionLineId &&
    !input.workCenterId
  ) {
    throw new Error(
      'Select a Work Center before selecting a Production Line'
    );
  }

  const priority =
    input.priority ?? 'normal';

  if (
    ![
      'low',
      'normal',
      'high',
      'urgent',
    ].includes(priority)
  ) {
    throw new Error(
      'Invalid Production Order priority'
    );
  }

  const notes =
    input.notes?.trim() || null;

  if (
    notes &&
    notes.length > 4000
  ) {
    throw new Error(
      'Production Order notes cannot exceed 4000 characters'
    );
  }

  const { data, error } =
    await mavoraSupabase.rpc(
      'create_production_order_plan',
      {
        p_tenant_id: input.tenantId,
        p_site_id: input.siteId,
        p_order_no: orderNo,
        p_recipe_version_id:
          input.recipeVersionId,
        p_planned_qty:
          plannedQty,
        p_work_center_id:
          input.workCenterId || null,
        p_production_line_id:
          input.productionLineId || null,
        p_priority: priority,
        p_planned_start_at: null,
        p_planned_end_at: null,
        p_notes: notes,
      }
    );

  throwIfError(
    error,
    'Unable to create Production Order plan'
  );

  const result =
    data as CreateMavoraProductionOrderPlanResult | null;

  if (
    !result ||
    !result.production_order_id ||
    result.status !== 'draft' ||
    result.material_count < 1
  ) {
    throw new Error(
      'Production Order planning returned an invalid result'
    );
  }

  return result;
};
