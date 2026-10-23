import {createEngine,messages} from './engine.js';
const $=id=>document.getElementById(id),engine=createEngine();
let records=[],busy=false,requestId=crypto.randomUUID();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url,options){const r=await fetch(url,options);const b=await r.json();if(!r.ok)throw Error(b.error||'저장 서버에 연결하지 못했습니다.');return b;}
function route(){for(const id of ['home','new','detail'])$(id).hidden=true;if(location.hash==='#new')$('new').hidden=false;else if(location.hash.startsWith('#record/')){const r=records.find(r=>r.id===location.hash.slice(8));if(r)renderRecord(r);else $('home').hidden=false;}else $('home').hidden=false;}
addEventListener('hashchange',()=>{route();window.scrollTo({top:0,behavior:'instant'});});
async function refresh(){records=await api('/api/records');let html='',year='',month='';for(const r of records){const y=r.date.slice(0,4),m=r.date.slice(5,7);if(y!==year){if(month)html+='</details>';if(year)html+='</details>';html+=`<details open><summary>${y}년</summary>`;year=y;month='';}if(m!==month){if(month)html+='</details>';html+=`<details open><summary>${m}월</summary>`;month=m;}html+=`<a class="record-link" href="#record/${r.id}">${esc(r.date.slice(8))}일 · ${r.test?'[테스트] ':''}수동 기록</a>`;}if(month)html+='</details>';if(year)html+='</details>';$('tree').innerHTML=html||'<p class="empty-nav">아직 생성된 기록이 없습니다.</p>';route();}
const now=new Date();$('date').value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
$('file').addEventListener('change',()=>{$('filename').textContent=$('file').files[0]?.name||'선택된 파일이 없습니다.';$('manual').hidden=true;requestId=crypto.randomUUID();});
$('form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;$('submit').disabled=true;try{await engine.analyze({date:$('date').value,operator:$('operator').value,file:$('file').files[0]},requestId);}catch(error){$('error').textContent='AI 분석 실패 · '+(messages[error.code]||'분석을 완료하지 못했습니다.');$('error').hidden=false;if(!['INVALID_INPUT','INVALID_FILE','BUSY'].includes(error.code)){$('manual').hidden=false;$('manual').scrollIntoView({behavior:'smooth',block:'start'});}}finally{busy=false;$('submit').disabled=false;}});
$('manual-form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;if(!$('form').reportValidity())return;busy=true;$('save').disabled=true;$('save').textContent='영상과 기록 저장 중…';$('manual-error').hidden=true;try{const m={requestId,date:$('date').value,operator:$('operator').value,filename:$('file').files[0].name,test:$('test').checked,choirCount:Number($('choirCount').value),microphones:$('microphones').value};for(const k of ['summary','improvement'])m[k]=$(k).value;const r=await saveRecord(m,$('file').files[0]);requestId=crypto.randomUUID();$('manual-form').reset();$('manual').hidden=true;$('error').hidden=true;await refresh();location.hash=`record/${r.id}`;}catch(error){$('manual-error').textContent=error.message||'연결 실패: 입력 내용은 유지됩니다.';$('manual-error').hidden=false;}finally{busy=false;$('save').disabled=false;$('save').textContent='수동 기록 확정';}});
async function renderRecord(r){
 $('detail').hidden=false;
 $('detail').innerHTML=`<p class="eyebrow">COMMITTED RECORD</p><h2 class="page-title">${esc(r.date)} 찬양 기록 ${r.test?'<small>[테스트]</small>':''}</h2>
 <div class="operator-badge"><span>온라인 송출 담당자</span><strong>${esc(r.operator)}</strong></div>
 <div class="setup-info"><div><span>찬양대 인원</span><strong>${r.choirCount?esc(r.choirCount)+'명':'미입력'}</strong></div><div><span>마이크 번호</span><strong>${esc(r.microphones||'미입력')}</strong></div></div>
 <div class="notice">수동 작성 · AI 분석 실패(엔진 미연결) · 아래 분석결과는 사람이 작성한 보완 기록입니다.</div>
 <video controls preload="metadata" src="/media/${r.id}"></video><p class="muted">${esc(r.filename)}</p>
 <article class="report-block"><h3>[AI 분석결과]</h3><p>${esc(r.summary)}</p></article>
 <article class="report-block"><div class="block-heading"><h3>개선할 점</h3><button class="small secondary" id="edit-improvement">수정</button></div><p id="improvement-text">${esc(r.improvement||'별도 기록 없음')}</p>
 <form id="improvement-form" hidden><label>개선할 점 수정<textarea id="improvement-edit" required maxlength="10000">${esc(r.improvement)}</textarea></label><p class="edit-error" role="alert"></p><div class="actions"><button class="small">저장</button><button type="button" class="small secondary" id="cancel-improvement">취소</button></div></form></article>
 <section class="discussion"><h3>함께 나누는 메모</h3><p class="muted">댓글을 남기고 수정하거나 삭제할 수 있습니다.</p><div id="comments"></div><form id="comment-form"><label>이름<input id="comment-name" required maxlength="80"></label><label>메모<textarea id="comment-memo" required maxlength="10000"></textarea></label><p id="comment-error" role="alert"></p><button>메모 남기기</button></form></section>`;
 $('edit-improvement').onclick=()=>{$('improvement-form').hidden=false;$('improvement-text').hidden=true;$('edit-improvement').hidden=true;$('improvement-edit').value=r.improvement||'';};
 $('cancel-improvement').onclick=()=>{$('improvement-form').hidden=true;$('improvement-text').hidden=false;$('edit-improvement').hidden=false;};
 $('improvement-form').onsubmit=async e=>{
  e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;
  try{await api('/api/improvements/'+r.id,jsonOptions({content:$('improvement-edit').value}));r.improvement=$('improvement-edit').value.trim();$('improvement-text').textContent=r.improvement;$('cancel-improvement').click();}
  catch(err){e.target.querySelector('.edit-error').textContent=err.message;}finally{b.disabled=false;}
 };
 $('comment-form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{await api('/api/comments/'+r.id,jsonOptions({name:$('comment-name').value,memo:$('comment-memo').value}));e.target.reset();$('comment-error').textContent='';await loadComments(r.id);}catch(err){$('comment-error').textContent=err.message;}finally{b.disabled=false;}};
 await loadComments(r.id);
}
function jsonOptions(body){return {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};}
async function loadComments(id){
 try{
  const rows=await api('/api/comments/'+id);
  if(location.hash!=='#record/'+id||!$('comments'))return;
  $('comments').innerHTML=rows.map(c=>`<article class="comment" data-id="${esc(c.id)}"><div class="comment-content"><strong>${esc(c.name)}</strong><small>${new Date(c.created).toLocaleString('ko-KR')}${c.updated?' · 수정됨':''}</small><p>${esc(c.memo)}</p><div class="actions"><button class="small secondary comment-edit">수정</button><button class="small danger comment-delete">삭제</button></div></div>
  <form class="comment-edit-form" hidden><label>이름 수정<input class="edit-name" required maxlength="80" value="${esc(c.name)}"></label><label>메모 수정<textarea class="edit-memo" required maxlength="10000">${esc(c.memo)}</textarea></label><div class="actions"><button class="small">저장</button><button type="button" class="small secondary cancel-edit">취소</button></div></form>
  <div class="delete-confirm" hidden><p>이 댓글을 삭제할까요?</p><div class="actions"><button class="small danger confirm-delete">삭제 확인</button><button class="small secondary cancel-delete">취소</button></div></div><p class="edit-error" role="alert"></p></article>`).join('')||'<p class="muted">첫 메모를 남겨 주세요.</p>';
  $('comments').querySelectorAll('.comment').forEach(el=>{
   const content=el.querySelector('.comment-content'),form=el.querySelector('form'),confirmation=el.querySelector('.delete-confirm');
   el.querySelector('.comment-edit').onclick=()=>{form.hidden=false;content.hidden=true;};
   el.querySelector('.cancel-edit').onclick=()=>{form.hidden=true;content.hidden=false;};
   el.querySelector('.comment-delete').onclick=()=>{confirmation.hidden=false;content.hidden=true;};
   el.querySelector('.cancel-delete').onclick=()=>{confirmation.hidden=true;content.hidden=false;};
   async function change(body,button){button.disabled=true;try{await api('/api/comment/'+el.dataset.id,jsonOptions(body));await loadComments(id);}catch(err){el.querySelector('.edit-error').textContent=err.message;button.disabled=false;}}
   form.onsubmit=e=>{e.preventDefault();change({action:'edit',name:el.querySelector('.edit-name').value,memo:el.querySelector('.edit-memo').value},form.querySelector('button'));};
   el.querySelector('.confirm-delete').onclick=e=>change({action:'delete'},e.target);
  });
 }catch(err){if($('comments'))$('comments').textContent=err.message;}
}
route();refresh().catch(()=>{$('tree').textContent='로컬 저장 서버를 실행해 주세요. 새 기록 작성 화면은 열 수 있습니다.';});

async function saveRecord(metadata,file){
 let hosted=false;
 try { const r=await fetch('/api/config'); if(r.ok)hosted=(await r.json()).hosted===true; } catch {}
 if(!hosted)return api('/api/records',{method:'POST',headers:{'Content-Type':'video/mp4','X-Record-Metadata':encodeURIComponent(JSON.stringify(metadata))},body:file});
 const uploadId=metadata.requestId;
 await api('/api/uploads',jsonOptions({id:uploadId,size:file.size,filename:file.name}));
 const chunkSize=5242880,total=Math.ceil(file.size/chunkSize);
 for(let i=0;i<total;i++){
  $('save').textContent=`영상 업로드 ${i+1} / ${total}`;
  await api(`/api/uploads/${uploadId}/parts/${i}`,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:file.slice(i*chunkSize,(i+1)*chunkSize)});
 }
 $('save').textContent='기록 확정 중…';
 return api('/api/records',jsonOptions({...metadata,uploadId}));
}
