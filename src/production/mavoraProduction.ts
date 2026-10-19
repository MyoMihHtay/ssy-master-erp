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
