import { createServerClient } from "@supabase/ssr";
import { NextResponse,type NextRequest } from "next/server";
import { assertSupabasePublicConfig } from "@/lib/supabase/config";
import { secureOrigin } from "@/lib/portal-session-policy";
import { isLocalAuthPath,portalTransitions } from "@/lib/portal-identity-policy";
import { portalSessionAllowed } from "@/lib/platform-auth";
export async function updateSession(request:NextRequest){
 const path=request.nextUrl.pathname,portal=secureOrigin(process.env.NEXT_PUBLIC_PORTAL_ORIGIN)??"https://concept21-portal.vercel.app";
 const back=()=>NextResponse.redirect(portal+"/",{status:303,headers:{"Cache-Control":"private, no-store"}});
 if(isLocalAuthPath(path))return back();
 if((portalTransitions.has(path)&&["GET","HEAD"].includes(request.method))||path==="/api/platform-session/status"||path==="/api/platform-maintenance/status")return NextResponse.next();
 if(path==="/api/internal/platform-install")return new NextResponse(null,{status:410});
 if(path==="/"&&request.nextUrl.searchParams.has("code")){const target=request.nextUrl.clone();target.pathname="/auth/complete";return NextResponse.rewrite(target);}
 let response=NextResponse.next({request});response.headers.set("Cache-Control","private, no-store");
 try{
  const {url,anonKey:key}=assertSupabasePublicConfig();
  const auth=createServerClient(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll:items=>{
   items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});response.headers.set("Cache-Control","private, no-store");items.forEach(({name,value,options})=>response.cookies.set(name,value,options));
  }}});
  const {data:{user},error}=await auth.auth.getUser();
  if(!error&&user){const {data:{session}}=await auth.auth.getSession();if(session&&await portalSessionAllowed(user,session.access_token))return response;}
 }catch{/* Unavailable authority never authorizes a module request. */}
 const denied=path.startsWith("/api/")?NextResponse.json({allowed:false,error:"Confirme seu primeiro acesso no Portal Concept21."},{status:401,headers:{"Cache-Control":"no-store"}}):back();
 response.cookies.getAll().forEach(cookie=>denied.cookies.set(cookie));return denied;
}
