import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { secureOrigin } from "@/lib/portal-session-policy";
import { parsePlatformInstall, PLATFORM_PROVIDER } from "@/lib/platform-install-policy";

function denied(status: number) { return NextResponse.json({ok:false},{status,headers:{"Cache-Control":"no-store"}}); }
export async function POST(request: Request) {
  const portal = secureOrigin(process.env.PLATFORM_IDENTITY_SUPABASE_URL);
  const key = process.env.PLATFORM_IDENTITY_PUBLISHABLE_KEY;
  const master = process.env.PLATFORM_SETUP_ADMIN_AUTH_USER_ID;
  const localMaster = process.env.PLATFORM_SETUP_LOCAL_MASTER_USER_ID;
  if (!portal || !key || !master || !localMaster || process.env.PLATFORM_SETUP_ENABLED !== "true") return denied(404);
  const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9._~-]+)$/)?.[1];
  if (!token) return denied(401);
  const central = createClient(portal, key, {auth:{persistSession:false,autoRefreshToken:false}});
  const {data:claims,error:claimsError} = await central.auth.getClaims(token);
  if (claimsError || !claims || claims.claims.client_id) return denied(403);
  const {data:{user},error} = await central.auth.getUser(token);
  if (error || user?.id !== master || !user.email_confirmed_at) return denied(403);
  const admin = getSupabaseAdminClient();
  const {data:profile} = await admin.from("profiles").select("id,status,is_master").eq("user_id",localMaster).maybeSingle();
  if (!profile || profile.status !== "active") return denied(403);
  
  const { data: assignments } = await admin.from("user_roles").select("role_id").eq("profile_id", profile.id).eq("active", true);
  const roleIds = assignments?.map(row => row.role_id) ?? [];
  const { data: roles } = roleIds.length ? await admin.from("roles").select("id").in("id", roleIds).eq("is_master_role", true).eq("active", true) : {data:[]};
  if (!roles?.length && !profile.is_master) return denied(403);
  const { data: approved } = await admin.from("corporate_gate_subjects").select("auth_user_id,portal_link_id").eq("allowed", true);
  const approvedIds = approved?.map(row => row.auth_user_id) ?? [];

  if (Number(request.headers.get("content-length") ?? "0") > 16000) return denied(413);
  const payload = parsePlatformInstall(await request.json().catch(() => null), approvedIds);
  if (!payload) return denied(400);
  if (payload.bindings.some(binding => !approved?.some(row => row.auth_user_id === binding.authUserId && row.portal_link_id === binding.portalLinkId))) return denied(403);
  const provider = { name:"Concept21 · Conta central", client_id:payload.clientId, client_secret:payload.clientSecret,
    issuer:portal+"/auth/v1", scopes:["openid","email","profile"], enabled:true, pkce_enabled:true };
  const {data:existing} = await admin.auth.admin.customProviders.getProvider(PLATFORM_PROVIDER);
  const result = existing ? await admin.auth.admin.customProviders.updateProvider(PLATFORM_PROVIDER,provider)
    : await admin.auth.admin.customProviders.createProvider({...provider,identifier:PLATFORM_PROVIDER,provider_type:"oidc"});
  if (result.error) return denied(503);
  const {error:bindingError} = await admin.from("platform_account_bindings").upsert(payload.bindings.map(binding => ({
    auth_user_id:binding.authUserId,portal_auth_user_id:binding.portalAuthUserId,portal_link_id:binding.portalLinkId,allowed:true
  })),{onConflict:"auth_user_id"});
  if (bindingError) return denied(503);
  const {error:configError} = await admin.from("platform_identity_config").upsert({key:"central_login",enabled:true});
  if (configError) return denied(503);
  return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}
