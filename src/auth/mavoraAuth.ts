import { mavoraSupabase } from '../mavoraSupabase';

export type MavoraProductionEditionCode =
  | 'PRODUCTION'
  | 'MANUFACTURING';

export interface MavoraTenantOption {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  membershipId: string;
  defaultSiteId: string | null;

  editionCode: MavoraProductionEditionCode | null;
  licenseStatus: string;
  licenseType: string | null;
  accessAllowed: boolean;
  expiresAt: string | null;

  enabledFeatures: string[];
}

export interface MavoraTenantSelection {
  authUserId: string;
  name: string;
  tenants: MavoraTenantOption[];
}

export type MavoraAuthResult =
  | {
      kind: 'session';
      session: MavoraUserSession;
    }
  | {
      kind: 'tenant_selection';
      selection: MavoraTenantSelection;
    };

interface CommercialLicenseContext {
  editionCode: MavoraProductionEditionCode | null;
  effectiveStatus: string;
  licenseType: string | null;
  accessAllowed: boolean;
  expiresAt: string | null;
  enabledFeatures: string[];
}

export interface MavoraUserSession {
  name: string;
  role: string;
  roleCode: string;

  authUserId: string;

  tenantId: string;
  tenantSlug: string;
  tenantName: string;

  membershipId: string;

  editionCode: MavoraProductionEditionCode;
  licenseStatus: string;
  licenseType: string | null;

  enabledFeatures: string[];
}

const toLegacyUiRole = (roleCode: string): string => {
  const code = roleCode.trim().toUpperCase();

  const roleMap: Record<string, string> = {
    OWNER: 'md',
    MD: 'md',
    MANAGING_DIRECTOR: 'md',
    MANAGER: 'manager',
    FINANCE: 'finance',
    QC: 'qc',
    QA: 'qc',
    PURCHASING: 'purchasing',
    STOREKEEPER: 'storekeeper',
    PRODUCTION: 'production',
    SALES: 'sales',
    HR: 'hr',
    MAINTENANCE: 'maintenance',
  };

  return roleMap[code] ?? roleCode.toLowerCase();
};

const normalizeEditionCode = (
  value: unknown
): MavoraProductionEditionCode | null => {
  if (value === 'PRODUCTION') {
    return 'PRODUCTION';
  }

  if (value === 'MANUFACTURING') {
    return 'MANUFACTURING';
  }

  return null;
};

const loadCommercialLicenseContext = async (
  tenantId: string
): Promise<CommercialLicenseContext> => {
  const { data, error } = await mavoraSupabase.rpc(
    'get_commercial_license_context',
    {
      p_tenant_id: tenantId,
    }
  );

  if (error) {
    throw error;
  }

  const context =
    data &&
    typeof data === 'object' &&
    !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};

  const enabledFeatures = Array.isArray(
    context.enabled_features
  )
    ? context.enabled_features.filter(
        (item): item is string =>
          typeof item === 'string'
      )
    : [];

  return {
    editionCode: normalizeEditionCode(
      context.edition_code
    ),

    effectiveStatus:
      typeof context.effective_status === 'string'
        ? context.effective_status
        : 'unlicensed',

    licenseType:
      typeof context.license_type === 'string'
        ? context.license_type
        : null,

    accessAllowed:
      context.access_allowed === true,

    expiresAt:
      typeof context.expires_at === 'string'
        ? context.expires_at
        : null,

    enabledFeatures,
  };
};

export const listMavoraTenantOptions = async (
  userId: string,
  fallbackName = 'User'
): Promise<{
  name: string;
  tenants: MavoraTenantOption[];
}> => {
  const { data: profile, error: profileError } =
    await mavoraSupabase
      .from('profiles')
      .select('id, display_name, status')
      .eq('id', userId)
      .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile || profile.status !== 'active') {
    throw new Error(
      'MAVORA_PROFILE_NOT_ACTIVE'
    );
  }

  const {
    data: memberships,
    error: membershipError,
  } = await mavoraSupabase
    .from('tenant_memberships')
    .select(
      'id, tenant_id, status, default_site_id'
    )
    .eq('user_id', userId)
    .eq('status', 'active');

  if (membershipError) {
    throw membershipError;
  }

  if (
    !memberships ||
    memberships.length === 0
  ) {
    throw new Error(
      'MAVORA_MEMBERSHIP_NOT_FOUND'
    );
  }

  const tenantIds = [
    ...new Set(
      memberships.map(
        (membership) =>
          membership.tenant_id
      )
    ),
  ];

  const {
    data: tenants,
    error: tenantError,
  } = await mavoraSupabase
    .from('tenants')
    .select('id, slug, name, status')
    .in('id', tenantIds)
    .eq('status', 'active');

  if (tenantError) {
    throw tenantError;
  }

  const membershipByTenant =
    new Map(
      memberships.map(
        (membership) => [
          membership.tenant_id,
          membership,
        ]
      )
    );

  const options =
    await Promise.all(
      (tenants ?? []).map(
        async (
          tenant
        ): Promise<MavoraTenantOption> => {
          const membership =
            membershipByTenant.get(
              tenant.id
            );

          if (!membership) {
            throw new Error(
              'MAVORA_MEMBERSHIP_NOT_FOUND'
            );
          }

          const license =
            await loadCommercialLicenseContext(
              tenant.id
            );

          return {
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            tenantName: tenant.name,

            membershipId:
              membership.id,

            defaultSiteId:
              membership.default_site_id
              ?? null,

            editionCode:
              license.editionCode,

            licenseStatus:
              license.effectiveStatus,

            licenseType:
              license.licenseType,

            accessAllowed:
              license.accessAllowed,

            expiresAt:
              license.expiresAt,

            enabledFeatures:
              license.enabledFeatures,
          };
        }
      )
    );

  options.sort(
    (a, b) =>
      a.tenantName.localeCompare(
        b.tenantName
      )
  );

  return {
    name:
      profile.display_name?.trim()
      || fallbackName,
    tenants: options,
  };
};

export const resolveMavoraUserSession = async (
  userId: string,
  tenantId: string | null = null,
  fallbackName = 'User'
): Promise<MavoraUserSession> => {
  const {
    name,
    tenants,
  } = await listMavoraTenantOptions(
    userId,
    fallbackName
  );

  const accessibleTenants =
    tenants.filter(
      (tenant) =>
        tenant.accessAllowed
        && tenant.editionCode !== null
    );

  if (accessibleTenants.length === 0) {
    throw new Error(
      'MAVORA_NO_ACTIVE_LICENSED_TENANT'
    );
  }

  let selectedTenant:
    MavoraTenantOption | undefined;

  if (tenantId) {
    selectedTenant =
      accessibleTenants.find(
        (tenant) =>
          tenant.tenantId === tenantId
      );

    if (!selectedTenant) {
      throw new Error(
        'MAVORA_TENANT_ACCESS_DENIED'
      );
    }
  } else if (
    accessibleTenants.length === 1
  ) {
    selectedTenant =
      accessibleTenants[0];
  } else {
    throw new Error(
      'MAVORA_TENANT_SELECTION_REQUIRED'
    );
  }

  if (!selectedTenant.editionCode) {
    throw new Error(
      'MAVORA_LICENSE_NOT_ACTIVE'
    );
  }

  const {
    data: assignments,
    error: assignmentError,
  } = await mavoraSupabase
    .from('role_assignments')
    .select('role_id, site_id')
    .eq(
      'membership_id',
      selectedTenant.membershipId
    )
    .eq(
      'tenant_id',
      selectedTenant.tenantId
    );

  if (assignmentError) {
    throw assignmentError;
  }

  if (
    !assignments
    || assignments.length === 0
  ) {
    throw new Error(
      'MAVORA_ROLE_NOT_ASSIGNED'
    );
  }

  const preferredAssignment =
    assignments.find(
      (assignment) =>
        assignment.site_id === null
    )
    ?? assignments[0];

  const roleIds = [
    ...new Set(
      assignments.map(
        (assignment) =>
          assignment.role_id
      )
    ),
  ];

  const {
    data: roles,
    error: rolesError,
  } = await mavoraSupabase
    .from('roles')
    .select(
      'id, code, name, is_active'
    )
    .in('id', roleIds)
    .eq(
      'tenant_id',
      selectedTenant.tenantId
    )
    .eq('is_active', true);

  if (rolesError) {
    throw rolesError;
  }

  const role =
    roles?.find(
      (item) =>
        item.id
        === preferredAssignment.role_id
    );

  if (!role) {
    throw new Error(
      'MAVORA_ROLE_NOT_FOUND'
    );
  }

  return {
    name,

    role:
      toLegacyUiRole(
        role.code
      ),

    roleCode:
      role.code,

    authUserId:
      userId,

    tenantId:
      selectedTenant.tenantId,

    tenantSlug:
      selectedTenant.tenantSlug,

    tenantName:
      selectedTenant.tenantName,

    membershipId:
      selectedTenant.membershipId,

    editionCode:
      selectedTenant.editionCode,

    licenseStatus:
      selectedTenant.licenseStatus,

    licenseType:
      selectedTenant.licenseType,

    enabledFeatures:
      selectedTenant.enabledFeatures,
  };
};

const resolveMavoraAuthResult = async (
  userId: string,
  fallbackName = 'User'
): Promise<MavoraAuthResult> => {
  const {
    name,
    tenants,
  } = await listMavoraTenantOptions(
    userId,
    fallbackName
  );

  const accessibleTenants =
    tenants.filter(
      (tenant) =>
        tenant.accessAllowed
        && tenant.editionCode !== null
    );

  if (accessibleTenants.length === 0) {
    throw new Error(
      'MAVORA_NO_ACTIVE_LICENSED_TENANT'
    );
  }

  if (accessibleTenants.length === 1) {
    return {
      kind: 'session',
      session:
        await resolveMavoraUserSession(
          userId,
          accessibleTenants[0].tenantId,
          name
        ),
    };
  }

  return {
    kind: 'tenant_selection',
    selection: {
      authUserId: userId,
      name,
      tenants,
    },
  };
};

export const selectMavoraTenant = async (
  tenantId: string
): Promise<MavoraUserSession> => {
  const {
    data: { session },
    error,
  } = await mavoraSupabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session?.user) {
    throw new Error(
      'MAVORA_AUTH_SESSION_NOT_FOUND'
    );
  }

  return resolveMavoraUserSession(
    session.user.id,
    tenantId,
    session.user.email ?? 'User'
  );
};

export const signInMavora = async (
  email: string,
  password: string
): Promise<MavoraAuthResult> => {
  const { data, error } =
    await mavoraSupabase.auth
      .signInWithPassword({
        email,
        password,
      });

  if (error || !data.user) {
    throw (
      error
      ?? new Error(
        'MAVORA_SIGN_IN_FAILED'
      )
    );
  }

  try {
    return await resolveMavoraAuthResult(
      data.user.id,
      data.user.email ?? 'User'
    );
  } catch (error) {
    await mavoraSupabase.auth.signOut();
    throw error;
  }
};

export const restoreMavoraSession =
  async (): Promise<
    MavoraAuthResult | null
  > => {
    const {
      data: { session },
      error,
    } =
      await mavoraSupabase.auth
        .getSession();

    if (error) {
      throw error;
    }

    if (!session?.user) {
      return null;
    }

    try {
      return await resolveMavoraAuthResult(
        session.user.id,
        session.user.email ?? 'User'
      );
    } catch {
      await mavoraSupabase.auth
        .signOut();

      return null;
    }
  };

export const signOutMavora = async (): Promise<void> => {
  const { error } = await mavoraSupabase.auth.signOut();

  if (error) {
    throw error;
  }
};
