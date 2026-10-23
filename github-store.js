const OWNER='cro-cop-kyc',REPO='choir-sound-log',BASE=`https://api.github.com/repos/${OWNER}/${REPO}`;
const encode=s=>{let b='';for(const n of new TextEncoder().encode(s))b+=String.fromCharCode(n);return btoa(b);};
const decode=s=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g,'')),c=>c.charCodeAt(0)));
export function createGitHubStore(fetcher=fetch){
 let token='',account=null;
 async function request(url,method='GET',body,auth=true){
  const headers={Accept:'application/vnd.github+json'};if(auth){if(!token)throw Error('관리자 연결이 필요합니다.');headers.Authorization='Bearer '+token;}
  if(body!==undefined)headers['Content-Type']='application/json';
  let r;try{r=await fetcher(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});}catch{throw Error('GitHub 연결이 끊겼습니다. 입력을 유지한 채 다시 확인해 주세요.');}
  if(!r.ok){if(r.status===404&&method==='GET')return null;throw Error(r.status===401?'관리자 연결 키를 확인해 주세요.':r.status===403?'저장소 Contents 쓰기 권한 또는 GitHub 요청 제한을 확인해 주세요.':r.status===409||r.status===422?'기록이 변경되었거나 같은 요청이 처리되었습니다. 목록을 새로 불러와 주세요.':'GitHub 요청에 실패했습니다. ('+r.status+')');}
  return r.status===204?{}:r.json();
 }
 async function file(path,auth=true){return request(BASE+'/contents/'+path+'?ref=main','GET',undefined,auth);}
 const data=f=>({...JSON.parse(decode(f.content)),_sha:f.sha});
 return {
  get connected(){return !!account;},
  async connect(value){token=value.trim();account=null;try{const u=await request('https://api.github.com/user');if(u?.login?.toLowerCase()!==OWNER)throw Error('이 사이트의 관리자 계정(cro-cop-kyc)으로 연결해 주세요.');const repo=await request(BASE);if(!repo?.permissions?.push)throw Error('저장소 쓰기 권한이 없습니다.');account=u;return u.login;}catch(err){token='';throw err;}},
  disconnect(){token='';account=null;},
  async list(){const entries=await file('records',!!account);if(!entries)return [];const selected=entries.filter(f=>f.type==='file'&&f.name.endsWith('.json'));const out=[];for(const f of selected){const v=await file('records/'+f.name,!!account);if(v)out.push({...data(v),sourceFile:f.name});}return out;},
  async save(record,expectedSha){if(!account)throw Error('관리자 연결이 필요합니다.');if(!/^[a-f0-9-]{36}$/.test(record.id))throw Error('잘못된 기록 번호입니다.');const path='records/'+record.id+'.json',existing=await file(path);if(expectedSha&&existing?.sha!==expectedSha)throw Error('다른 화면에서 변경된 기록입니다. 새로고침 후 수정해 주세요.');if(existing&&!expectedSha)return data(existing);const clean={...record};delete clean._sha;delete clean.sourceFile;const result=await request(BASE+'/contents/'+path,'PUT',{message:(existing?'Update':'Create')+' choir record '+record.date,content:encode(JSON.stringify(clean,null,2)),branch:'main',...(expectedSha?{sha:expectedSha}:{})});return {...clean,_sha:result.content.sha};},
  async remove(record){if(!account)throw Error('관리자 연결이 필요합니다.');const path='records/'+record.id+'.json';const current=await file(path);if(!current)return;if(current.sha!==record._sha)throw Error('기록이 변경되었습니다. 새로고침 후 삭제해 주세요.');await request(BASE+'/contents/'+path,'DELETE',{message:'Delete choir record '+record.date,sha:current.sha,branch:'main'});},
  async uploadVideo(file,id,onProgress=()=>{}){
   if(!account)throw Error('관리자 연결이 필요합니다.');if(!file)return null;if(file.size>=2*1024**3)throw Error('영상은 2GiB 미만이어야 합니다.');
   const tag='choir-'+id;let release=await request(BASE+'/releases/tags/'+tag);
   if(!release)release=await request(BASE+'/releases','POST',{tag_name:tag,name:file.name,body:'찬양대 기록 첨부 영상',draft:false,prerelease:false});
   const assetName='choir-'+id+'.mp4',found=release.assets?.find(a=>a.name===assetName&&a.state==='uploaded'&&a.size===file.size);if(found)return {videoUrl:found.browser_download_url,releaseId:release.id};
   const url='https://uploads.github.com/repos/'+OWNER+'/'+REPO+'/releases/'+release.id+'/assets?name='+assetName;
   const result=await new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST',url);xhr.setRequestHeader('Authorization','Bearer '+token);xhr.setRequestHeader('Content-Type','video/mp4');xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100));};xhr.onload=()=>{if(xhr.status>=200&&xhr.status<300){try{resolve(JSON.parse(xhr.responseText));}catch{reject(Error('업로드 응답을 확인하지 못했습니다.'));}}else reject(Error('영상 업로드 실패 ('+xhr.status+'). 기록 입력은 유지됩니다.'));};xhr.onerror=()=>reject(Error('영상 업로드 연결 실패. 입력은 유지됩니다.'));xhr.send(file);});
   return {videoUrl:result.browser_download_url,releaseId:release.id};
  }
 };
}
