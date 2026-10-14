import type { TranslationKey } from '../i18n';

export type ModuleGroup =
  | 'management'
  | 'factory'
  | 'quality'
  | 'supply'
  | 'people'
  | 'finance'
  | 'system';

export interface FactoryModuleDefinition {
  id: string;
  labelKey: TranslationKey;
  icon: string;
  group: ModuleGroup;
  roles: string[];
  current: boolean;
}

export const factoryModules: FactoryModuleDefinition[] = [
  { id: 'dashboard', labelKey: 'dashboard', icon: '📊', group: 'management', roles: ['md', 'manager'], current: true },
  { id: 'workspace', labelKey: 'workspace', icon: '💬', group: 'management', roles: ['all'], current: true },
  { id: 'production', labelKey: 'production', icon: '🍳', group: 'factory', roles: ['md', 'manager', 'production'], current: true },
  { id: 'packaging', labelKey: 'packaging', icon: '🏷️', group: 'factory', roles: ['md', 'manager', 'production'], current: true },
  { id: 'finished_goods', labelKey: 'finishedGoods', icon: '🛍️', group: 'factory', roles: ['md', 'manager', 'storekeeper', 'sales', 'qc'], current: true },
  { id: 'quality', labelKey: 'quality', icon: '🧪', group: 'quality', roles: ['md', 'manager', 'qc'], current: false },
  { id: 'maintenance', labelKey: 'maintenance', icon: '🛠️', group: 'factory', roles: ['md', 'manager', 'maintenance'], current: false },
  { id: 'calibration', labelKey: 'calibration', icon: '📐', group: 'quality', roles: ['md', 'manager', 'qc', 'maintenance'], current: false },
  { id: 'safety', labelKey: 'safety', icon: '🦺', group: 'quality', roles: ['md', 'manager', 'hr'], current: false },
  { id: 'procurement', labelKey: 'procurement', icon: '🛒', group: 'supply', roles: ['md', 'manager', 'purchasing', 'qc', 'finance', 'storekeeper'], current: true },
  { id: 'inventory', labelKey: 'inventory', icon: '📦', group: 'supply', roles: ['md', 'manager', 'storekeeper', 'qc', 'production'], current: true },
  { id: 'sales', labelKey: 'sales', icon: '💰', group: 'supply', roles: ['md', 'manager', 'sales', 'finance'], current: true },
  { id: 'hr', labelKey: 'hr', icon: '👥', group: 'people', roles: ['all'], current: true },
  { id: 'expenses', labelKey: 'finance', icon: '💸', group: 'finance', roles: ['md', 'manager', 'finance'], current: true },
  { id: 'reports', labelKey: 'reports', icon: '📑', group: 'management', roles: ['md', 'manager', 'finance'], current: true },
  { id: 'accounts', labelKey: 'accounts', icon: '⚙️', group: 'system', roles: ['md'], current: true },
];

export const currentFactoryModules = factoryModules.filter(module => module.current);
export const plannedFactoryModules = factoryModules.filter(module => !module.current);
