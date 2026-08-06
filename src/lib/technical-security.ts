import { unstable_noStore as noStore } from "next/cache";
import { requireMasterAccess } from "@/lib/server-access";
import type { AccessReviewRequest, Permission, Profile, Role, RolePermission, UserRole } from "@/lib/types";

export type TechnicalSecurityUser = Profile & {
  user_roles: Array<UserRole & { role: Role | null }>;
  access_review_requests: AccessReviewRequest[];
};

export type TechnicalSecurityData = {
  roles: Role[];
  permissions: Permission[];
  rolePermissions: RolePermission[];
  users: TechnicalSecurityUser[];
  currentProfileId: string;
};

function hasActiveRole(user: TechnicalSecurityUser) {
  return user.user_roles.some((userRole) => userRole.active !== false && userRole.role?.active);
}

function sortUsers(users: TechnicalSecurityUser[]) {
  return [...users].sort((left, right) => {
    const leftPending = left.status === "active" && Boolean(left.user_id) && !hasActiveRole(left) ? 0 : 1;
    const rightPending = right.status === "active" && Boolean(right.user_id) && !hasActiveRole(right) ? 0 : 1;
    if (leftPending !== rightPending) return leftPending - rightPending;
    return left.name.localeCompare(right.name, "pt-BR");
  });
}

export async function getTechnicalSecurityData(): Promise<TechnicalSecurityData> {
  noStore();

  const context = await requireMasterAccess();
  const [
    rolesResult,
    permissionsResult,
    rolePermissionsResult,
    profilesResult,
    userRolesResult,
    requestsResult,
  ] = await Promise.all([
    context.admin
      .from("roles")
      .select("*")
      .eq("company_id", context.profile.company_id)
      .order("name", { ascending: true }),
    context.admin
      .from("permissions")
      .select("*")
      .like("key", "technical.%")
      .order("key", { ascending: true }),
    context.admin
      .from("role_permissions")
      .select("*")
      .eq("company_id", context.profile.company_id),
    context.admin
      .from("profiles")
      .select("*")
      .eq("company_id", context.profile.company_id)
      .order("name", { ascending: true }),
    context.admin
      .from("user_roles")
      .select("*")
      .eq("company_id", context.profile.company_id),
    context.admin
      .from("access_review_requests")
      .select("*")
      .eq("company_id", context.profile.company_id),
  ]);

  const queryError = [
    rolesResult.error,
    permissionsResult.error,
    rolePermissionsResult.error,
    profilesResult.error,
    userRolesResult.error,
    requestsResult.error,
  ].find(Boolean);

  if (queryError) throw new Error(queryError.message);

  const roles = (rolesResult.data ?? []) as Role[];
  const rolesById = new Map(roles.map((role) => [role.id, role]));

  const userRolesByProfile = new Map<string, Array<UserRole & { role: Role | null }>>();
  ((userRolesResult.data ?? []) as UserRole[]).forEach((userRole) => {
    const existing = userRolesByProfile.get(userRole.profile_id) ?? [];
    existing.push({
      ...userRole,
      role: rolesById.get(userRole.role_id) ?? null,
    });
    userRolesByProfile.set(userRole.profile_id, existing);
  });

  const requestsByProfile = new Map<string, AccessReviewRequest[]>();
  ((requestsResult.data ?? []) as AccessReviewRequest[]).forEach((request) => {
    const existing = requestsByProfile.get(request.profile_id) ?? [];
    existing.push(request);
    requestsByProfile.set(request.profile_id, existing);
  });

  const users = ((profilesResult.data ?? []) as Profile[]).map<TechnicalSecurityUser>((profile) => ({
    ...profile,
    user_roles: userRolesByProfile.get(profile.id) ?? [],
    access_review_requests: requestsByProfile.get(profile.id) ?? [],
  }));

  return {
    roles,
    permissions: (permissionsResult.data ?? []) as Permission[],
    rolePermissions: (rolePermissionsResult.data ?? []) as RolePermission[],
    users: sortUsers(users),
    currentProfileId: context.profile.id,
  };
}
