import { mavoraSupabase } from '../mavoraSupabase';

export type MavoraProductionEditionCode =
  | 'PRODUCTION'
  | 'MANUFACTURING';

export interface MavoraProductionEdition {
  editionCode: MavoraProductionEditionCode;
  isManufacturing: boolean;
}

const PRODUCTION_FALLBACK: MavoraProductionEdition = {
  editionCode: 'PRODUCTION',
  isManufacturing: false,
};

export const loadMavoraProductionEdition = async (
  tenantId: string
): Promise<MavoraProductionEdition> => {
  const { data, error } = await mavoraSupabase.rpc(
    'get_production_edition',
    {
      p_tenant_id: tenantId,
    }
  );

  if (error) {
    throw error;
  }

  if (!data || typeof data !== 'object') {
    return PRODUCTION_FALLBACK;
  }

  const payload = data as Record<string, unknown>;

  const editionCode =
    payload.edition_code === 'MANUFACTURING'
      ? 'MANUFACTURING'
      : 'PRODUCTION';

  return {
    editionCode,
    isManufacturing:
      editionCode === 'MANUFACTURING',
  };
};
