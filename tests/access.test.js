import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guard} from '../worker/access.js';
const secret='a'.repeat(48), origin='https://example.test';
test('missing configuration fails closed',()=>assert.equal(guard(new Request(origin),null).status,503));
test('root, assets, APIs and videos all deny access without link cookie',()=>{
 for(const path of ['/','/app.js','/api/records','/media/video'])assert.equal(guard(new Request(origin+path),secret).status,404);
});
test('shared link grants secure HttpOnly cookie then removes secret from address',()=>{
 const r=guard(new Request(origin+'/s/'+secret),secret);
 assert.equal(r.status,303);assert.equal(r.headers.get('Location'),'/');
 assert.match(r.headers.get('Set-Cookie'),/Secure; HttpOnly; SameSite=Lax/);
});
test('valid cookie grants access and revoked links fail',()=>{
 const r=new Request(origin+'/api/records',{headers:{Cookie:'choir_access='+secret}});
 assert.equal(guard(r,secret),null);assert.equal(guard(r,'b'.repeat(48)).status,404);
});
test('cross origin writes fail even with shared cookie',()=>{
 const r=new Request(origin+'/api/records',{method:'POST',headers:{Cookie:'choir_access='+secret,Origin:'https://other.test'}});
 assert.equal(guard(r,secret).status,403);
});
