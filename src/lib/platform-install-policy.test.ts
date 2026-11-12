import {it as test} from "vitest";
import assert from "node:assert/strict";
import { parsePlatformInstall } from "./platform-install-policy";
const a="11111111-1111-4111-8111-111111111111", b="22222222-2222-4222-8222-222222222222";
const c="33333333-3333-4333-8333-333333333333", d="44444444-4444-4444-8444-444444444444";
const payload={clientId:c,clientSecret:"ephemeral-client-secret-for-test-only",bindings:[
 {authUserId:a,portalAuthUserId:c,portalLinkId:a},{authUserId:b,portalAuthUserId:d,portalLinkId:b}]};
test("provider installation binds the complete exact set of previously approved module accounts",()=>{
 assert.equal(parsePlatformInstall(payload,[a,b])?.bindings.length,2);
 assert.equal(parsePlatformInstall(payload,[a]),null);
 assert.equal(parsePlatformInstall(payload,[a,b,c]),null);
});
test("provider installation rejects duplicate central subjects, missing accounts, and unapproved accounts",()=>{
 assert.equal(parsePlatformInstall({...payload,bindings:[payload.bindings[0],payload.bindings[0]]},[a,b]),null);
 assert.equal(parsePlatformInstall({...payload,bindings:[payload.bindings[0],{...payload.bindings[1],portalAuthUserId:c}]},[a,b]),null);
 assert.equal(parsePlatformInstall({...payload,bindings:[payload.bindings[0],{...payload.bindings[1],authUserId:d}]},[a,b]),null);
});
test("provider installation rejects malformed client credentials and malformed review configuration",()=>{
 assert.equal(parsePlatformInstall({...payload,clientSecret:""},[a,b]),null);
 assert.equal(parsePlatformInstall({...payload,clientId:"https://evil.example"},[a,b]),null);
 assert.equal(parsePlatformInstall(payload,[]),null);
 assert.equal(parsePlatformInstall(payload,["invalid"]),null);
});
