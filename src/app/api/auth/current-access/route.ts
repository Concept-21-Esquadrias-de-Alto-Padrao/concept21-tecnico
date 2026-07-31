import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { TECHNICAL_PERMISSIONS } from "@/lib/module-access";
import type { AccessReviewRequest, Permission, Profile, Role, UserRole } from "@/lib/types";

type SupabaseAuthUser = {
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

function isServerUserEmailConfirmed(user: SupabaseAuthUser) {
  return Boolean(user.email_confirmed_at ?? user.confirmed_at);
}

function isMissingRelation(error?: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  );
}

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
  let accessReviewRequests: AccessReviewRequest[] = [];

  if (profile) {
    const { data: requestData, error: requestError } = await admin
      .from("access_review_requests")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("profile_id", profile.id);

    if (requestError && !isMissingRelation(requestError)) {
      return NextResponse.json({ error: requestError.message }, { status: 500 });
    }

    accessReviewRequests = (requestData ?? []) as AccessReviewRequest[];

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

    if (profile.is_master && roles.length === 0) {
      roles = [
        {
          id: "master-profile",
          company_id: profile.company_id,
          name: "Administrador",
          description: "Acesso total",
          is_master_role: true,
          active: true,
        },
      ];
    }

    if (profile.is_master || roles.some((role) => role.is_master_role)) {
      permissions = Object.fromEntries(
        TECHNICAL_PERMISSIONS.map((permissionKey) => [permissionKey, true]),
      );
    }
  }

  return NextResponse.json({
    email: user.email ?? null,
    emailConfirmed: isServerUserEmailConfirmed(user),
    profile: profile
      ? {
          ...profile,
          access_review_requests: accessReviewRequests,
        }
      : null,
    roles,
    permissions,
  });
}
