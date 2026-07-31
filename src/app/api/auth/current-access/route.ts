import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient, hasSupabaseEnv } from "@/lib/supabase/server";
import type { Permission, Profile, Role, UserRole } from "@/lib/types";

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({
      email: null,
      emailConfirmed: true,
      profile: {
        id: "local",
        company_id: "local",
        user_id: null,
        name: "Ambiente local",
        email: "local@concept21.com.br",
        title: "Administrador",
        department_id: null,
        status: "active",
        avatar_url: null,
        is_master: true,
      },
      roles: [{ id: "master", name: "Administrador", is_master_role: true }],
      permissions: {},
    });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Sessão não encontrada." }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  const { data: profileData, error: profileError } = await admin
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const profile = (profileData ?? null) as Profile | null;
  let roles: Role[] = [];
  let permissions: Record<string, boolean> = {};

  if (profile) {
    const { data: userRoleData } = await admin
      .from("user_roles")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("profile_id", profile.id)
      .eq("active", true);

    const userRoles = (userRoleData ?? []) as UserRole[];
    const roleIds = userRoles.map((role) => role.role_id);

    if (roleIds.length) {
      const { data: roleData } = await admin
        .from("roles")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("active", true)
        .in("id", roleIds);
      roles = (roleData ?? []) as Role[];

      const activeRoleIds = roles.map((role) => role.id);
      if (activeRoleIds.length) {
        const { data: rolePermissionData } = await admin
          .from("role_permissions")
          .select("permission_id")
          .eq("company_id", profile.company_id)
          .in("role_id", activeRoleIds);
        const permissionIds = Array.from(
          new Set(
            ((rolePermissionData ?? []) as Array<{ permission_id: string | null }>)
              .map((item) => item.permission_id)
              .filter((permissionId): permissionId is string => Boolean(permissionId)),
          ),
        );

        if (permissionIds.length) {
          const { data: permissionData } = await admin
            .from("permissions")
            .select("*")
            .in("id", permissionIds);
          permissions = Object.fromEntries(
            ((permissionData ?? []) as Permission[]).map((permission) => [permission.key, true]),
          );
        }
      }
    }
  }

  return NextResponse.json({
    email: user.email ?? null,
    emailConfirmed: Boolean(user.email_confirmed_at),
    profile,
    roles,
    permissions,
  });
}
