"use client";

import type { User } from "@supabase/supabase-js";
import {
  createSupabaseBrowserClient,
  createSupabaseSignupClient,
  hasSupabaseBrowserEnv,
} from "@/lib/supabase/client";
import { getPublicAppOrigin } from "@/lib/supabase/config";
import type { AccessReviewRequest, Profile } from "@/lib/types";

type SupabaseUserWithConfirmedAt = User & {
  confirmed_at?: string | null;
};

export type CurrentUserAccess = {
  email: string | null;
  emailConfirmed: boolean;
  profile:
    | (Profile & {
        access_review_requests?: AccessReviewRequest[];
      })
    | null;
  roles: Array<{ id: string; name: string; is_master_role: boolean }>;
  permissions: Record<string, boolean>;
};

function getSignupEmailRedirectTo() {
  const callbackUrl = new URL("/auth/callback", getPublicAppOrigin());
  callbackUrl.searchParams.set("next", "/login?confirmed=1");
  return callbackUrl.toString();
}

export function isAuthUserEmailConfirmed(user?: User | null) {
  if (!user) return false;
  const confirmedAt = user.email_confirmed_at ?? (user as SupabaseUserWithConfirmedAt).confirmed_at;
  return Boolean(confirmedAt);
}

export function isCurrentUserMaster(access: CurrentUserAccess) {
  return Boolean(access.profile?.is_master || access.roles.some((role) => role.is_master_role));
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw new Error(error.message);

  if (!isAuthUserEmailConfirmed(data.user)) {
    await supabase.auth.signOut();
    throw new Error("Confirme seu e-mail antes de acessar a plataforma.");
  }

  return data;
}

export async function signUpWithEmail(input: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
}) {
  const supabase = createSupabaseSignupClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: getSignupEmailRedirectTo(),
      data: {
        name: input.fullName.trim(),
        full_name: input.fullName.trim(),
        phone: input.phone?.trim() || null,
        module: "technical",
      },
    },
  });

  if (error) throw new Error(error.message);

  if (data.user && data.session) {
    await supabase.auth.signOut();
    throw new Error(
      "A confirmação de e-mail precisa estar habilitada no Supabase antes de liberar novos cadastros.",
    );
  }

  return data;
}

export async function getCurrentUserAccess() {
  const response = await fetch("/api/auth/current-access", {
    cache: "no-store",
  });

  if (!response.ok) return null;
  return (await response.json()) as CurrentUserAccess;
}

export async function requestCurrentUserAccessReview() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("request_access_review");

  if (error) throw new Error(error.message);
  return typeof data === "string" ? data : null;
}

export async function signOut() {
  if (!hasSupabaseBrowserEnv()) return;
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.signOut();
}
