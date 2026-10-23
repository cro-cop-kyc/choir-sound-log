import {guard,protectionHeaders} from './access.js';
const reply=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{...protectionHeaders,'Content-Type':'application/json'}});
const id=s=>/^[a-f0-9-]{36}$/.test(s||'');
const read=async(e,k)=>{const o=await e.BUCKET.get(k);return o?o.json():null;};
const write=(e,k,v)=>e.BUCKET.put(k,JSON.stringify(v));
async function all(e,prefix){let cursor,out=[];do{const p=await e.BUCKET.list({prefix,cursor});out.push(...p.objects);cursor=p.truncated?p.cursor:undefined;}while(cursor);return Promise.all(out.map(o=>read(e,o.key)));}
function str(s,max=10000){if(typeof s!=='string'||!s.trim()||s.length>max)throw Error();return s.trim();}
export default {async fetch(req,e){
 const denied=guard(req,e.SHARE_TOKEN);if(denied)return denied;
 const p=new URL(req.url).pathname,parts=p.split('/').filter(Boolean),stamp=()=>new Date().toISOString();
 try{
 if(req.method==='GET'&&ASSETS[p])return new Response(ASSETS[p].body,{headers:{...protectionHeaders,'Content-Type':ASSETS[p].type}});
 if(p==='/api/config')return reply({hosted:true});
 if(!e.BUCKET)return reply({error:'저장소 준비 중입니다.'},503);
 if(p==='/api/uploads'&&req.method==='POST'){const m=await req.json();if(!id(m.id)||!Number.isSafeInteger(m.size)||m.size<1||m.size>1024**3||!m.filename?.toLowerCase().endsWith('.mp4'))throw Error();await write(e,'uploads/'+m.id,{...m,chunkSize:5242880});return reply({id:m.id});}
 if(parts[0]==='api'&&parts[1]==='uploads'&&id(parts[2])&&parts[3]==='parts'&&req.method==='PUT'){
  const m=await read(e,'uploads/'+parts[2]),n=Number(parts[4]);if(!m||!Number.isInteger(n)||n<0||n>=Math.ceil(m.size/m.chunkSize))throw Error();
  const b=await req.arrayBuffer();if(b.byteLength!==Math.min(m.chunkSize,m.size-n*m.chunkSize))throw Error();if(n===0&&!new TextDecoder().decode(b.slice(0,64)).includes('ftyp'))throw Error();
  await e.BUCKET.put('videos/'+m.id+'/'+n,b);return reply({ok:true});
 }
 if(p==='/api/records'&&req.method==='GET'){const rs=await all(e,'records/');for(const r of rs){const edit=await read(e,'improvements/'+r.id);if(edit)r.improvement=edit.content;}return reply(rs.sort((a,b)=>b.date.localeCompare(a.date)));}
 if(p==='/api/records'&&req.method==='POST'){
  const m=await req.json();if(!id(m.requestId))throw Error();const old=await read(e,'records/'+m.requestId);if(old)return reply(old);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(m.date)||!Number.isInteger(m.choirCount)||m.choirCount<1||m.choirCount>1000)throw Error();const u=await read(e,'uploads/'+m.uploadId);if(!u)throw Error();
  for(let i=0;i<Math.ceil(u.size/u.chunkSize);i++){const o=await e.BUCKET.head('videos/'+u.id+'/'+i);if(!o||o.size!==Math.min(u.chunkSize,u.size-i*u.chunkSize))throw Error();}
  const r={id:m.requestId,date:m.date,operator:str(m.operator,80),summary:str(m.summary),improvement:str(m.improvement),choirCount:m.choirCount,microphones:str(m.microphones,200),filename:u.filename,size:u.size,uploadId:u.id,chunkSize:u.chunkSize,created:stamp(),mode:'manual',analysisStatus:'failed',test:m.test===true};
  await e.BUCKET.put('records/'+r.id,JSON.stringify(r),{onlyIf:{etagDoesNotMatch:'*'}});return reply(await read(e,'records/'+r.id),201);
 }
 if(parts[0]==='media'&&id(parts[1])&&req.method==='GET'){
  const r=await read(e,'records/'+parts[1]);if(!r)return reply({error:'영상이 없습니다.'},404);
  let start=0,end=r.size-1;const range=req.headers.get('Range'),match=range?.match(/^bytes=(\d+)-(\d*)$/);if(match){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;}if(start>end)return new Response(null,{status:416});
  let offset=start;const stream=new ReadableStream({async pull(controller){try{if(offset>end){controller.close();return;}const n=Math.floor(offset/r.chunkSize),within=offset%r.chunkSize,length=Math.min(end-offset+1,r.chunkSize-within);const o=await e.BUCKET.get('videos/'+r.uploadId+'/'+n,{range:{offset:within,length}});if(!o)throw Error();controller.enqueue(new Uint8Array(await o.arrayBuffer()));offset+=length;}catch(err){controller.error(err);}}});
  return new Response(stream,{status:match?206:200,headers:{...protectionHeaders,'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':String(end-start+1),...(match?{'Content-Range':`bytes ${start}-${end}/${r.size}`}:{})}});
 }
 if(parts[0]==='api'&&parts[1]==='comments'&&id(parts[2])){
  if(!await read(e,'records/'+parts[2]))return reply({error:'기록이 없습니다.'},404);
  if(req.method==='GET')return reply((await all(e,'comments/'+parts[2]+'/')).filter(c=>!c.deleted).sort((a,b)=>a.created.localeCompare(b.created)));
  if(req.method==='POST'){const m=await req.json(),cid=crypto.randomUUID();await write(e,'comments/'+parts[2]+'/'+cid,{id:cid,name:str(m.name,80),memo:str(m.memo),created:stamp(),updated:''});await write(e,'comment-index/'+cid,{rid:parts[2]});return reply({ok:true},201);}
 }
 if(parts[0]==='api'&&parts[1]==='comment'&&id(parts[2])&&req.method==='POST'){
  const index=await read(e,'comment-index/'+parts[2]);if(!index)throw Error();const key='comments/'+index.rid+'/'+parts[2],c=await read(e,key),m=await req.json();if(!c||c.deleted)throw Error();if(m.action==='delete')c.deleted=true;else if(m.action==='edit'){c.name=str(m.name,80);c.memo=str(m.memo);}else throw Error();c.updated=stamp();await write(e,key,c);return reply({ok:true});
 }
 if(parts[0]==='api'&&parts[1]==='improvements'&&id(parts[2])&&req.method==='POST'){if(!await read(e,'records/'+parts[2]))throw Error();const m=await req.json();await write(e,'improvements/'+parts[2],{content:str(m.content),updated:stamp()});return reply({ok:true});}
 return reply({error:'페이지가 없습니다.'},404);
 }catch{return reply({error:'요청을 완료하지 못했습니다. 입력과 연결 상태를 확인한 후 다시 시도해 주세요.'},400);}
}};
