export const featureFlags = {
  bilingualUi: true,
  factoryModuleRegistry: false,
  secureAuth: false,
  inventoryLedger: false,
  productionOrders: false,
  batchTraceability: false,
  qualityManagement: false,
  maintenanceCmms: false,
  calibration: false,
  capa: false,
  oee: false,
  safety: false,
} as const;

export type FeatureFlag = keyof typeof featureFlags;
