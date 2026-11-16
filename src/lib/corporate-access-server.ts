import "server-only";
import { platformAdmin,portalSessionAllowed } from "@/lib/platform-auth";
export type CorporateAccess="allowed"|"revoked"|"unavailable";
export async function checkCorporateAccess(token:string):Promise<CorporateAccess>{
 if(!token)return "revoked";
 try{const {data:{user},error}=await platformAdmin().auth.getUser(token);
  return !error&&user&&await portalSessionAllowed(user,token)?"allowed":"revoked";
 }catch{return "unavailable";}
}
