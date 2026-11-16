import "server-only";
import type { SupabaseClient,User } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { bindingAllows,portalSubject,validPortalSessionClaims } from "@/lib/portal-identity-policy";
export function platformAdmin(){return getSupabaseAdminClient() as SupabaseClient;}
export async function centralLoginEnabled(){
 const {data,error}=await platformAdmin().from("platform_identity_config").select("enabled").eq("key","central_login").maybeSingle();
 if(error||!data)throw new Error("A autenticação central não está disponível.");return data.enabled===true;
}
export async function portalSessionAllowed(user:User,token:string){
 try{
  if(!token||!await centralLoginEnabled())return false;
  const subject=portalSubject(user.identities),admin=platformAdmin();
  const {data:binding,error}=await admin.from("platform_account_bindings").select("auth_user_id,portal_auth_user_id,allowed").eq("auth_user_id",user.id).maybeSingle();
  if(error||!bindingAllows(user.id,subject,binding))return false;
  const {data:claims,error:claimError}=await admin.auth.getClaims(token);
  if(claimError||!validPortalSessionClaims(claims?.claims,user.id))return false;
  const response=await fetch("https://concept21-portal.vercel.app/api/internal/module-access",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({moduleKey:"technical"}),cache:"no-store",signal:AbortSignal.timeout(7000)});
  if(!response.ok||(await response.json()).allowed!==true)return false;
  const {data:allowed,error:leaseError}=await admin.rpc("platform_identity_lease",{p_auth_user_id:user.id,p_portal_subject:subject,p_session_id:claims!.claims.session_id});
  return !leaseError&&allowed===true;
 }catch{return false;}
}
