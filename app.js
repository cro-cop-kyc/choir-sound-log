import {seekToSegment} from './analysis-segments.js';
import {createGitHubStore} from './github-store.js';
import {installAdminUI} from './admin-ui.js';
const github=createGitHubStore();
const canWrite=()=>!window.GITHUB_PAGES_MODE||github.connected;
import {normalizeAssignments} from './assignments.js';
import {createEngine,messages} from './engine.js';
const $=id=>document.getElementById(id),engine=createEngine();
let records=[],busy=false,requestId=crypto.randomUUID();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url,options){if(window.GITHUB_PAGES_MODE)return pagesApi(url,options);const r=await fetch(url,options);const b=await r.json();if(!r.ok)throw Error(b.error||'저장 서버에 연결하지 못했습니다.');return b;}
function route(){for(const id of ['home','new','detail'])$(id).hidden=true;if(location.hash==='#new'){if(canWrite())$('new').hidden=false;else $('home').hidden=false;}else if(location.hash.startsWith('#record/')){const r=records.find(r=>r.id===location.hash.slice(8));if(r)renderRecord(r);else $('home').hidden=false;}else $('home').hidden=false;}
addEventListener('hashchange',()=>{route();window.scrollTo({top:0,behavior:'instant'});});
async function refresh(){records=await api('/api/records');let html='',year='',month='';for(const r of records){const y=r.date.slice(0,4),m=r.date.slice(5,7);if(y!==year){if(month)html+='</details>';if(year)html+='</details>';html+=`<details open><summary>${y}년</summary>`;year=y;month='';}if(m!==month){if(month)html+='</details>';html+=`<details open><summary>${m}월</summary>`;month=m;}html+=`<a class="record-link" href="#record/${r.id}">${esc(r.date.slice(8))}일 · ${r.test?'[테스트] ':''}${esc(r.title||'수동 기록')}</a>`;}if(month)html+='</details>';if(year)html+='</details>';$('tree').innerHTML=html||'<p class="empty-nav">아직 생성된 기록이 없습니다.</p>';route();}
const now=new Date();$('date').value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
$('file').addEventListener('change',()=>{$('filename').textContent=$('file').files[0]?.name||'선택된 파일이 없습니다.';$('manual').hidden=true;requestId=crypto.randomUUID();});
$('form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;if(!canWrite())return;if(!$('form').reportValidity())return;try{readAssignments();$('assignment-error').textContent='';}catch(err){$('assignment-error').textContent=err.message;return;}if(window.GITHUB_PAGES_MODE){$('manual').hidden=false;$('error').hidden=true;$('manual').scrollIntoView({behavior:'smooth',block:'start'});return;}busy=true;$('submit').disabled=true;try{await engine.analyze({date:$('date').value,operator:$('operator').value,file:$('file').files[0]},requestId);}catch(error){$('error').textContent='AI 분석 실패 · '+(messages[error.code]||'분석을 완료하지 못했습니다.');$('error').hidden=false;if(!['INVALID_INPUT','INVALID_FILE','BUSY'].includes(error.code)){$('manual').hidden=false;$('manual').scrollIntoView({behavior:'smooth',block:'start'});}}finally{busy=false;$('submit').disabled=false;}});
$('manual-form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;if(!canWrite())return;if(!$('form').reportValidity())return;busy=true;$('save').disabled=true;$('save').textContent='영상과 기록 저장 중…';$('manual-error').hidden=true;try{const m={requestId,date:$('date').value,operator:$('operator').value,filename:$('file').files[0]?.name||'',test:$('test').checked,assignments:readAssignments()};for(const k of ['summary','improvement'])m[k]=$(k).value;const r=await api('/api/records',{method:'POST',headers:{'Content-Type':'video/mp4','X-Record-Metadata':encodeURIComponent(JSON.stringify(m))},body:$('file').files[0]});requestId=crypto.randomUUID();$('manual-form').reset();$('manual').hidden=true;$('error').hidden=true;await refresh();location.hash=`record/${r.id}`;}catch(error){if(!error.pending)$('manual-error').textContent=error.message||'연결 실패: 입력 내용은 유지됩니다.';$('manual-error').hidden=false;}finally{busy=false;$('save').disabled=false;$('save').textContent=window.GITHUB_PAGES_MODE?'GitHub에 기록 저장':'수동 기록 확정';}});
async function renderRecord(r){
 $('detail').hidden=false;
 $('detail').innerHTML=`<p class="eyebrow">COMMITTED RECORD</p><button class="small danger" id="delete-record" ${window.GITHUB_PAGES_MODE&&github.connected?'':'hidden'}>기록 삭제</button><p id="delete-error" role="alert"></p><h2 class="page-title">${esc(r.date)} ${esc(r.title||'찬양 기록')} ${r.test?'<small>[테스트]</small>':''}</h2>
 <div class="operator-badge"><span>온라인 송출 담당자</span><strong>${esc(r.operator)}</strong></div>
 ${renderAssignments(r)}
 ${r.mode==='measurement_review'?'':'<div class="notice">수동으로 작성한 분석 기록입니다.</div>'}
 ${window.GITHUB_PAGES_MODE ? (r.videoUrl && /^https:\/\//.test(r.videoUrl) ? `<video id="record-video" controls preload="metadata" src="${esc(r.videoUrl)}"></video>` : `<p class="notice">영상은 아직 온라인으로 연결하지 않았습니다.</p>`) : `<video id="record-video" controls preload="metadata" src="/media/${r.id}"></video>`}<p class="muted">${esc(r.filename)}</p>
 ${renderSegments(r)}<article class="report-block"><h3>[AI 분석결과]</h3><p>${esc(r.summary)}</p>${Array.isArray(r.frequencyBands)?`<h3>주파수별 에너지 분포</h3><table class="assignment-table"><thead><tr><th>주파수 대역</th><th>비율</th></tr></thead><tbody>${r.frequencyBands.map(b=>`<tr><td>${esc(b.band)}</td><td>${esc(b.percent)}%</td></tr>`).join('')}</tbody></table>`:''}</article>
 ${r.improvement?`<article class="report-block"><div class="block-heading"><h3>개선할 점</h3><button class="small secondary" id="edit-improvement" ${canWrite()?'':'hidden'}>수정</button></div><p id="improvement-text">${esc(r.improvement||'별도 기록 없음')}</p>
 <form id="improvement-form" hidden><label>개선할 점 수정<textarea id="improvement-edit" required maxlength="10000">${esc(r.improvement)}</textarea></label><p class="edit-error" role="alert"></p><div class="actions"><button class="small">저장</button><button type="button" class="small secondary" id="cancel-improvement">취소</button></div></form></article>`:''}
`;
 $('detail').querySelectorAll('[data-segment-start]').forEach(button=>{button.onclick=()=>{const video=$('record-video');if(!video)return;seekToSegment(video,Number(button.dataset.segmentStart));video.scrollIntoView({behavior:'smooth',block:'center'});$('detail').querySelectorAll('[data-segment-start]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));};});
 $('delete-record').onclick=async()=>{if(!github.connected)return;if(!confirm('이 기록을 사이트와 GitHub에서 삭제할까요? 변경 이력은 GitHub에 남고 첨부 영상은 보존됩니다.'))return;$('delete-record').disabled=true;try{await github.remove(r);location.hash='';await refresh();}catch(err){$('delete-error').textContent=err.message;$('delete-record').disabled=false;}};
 if($('edit-improvement')){
 $('edit-improvement').onclick=()=>{$('improvement-form').hidden=false;$('improvement-text').hidden=true;$('edit-improvement').hidden=true;$('improvement-edit').value=r.improvement||'';};
 $('cancel-improvement').onclick=()=>{$('improvement-form').hidden=true;$('improvement-text').hidden=false;$('edit-improvement').hidden=false;};
 $('improvement-form').onsubmit=async e=>{
  e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;
  try{await api('/api/improvements/'+r.id,jsonOptions({content:$('improvement-edit').value}));r.improvement=$('improvement-edit').value.trim();$('improvement-text').textContent=r.improvement;$('cancel-improvement').click();}
  catch(err){e.target.querySelector('.edit-error').textContent=err.message;}finally{b.disabled=false;}
 };
 }

}
function jsonOptions(body){return {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};}
route();refresh().catch(()=>{$('tree').textContent='로컬 저장 서버를 실행해 주세요. 새 기록 작성 화면은 열 수 있습니다.';});

async function pagesApi(url,options){
 if(url==='/api/records'&&!options){
  try{return await github.list();}catch(err){if(github.connected)throw err;const r=await fetch('./records.json',{cache:'no-store'});if(!r.ok)throw err;return r.json();}
 }
 if(!github.connected)throw Error('관리자만 기록을 변경할 수 있습니다.');
 if(url==='/api/records'&&options?.method==='POST'){
  const m=JSON.parse(decodeURIComponent(options.headers['X-Record-Metadata']));
  const video=await github.uploadVideo(options.body,m.requestId,progress=>{$('save').textContent='영상 업로드 '+progress+'%';});
  const record={...m,...video,id:m.requestId,mode:'manual',analysisStatus:'not_configured',created:new Date().toISOString()};delete record.requestId;
  $('save').textContent='GitHub에 기록 저장 중…';
  return github.save(record);
 }
 if(url.startsWith('/api/improvements/')){
  const id=url.split('/').pop(),r=records.find(r=>r.id===id);if(!r)throw Error('기록이 없습니다.');
  const latest=await github.save({...r,improvement:JSON.parse(options.body).content,updated:new Date().toISOString()},r._sha);Object.assign(r,latest);return latest;
 }
 throw Error('지원하지 않는 요청입니다.');
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

function applyAccess(){document.querySelector('.add').hidden=!canWrite();route();}
if(window.GITHUB_PAGES_MODE){installAdminUI(github,async()=>{applyAccess();await refresh();});applyAccess();}

function renderSegments(r){
 if(!Array.isArray(r.segments)||!r.segments.length)return '';
 return `<article class="report-block"><h3>구간별 분석 · 클릭해서 영상 이동</h3><p class="muted">각 항목을 누르면 해당 구간 시작으로 이동합니다. 재생 중이면 계속 재생되고, 일시정지 상태면 해당 시점에서 멈춥니다.</p><div class="analysis-segments">${r.segments.map(s=>`<button type="button" class="segment-jump" data-segment-start="${Number(s.start)}" aria-pressed="false"><strong>${esc(s.label)}</strong><span>${esc(s.finding)}</span></button>`).join('')}</div></article>`;
}
