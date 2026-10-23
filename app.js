import {normalizeAssignments} from './assignments.js';
import {createEngine,messages} from './engine.js';
const $=id=>document.getElementById(id),engine=createEngine();
let records=[],busy=false,requestId=crypto.randomUUID();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url,options){if(window.GITHUB_PAGES_MODE)return pagesApi(url,options);const r=await fetch(url,options);const b=await r.json();if(!r.ok)throw Error(b.error||'저장 서버에 연결하지 못했습니다.');return b;}
function route(){for(const id of ['home','new','detail'])$(id).hidden=true;if(location.hash==='#new')$('new').hidden=false;else if(location.hash.startsWith('#record/')){const r=records.find(r=>r.id===location.hash.slice(8));if(r)renderRecord(r);else $('home').hidden=false;}else $('home').hidden=false;}
addEventListener('hashchange',()=>{route();window.scrollTo({top:0,behavior:'instant'});});
async function refresh(){records=await api('/api/records');let html='',year='',month='';for(const r of records){const y=r.date.slice(0,4),m=r.date.slice(5,7);if(y!==year){if(month)html+='</details>';if(year)html+='</details>';html+=`<details open><summary>${y}년</summary>`;year=y;month='';}if(m!==month){if(month)html+='</details>';html+=`<details open><summary>${m}월</summary>`;month=m;}html+=`<a class="record-link" href="#record/${r.id}">${esc(r.date.slice(8))}일 · ${r.test?'[테스트] ':''}수동 기록</a>`;}if(month)html+='</details>';if(year)html+='</details>';$('tree').innerHTML=html||'<p class="empty-nav">아직 생성된 기록이 없습니다.</p>';route();}
const now=new Date();$('date').value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
$('file').addEventListener('change',()=>{$('filename').textContent=$('file').files[0]?.name||'선택된 파일이 없습니다.';$('manual').hidden=true;requestId=crypto.randomUUID();});
$('form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;if(!$('form').reportValidity())return;try{readAssignments();$('assignment-error').textContent='';}catch(err){$('assignment-error').textContent=err.message;return;}busy=true;$('submit').disabled=true;try{await engine.analyze({date:$('date').value,operator:$('operator').value,file:$('file').files[0]},requestId);}catch(error){$('error').textContent='AI 분석 실패 · '+(messages[error.code]||'분석을 완료하지 못했습니다.');$('error').hidden=false;if(!['INVALID_INPUT','INVALID_FILE','BUSY'].includes(error.code)){$('manual').hidden=false;$('manual').scrollIntoView({behavior:'smooth',block:'start'});}}finally{busy=false;$('submit').disabled=false;}});
$('manual-form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;if(!$('form').reportValidity())return;busy=true;$('save').disabled=true;$('save').textContent='영상과 기록 저장 중…';$('manual-error').hidden=true;try{const m={requestId,date:$('date').value,operator:$('operator').value,filename:$('file').files[0].name,test:$('test').checked,assignments:readAssignments()};for(const k of ['summary','improvement'])m[k]=$(k).value;const r=await api('/api/records',{method:'POST',headers:{'Content-Type':'video/mp4','X-Record-Metadata':encodeURIComponent(JSON.stringify(m))},body:$('file').files[0]});requestId=crypto.randomUUID();$('manual-form').reset();$('manual').hidden=true;$('error').hidden=true;await refresh();location.hash=`record/${r.id}`;}catch(error){$('manual-error').textContent=error.message||'연결 실패: 입력 내용은 유지됩니다.';$('manual-error').hidden=false;}finally{busy=false;$('save').disabled=false;$('save').textContent='수동 기록 확정';}});
async function renderRecord(r){
 $('detail').hidden=false;
 $('detail').innerHTML=`<p class="eyebrow">COMMITTED RECORD</p><h2 class="page-title">${esc(r.date)} 찬양 기록 ${r.test?'<small>[테스트]</small>':''}</h2>
 <div class="operator-badge"><span>온라인 송출 담당자</span><strong>${esc(r.operator)}</strong></div>
 ${renderAssignments(r)}
 <div class="notice">수동 작성 · AI 분석 실패(엔진 미연결) · 아래 분석결과는 사람이 작성한 보완 기록입니다.</div>
 ${window.GITHUB_PAGES_MODE ? (r.videoUrl && /^https:\/\//.test(r.videoUrl) ? `<video controls preload="metadata" src="${esc(r.videoUrl)}"></video>` : `<p class="notice">영상은 아직 온라인으로 연결하지 않았습니다.</p>`) : `<video controls preload="metadata" src="/media/${r.id}"></video>`}<p class="muted">${esc(r.filename)}</p>
 <article class="report-block"><h3>[AI 분석결과]</h3><p>${esc(r.summary)}</p></article>
 <article class="report-block"><div class="block-heading"><h3>개선할 점</h3><button class="small secondary" id="edit-improvement">수정</button></div><p id="improvement-text">${esc(r.improvement||'별도 기록 없음')}</p>
 <form id="improvement-form" hidden><label>개선할 점 수정<textarea id="improvement-edit" required maxlength="10000">${esc(r.improvement)}</textarea></label><p class="edit-error" role="alert"></p><div class="actions"><button class="small">저장</button><button type="button" class="small secondary" id="cancel-improvement">취소</button></div></form></article>
`;
 $('edit-improvement').onclick=()=>{$('improvement-form').hidden=false;$('improvement-text').hidden=true;$('edit-improvement').hidden=true;$('improvement-edit').value=r.improvement||'';};
 $('cancel-improvement').onclick=()=>{$('improvement-form').hidden=true;$('improvement-text').hidden=false;$('edit-improvement').hidden=false;};
 $('improvement-form').onsubmit=async e=>{
  e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;
  try{await api('/api/improvements/'+r.id,jsonOptions({content:$('improvement-edit').value}));r.improvement=$('improvement-edit').value.trim();$('improvement-text').textContent=r.improvement;$('cancel-improvement').click();}
  catch(err){e.target.querySelector('.edit-error').textContent=err.message;}finally{b.disabled=false;}
 };

}
function jsonOptions(body){return {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};}
route();refresh().catch(()=>{$('tree').textContent='로컬 저장 서버를 실행해 주세요. 새 기록 작성 화면은 열 수 있습니다.';});

async function pagesApi(url,options){
 if(url==='/api/records'&&!options){const response=await fetch('./records.json',{cache:'no-store'});if(!response.ok)throw Error('기록을 불러오지 못했습니다.');return response.json();}
 if(url==='/api/records'&&options?.method==='POST'){
  const m=JSON.parse(decodeURIComponent(options.headers['X-Record-Metadata']));
  const record={...m,id:m.requestId,mode:'manual',analysisStatus:'failed',created:new Date().toISOString()};delete record.requestId;
  const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json'}),href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=record.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(href),10000);
  throw Error('기록 파일을 다운로드했습니다. 아래 GitHub 등록 링크에서 이 파일을 올리고 Commit changes를 완료하면 사이트에 반영됩니다. 아직 공유 기록으로 저장된 상태는 아닙니다.');
 }
 if(url.startsWith('/api/improvements/')){
  const id=url.split('/').pop(),r=records.find(r=>r.id===id);
  const a=document.createElement('a');a.href='https://github.com/cro-cop-kyc/choir-sound-log/edit/main/records/'+encodeURIComponent(r.sourceFile||id+'.json');a.target='_blank';a.rel='noopener';a.click();
  throw Error('GitHub 편집 화면에서 improvement 값을 수정하고 Commit changes를 눌러 주세요. GitHub 로그인과 저장소 쓰기 권한이 필요합니다.');
 }
 throw Error('GitHub Pages에서는 이 작업을 지원하지 않습니다.');
}

function addMember(){
 const row=document.createElement('div');row.className='assignment-row';
 row.innerHTML='<input class="member-name" aria-label="찬양대원 이름" required maxlength="80" placeholder="이름"><input class="member-mic" aria-label="마이크 번호" type="number" min="1" max="9999" step="1" placeholder="미사용"><button type="button" class="small danger" aria-label="이 찬양대원 삭제">삭제</button>';
 row.querySelector('button').onclick=()=>{row.remove();updateCount();};
 row.addEventListener('input',updateCount);$('assignment-rows').append(row);updateCount();
}
function updateCount(){const rows=[...$('assignment-rows').children];$('assignment-count').textContent=`찬양대원 ${rows.length}명 · 마이크 사용 ${rows.filter(r=>r.querySelector('.member-mic').value).length}명`;}
function readAssignments(){return normalizeAssignments([...$('assignment-rows').children].map(row=>({name:row.querySelector('.member-name').value,microphone:row.querySelector('.member-mic').value})));}
function renderAssignments(r){
 if(!Array.isArray(r.assignments))return '<div class="notice">이전 기록에는 찬양대원별 마이크 배정이 입력되지 않았습니다.</div>';
 return `<article class="report-block"><h3>찬양대원별 마이크 배정 <small>· ${r.assignments.length}명</small></h3><table class="assignment-table"><thead><tr><th>찬양대원</th><th>마이크 번호</th></tr></thead><tbody>${r.assignments.map(a=>`<tr><td>${esc(a.name)}</td><td>${a.microphone?esc(a.microphone)+'번':'미사용'}</td></tr>`).join('')}</tbody></table></article>`;
}
$('add-member').onclick=addMember;addMember();
