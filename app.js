import {createEngine, messages} from './engine.js';
const engine = createEngine(); // Intentionally unconfigured; never substitutes fabricated results.
const $ = id => document.getElementById(id);
function route(){ const isNew=location.hash==='#new'; $('home').hidden=isNew; $('new').hidden=!isNew; }
addEventListener('hashchange',route); route();
const now=new Date(); $('date').value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
$('file').addEventListener('change',()=>{const f=$('file').files[0];$('filename').textContent=f?`${f.name} · ${(f.size/1024/1024).toFixed(1)} MB`:'선택된 파일이 없습니다.';});
let busy=false;
$('form').addEventListener('submit',async event=>{
 event.preventDefault(); if(busy)return;
 busy=true; $('submit').disabled=true; $('submit').textContent='입력 확인 중…'; $('error').hidden=true;
 try {
  await engine.analyze({date:$('date').value,operator:$('operator').value,file:$('file').files[0]},crypto.randomUUID());
  // Server-side immutable persistence must be implemented before enabling an adapter.
  $('error').textContent='기록 저장 서버가 연결되지 않아 확정하지 않았습니다.'; $('error').hidden=false;
 }catch(error){$('error').textContent=messages[error.code]||'처리를 완료하지 못했습니다. 입력 내용은 유지됩니다.';$('error').hidden=false;}
 finally{busy=false;$('submit').disabled=false;$('submit').textContent='생성 및 분석 →';}
});
