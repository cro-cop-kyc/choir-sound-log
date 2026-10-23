import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAuthHandler,seal,unseal,allowedRoute} from '../auth-service/worker.js';
import {createOAuthSession} from '../oauth-session.js';
const ENV={GITHUB_CLIENT_ID:'test-app',GITHUB_CLIENT_SECRET:'test-secret',SESSION_SECRET:'test-session-secret-at-least-32-characters'};
const ORIGIN='https://auth.test',SITE='https://cro-cop-kyc.github.io',NONCE='11111111-1111-4111-8111-111111111111';
async function start(handler){const r=await handler(new Request(ORIGIN+'/auth/start?nonce='+NONCE),ENV);return {response:r,cookie:r.headers.get('Set-Cookie').split(';')[0],location:new URL(r.headers.get('Location'))};}
test('unconfigured service cannot authorize',async()=>assert.equal((await createAuthHandler()(new Request(ORIGIN+'/auth/start'),{})).status,503));
test('authorization has PKCE and no broad public_repo scope',async()=>{const x=await start(createAuthHandler());assert.equal(x.response.status,302);assert.equal(x.location.origin,'https://github.com');assert.equal(x.location.searchParams.get('scope'),null);assert.equal(x.location.searchParams.get('code_challenge_method'),'S256');assert.match(x.response.headers.get('Set-Cookie'),/Secure; HttpOnly; SameSite=Lax/);});
test('invalid state and missing cookie deny callbacks without network requests',async()=>{let calls=0;const h=createAuthHandler(async()=>{calls++;});const x=await start(h);const r=await h(new Request(ORIGIN+'/auth/callback?state=wrong&code=test',{headers:{Cookie:x.cookie}}),ENV);assert.equal(r.status,400);assert.equal(calls,0);});
test('valid owner gets encrypted app session, never GitHub token in browser',async()=>{
 const h=createAuthHandler(async(url)=>Response.json(url.includes('/access_token')?{access_token:'private-github-test-token',expires_in:3600}:url.endsWith('/user')?{login:'cro-cop-kyc'}:{permissions:{push:true}}));
 const x=await start(h),r=await h(new Request(ORIGIN+'/auth/callback?state='+x.location.searchParams.get('state')+'&code=test',{headers:{Cookie:x.cookie}}),ENV),html=await r.text();
 assert.ok(!html.includes('private-github-test-token'));const session=html.match(/"session":"([^"]+)"/)[1];const value=await unseal(session,ENV);assert.equal(value.owner,'cro-cop-kyc');assert.equal(value.githubToken,'private-github-test-token');assert.match(r.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
});
test('wrong account is denied and receives no session',async()=>{const h=createAuthHandler(async(url)=>Response.json(url.includes('/access_token')?{access_token:'private-token'}:{login:'another-user'}));const x=await start(h);const r=await h(new Request(ORIGIN+'/auth/callback?state='+x.location.searchParams.get('state')+'&code=test',{headers:{Cookie:x.cookie}}),ENV);const html=await r.text();assert.ok(html.includes('not_owner'));assert.ok(!html.includes('private-token'));assert.ok(!html.includes('"session":'));});
test('proxy rejects foreign repos, expired sessions and cross-origin writes',async()=>{
 const h=createAuthHandler(),session=await seal({owner:'cro-cop-kyc',expires:Date.now()+60000,githubToken:'test-private'},ENV);
 const req=(path,origin=SITE)=>new Request(ORIGIN+'/proxy'+path,{headers:{Origin:origin,Authorization:'Bearer '+session}});
 assert.equal((await h(req('/repos/another/repo'),ENV)).status,403);assert.equal((await h(req('/user','https://malicious.test'),ENV)).status,403);
 const expired=await seal({owner:'cro-cop-kyc',expires:1,githubToken:'test-private'},ENV);assert.equal((await h(new Request(ORIGIN+'/proxy/user',{headers:{Origin:SITE,Authorization:'Bearer '+expired}}),ENV)).status,401);
 assert.equal(allowedRoute('/repos/cro-cop-kyc/choir-sound-log/contents/app.js','PUT'),false);
});
test('proxy writes only the approved repository path with server-held credential',async()=>{
 const session=await seal({owner:'cro-cop-kyc',expires:Date.now()+60000,githubToken:'test-private'},ENV);let target,credential;
 const h=createAuthHandler(async(url,options)=>{target=url;credential=options.headers.Authorization;return Response.json({content:{sha:'test'}});});
 const r=await h(new Request(ORIGIN+'/proxy/repos/cro-cop-kyc/choir-sound-log/contents/records/'+NONCE+'.json',{method:'PUT',headers:{Origin:SITE,Authorization:'Bearer '+session,'Content-Type':'application/json'},body:'{}'}),ENV);
 assert.equal(r.status,200);assert.equal(target,'https://api.github.com/repos/cro-cop-kyc/choir-sound-log/contents/records/'+NONCE+'.json');assert.equal(credential,'Bearer test-private');assert.ok(!(await r.text()).includes('test-private'));
});
test('popup accepts only matching origin, window and nonce',async()=>{
 let listener,opened;const popup={closed:false,close(){this.closed=true;}};
 const host={open(url){opened=new URL(url);return popup;},addEventListener(_,f){listener=f;},removeEventListener(){listener=null;}};
 const promise=createOAuthSession(ORIGIN,host).login(),nonce=opened.searchParams.get('nonce');
 listener({origin:'https://malicious.test',source:popup,data:{type:'choir-github-oauth',nonce,session:'fake'}});assert.equal(popup.closed,false);
 listener({origin:ORIGIN,source:popup,data:{type:'choir-github-oauth',nonce,session:'encrypted-app-session'}});
 assert.deepEqual(await promise,{service:ORIGIN,session:'encrypted-app-session'});assert.equal(popup.closed,true);assert.equal(listener,null);
});
