import test from "node:test";
import assert from "node:assert/strict";
import {validPortalSessionClaims,portalSubject,bindingAllows} from "../src/lib/portal-identity-policy.ts";
const u="00000000-0000-4000-8000-000000000001",p="00000000-0000-4000-8000-000000000002",s="00000000-0000-4000-8000-000000000003";
const claims={sub:u,session_id:s,amr:[{method:"oauth"}]};
test("native password and delegated OAuth tokens cannot renew central authorization",()=>{
 assert.equal(validPortalSessionClaims(claims,u),true);
 for(const invalid of [{...claims,amr:[{method:"password"}]},{...claims,client_id:p},{...claims,session_id:undefined},{...claims,sub:p}])assert.equal(validPortalSessionClaims(invalid,u),false);
});
test("legacy providers, mismatched and revoked identities are denied",()=>{
 assert.equal(portalSubject([{provider:"email",id:p}]),null);assert.equal(portalSubject([{provider:"custom:concept21",id:p}]),null);
 assert.equal(bindingAllows(u,p,{auth_user_id:u,portal_auth_user_id:p,allowed:false}),false);
 assert.equal(bindingAllows(u,s,{auth_user_id:u,portal_auth_user_id:p,allowed:true}),false);
});
