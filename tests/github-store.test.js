import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGitHubStore} from '../github-store.js';
const ID='11111111-1111-4111-8111-111111111111';
function fixture(login='cro-cop-kyc'){
 const files=new Map(),writes=[];let version=0;
 const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
 const fetcher=async(url,o)=>{
  if(url.endsWith('/user'))return response({login});
  if(url.endsWith('/choir-sound-log'))return response({permissions:{push:true}});
  const path=new URL(url).pathname.split('/contents/')[1];
  if(o.method==='GET'){
   if(path==='records')return response([...files].map(([name])=>({type:'file',name:name.split('/')[1]})));
   return files.has(path)?response(files.get(path)):response({},404);
  }
  assert.match(o.headers.Authorization,/Bearer /);writes.push(o.method);const body=JSON.parse(o.body);
  if(o.method==='PUT'){const f={content:body.content,sha:String(++version)};files.set(path,f);return response({content:{sha:f.sha}},201);}
  if(o.method==='DELETE'){assert.equal(body.sha,files.get(path).sha);files.delete(path);return response({});}
 };
 return {store:createGitHubStore(fetcher),files,writes};
}
test('visitors cannot save, delete or upload',async()=>{
 const {store}=fixture();await assert.rejects(store.save({id:ID}),/관리자/);await assert.rejects(store.remove({id:ID}),/관리자/);await assert.rejects(store.uploadVideo({size:1},ID),/관리자/);
});
test('only site owner can connect',async()=>{
 const {store}=fixture('someone-else');await assert.rejects(store.connect('test-only-key'),/관리자 계정/);assert.equal(store.connected,false);
});
test('save, reread, edit, conflict, deletion and disconnect',async()=>{
 const {store,writes}=fixture();await store.connect('test-only-key');
 const record={id:ID,date:'2026-10-24',summary:'한글 기록',assignments:[{name:'가상대원',microphone:'2'}]};
 const saved=await store.save(record);assert.equal((await store.list())[0].summary,'한글 기록');assert.equal(saved._sha,'1');
 await store.save(record);assert.deepEqual(writes,['PUT']);
 const edited=await store.save({...saved,improvement:'수정 내용'},saved._sha);assert.equal((await store.list())[0].improvement,'수정 내용');
 await assert.rejects(store.save({...saved,improvement:'오래된 수정'},saved._sha),/변경된 기록/);
 await assert.rejects(store.remove(saved),/변경되었습니다/);
 await store.remove(edited);assert.equal((await store.list()).length,0);
 store.disconnect();assert.equal(store.connected,false);await assert.rejects(store.save(record),/관리자/);
});
