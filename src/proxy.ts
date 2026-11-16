import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/platform-proxy";
import { checkPlatformMaintenance } from "@/lib/platform-maintenance-gate";
export async function proxy(request:NextRequest){
 const identity=await updateSession(request);
 if(identity.status!==200||request.nextUrl.pathname.startsWith("/auth/"))return identity;
 const maintenance=await checkPlatformMaintenance(request);
 if(maintenance){identity.cookies.getAll().forEach(cookie=>maintenance.cookies.set(cookie));return maintenance;}
 return identity;
}
export const config={matcher:["/((?!_next(?:/|$)|brand(?:/|$)|icons(?:/|$)|favicon.ico$|manifest.webmanifest$|robots.txt$|sitemap.xml$|sw.js$).*)"]};
