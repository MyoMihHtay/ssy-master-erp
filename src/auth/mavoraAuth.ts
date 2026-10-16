import { mavoraSupabase } from '../mavoraSupabase';

export interface MavoraUserSession {
  name: string;
  role: string;
  roleCode: string;
  authUserId: string;
  tenantId: string;
  tenantSlug: string;
  membershipId: string;
}

const TARGET_TENANT_SLUG = 'sat-sat-yo';

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

export const resolveMavoraUserSession = async (
  userId: string,
  fallbackName = 'User'
): Promise<MavoraUserSession> => {
  const { data: profile, error: profileError } = await mavoraSupabase
    .from('profiles')
    .select('id, display_name, status')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile || profile.status !== 'active') {
    throw new Error('MAVORA_PROFILE_NOT_ACTIVE');
  }

  const { data: memberships, error: membershipError } =
    await mavoraSupabase
      .from('tenant_memberships')
      .select('id, tenant_id, status, default_site_id')
      .eq('user_id', userId)
      .eq('status', 'active');

  if (membershipError) {
    throw membershipError;
  }

  if (!memberships || memberships.length === 0) {
    throw new Error('MAVORA_MEMBERSHIP_NOT_FOUND');
  }

  const tenantIds = [
    ...new Set(memberships.map((membership) => membership.tenant_id)),
  ];

  const { data: tenants, error: tenantError } = await mavoraSupabase
    .from('tenants')
    .select('id, slug, name, status')
    .in('id', tenantIds)
    .eq('status', 'active');

  if (tenantError) {
    throw tenantError;
  }

  const tenant = tenants?.find(
    (item) => item.slug === TARGET_TENANT_SLUG
  );

  if (!tenant) {
    throw new Error('MAVORA_TENANT_ACCESS_DENIED');
  }

  const membership = memberships.find(
    (item) => item.tenant_id === tenant.id
  );

  if (!membership) {
    throw new Error('MAVORA_MEMBERSHIP_NOT_FOUND');
  }

  const { data: assignments, error: assignmentError } =
    await mavoraSupabase
      .from('role_assignments')
      .select('role_id, site_id')
      .eq('membership_id', membership.id)
      .eq('tenant_id', tenant.id);

  if (assignmentError) {
    throw assignmentError;
  }

  if (!assignments || assignments.length === 0) {
    throw new Error('MAVORA_ROLE_NOT_ASSIGNED');
  }

  const preferredAssignment =
    assignments.find((assignment) => assignment.site_id === null) ??
    assignments[0];

  const roleIds = [
    ...new Set(assignments.map((assignment) => assignment.role_id)),
  ];

  const { data: roles, error: rolesError } = await mavoraSupabase
    .from('roles')
    .select('id, code, name, is_active')
    .in('id', roleIds)
    .eq('tenant_id', tenant.id)
    .eq('is_active', true);

  if (rolesError) {
    throw rolesError;
  }

  const role = roles?.find(
    (item) => item.id === preferredAssignment.role_id
  );

  if (!role) {
    throw new Error('MAVORA_ROLE_NOT_FOUND');
  }

  return {
    name: profile.display_name?.trim() || fallbackName,
    role: toLegacyUiRole(role.code),
    roleCode: role.code,
    authUserId: userId,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    membershipId: membership.id,
  };
};

export const signInMavora = async (
  email: string,
  password: string
): Promise<MavoraUserSession> => {
  const { data, error } =
    await mavoraSupabase.auth.signInWithPassword({
      email,
      password,
    });

  if (error || !data.user) {
    throw error ?? new Error('MAVORA_SIGN_IN_FAILED');
  }

  try {
    return await resolveMavoraUserSession(
      data.user.id,
      data.user.email ?? 'User'
    );
  } catch (error) {
    await mavoraSupabase.auth.signOut();
    throw error;
  }
};

export const restoreMavoraSession =
  async (): Promise<MavoraUserSession | null> => {
    const {
      data: { session },
      error,
    } = await mavoraSupabase.auth.getSession();

    if (error) {
      throw error;
    }

    if (!session?.user) {
      return null;
    }

    try {
      return await resolveMavoraUserSession(
        session.user.id,
        session.user.email ?? 'User'
      );
    } catch {
      await mavoraSupabase.auth.signOut();
      return null;
    }
  };

export const signOutMavora = async (): Promise<void> => {
  const { error } = await mavoraSupabase.auth.signOut();

  if (error) {
    throw error;
  }
};
