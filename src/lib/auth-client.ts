"use client";

import { createSupabaseBrowserClient, hasSupabaseBrowserEnv } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export type CurrentUserAccess = {
  email: string | null;
  emailConfirmed: boolean;
  profile: Profile | null;
  roles: Array<{ id: string; name: string; is_master_role: boolean }>;
  permissions: Record<string, boolean>;
};

export function isCurrentUserMaster(access: CurrentUserAccess) {
  return Boolean(access.profile?.is_master || access.roles.some((role) => role.is_master_role));
}

export async function getCurrentUserAccess() {
  const response = await fetch("/api/auth/current-access", {
    cache: "no-store",
  });

  if (!response.ok) return null;
  return (await response.json()) as CurrentUserAccess;
}

export async function signOut() {
  if (!hasSupabaseBrowserEnv()) return;
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.signOut();
}
