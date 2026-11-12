import { beforeEach,describe,expect,it,vi } from "vitest";
import { NextRequest } from "next/server";
const mocks=vi.hoisted(()=>({fetch:vi.fn(),session:vi.fn()}));
vi.mock("@supabase/ssr",()=>({createServerClient:()=>({auth:{getSession:mocks.session}})}));
import { checkPlatformMaintenance } from "./platform-maintenance-gate";
const state={enabled:false,globalEnabled:false,moduleEnabled:false,legacyEnabled:false,message:"Aguarde."};
describe("server maintenance gate",()=>{
 beforeEach(()=>{
  vi.stubGlobal("fetch",mocks.fetch);mocks.fetch.mockReset();mocks.session.mockReset();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://module.supabase.co");vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","publishable-test");
  mocks.session.mockResolvedValue({data:{session:null}});
 });
 it("preserves normal requests when all controls are off",async()=>{
  mocks.fetch.mockResolvedValue(Response.json(state));expect(await checkPlatformMaintenance(new NextRequest("https://module.example/tecnico"))).toBeNull();
 });
 it("redirects an ordinary page to the maintenance message",async()=>{
  mocks.fetch.mockResolvedValue(Response.json({...state,enabled:true,globalEnabled:true}));
  const result=await checkPlatformMaintenance(new NextRequest("https://module.example/tecnico"));
  expect(result?.status).toBe(303);expect(result?.headers.get("location")).toBe("https://concept21-portal.vercel.app/manutencao?modulo=technical");
 });
 it("rejects an API operation before its handler executes",async()=>{
  mocks.fetch.mockResolvedValue(Response.json({...state,enabled:true}));
  const result=await checkPlatformMaintenance(new NextRequest("https://module.example/api/contracts",{method:"POST"}));
  expect(result?.status).toBe(503);expect(await result?.json()).toMatchObject({maintenance:true});
 });
 it("keeps a native administrator verified by the module authority",async()=>{
  mocks.fetch.mockResolvedValueOnce(Response.json({...state,enabled:true})).mockResolvedValueOnce(Response.json({canAccess:true,admin:true}));
  const result=await checkPlatformMaintenance(new NextRequest("https://module.example/tecnico",{headers:{Authorization:"Bearer verified-native-session"}}));
  expect(result?.status).toBe(200);expect(result?.headers.get("location")).toBeNull();expect(mocks.fetch).toHaveBeenCalledTimes(2);
 });
 it("does not trust an unverified session token",async()=>{
  mocks.fetch.mockResolvedValueOnce(Response.json({...state,enabled:true})).mockResolvedValueOnce(Response.json({canAccess:false},{status:403}));
  const result=await checkPlatformMaintenance(new NextRequest("https://module.example/tecnico",{headers:{Authorization:"Bearer untrusted-session"}}));expect(result?.status).toBe(303);
 });
 it("fails closed if module availability cannot be verified",async()=>{
  mocks.fetch.mockRejectedValue(new Error("offline"));expect((await checkPlatformMaintenance(new NextRequest("https://module.example/tecnico")))?.status).toBe(503);
 });
 it.each(["/auth/complete","/auth/portal-logout","/api/platform-maintenance/status","/login?admin=1"])("preserves the exact recovery route %s",async path=>{
  expect(await checkPlatformMaintenance(new NextRequest("https://module.example"+path))).toBeNull();expect(mocks.fetch).not.toHaveBeenCalled();
 });
});
