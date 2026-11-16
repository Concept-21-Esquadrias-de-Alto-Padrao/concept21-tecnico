"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
export function PortalSessionWatchdog(){
 const path=usePathname();
 useEffect(()=>{
  if(path.startsWith("/auth/")||path.startsWith("/api/"))return;
  let active=true,pending=false;
  const check=async()=>{if(pending||document.visibilityState==="hidden")return;pending=true;
   try{const response=await fetch("/api/platform-session/status",{cache:"no-store"});const value=await response.json();
    if(active&&(!response.ok||value.allowed!==true))window.location.replace((process.env.NEXT_PUBLIC_PORTAL_ORIGIN??"https://concept21-portal.vercel.app")+"/");
   }catch{if(active)window.location.replace((process.env.NEXT_PUBLIC_PORTAL_ORIGIN??"https://concept21-portal.vercel.app")+"/");}finally{pending=false;}};
  void check();const timer=window.setInterval(()=>void check(),8000);window.addEventListener("focus",check);document.addEventListener("visibilitychange",check);
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener("focus",check);document.removeEventListener("visibilitychange",check);};
 },[path]);return null;
}
