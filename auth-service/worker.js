// GitHub App only: install on choir-sound-log with Contents read/write.
// GitHub access tokens never leave this server. Browser sessions are encrypted,
// short-lived, and usable only by this server's fixed repository routes.
const SITE='https://cro-cop-kyc.github.io',REPO='/repos/cro-cop-kyc/choir-sound-log';
const H={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const b64=b=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const un64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
const COOKIE='__Host-choir-oauth';
async function key(env){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(env.SESSION_SECRET)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function seal(data,env){const iv=crypto.getRandomValues(new Uint8Array(12));return b64(iv)+'.'+b64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),new TextEncoder().encode(JSON.stringify(data)))));}
export async function unseal(value,env){const[a,b]=value.split('.');return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(a)},await key(env),un64(b))));}
function cookie(req){const v=(req.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='));try{return v?JSON.parse(decodeURIComponent(v.slice(COOKIE.length+1))):null;}catch{return null;}}
function result(payload){
 const nonce=random(),safe=JSON.stringify(payload).replace(/</g,'\\u003c');
 const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><title>GitHub 계정 연결</title><p>계정 연결을 확인합니다.</p><script nonce="${nonce}">if(window.opener){window.opener.postMessage(${safe},${JSON.stringify(SITE)});window.close();}else{document.body.textContent='사이트에서 다시 연결해 주세요.';}</script></html>`;
 return new Response(html,{headers:{...H,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,'Set-Cookie':COOKIE+'=; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'}});
}
export function allowedRoute(path,method){
 if(path==='/user')return method==='GET';
 if(path===REPO)return method==='GET';
 if(path===REPO+'/contents/records')return method==='GET';
 if(new RegExp('^'+REPO+'/contents/records/[a-f0-9-]{36}\\.json$').test(path))return ['GET','PUT','DELETE'].includes(method);
 if(path===REPO+'/releases')return method==='POST';
 if(new RegExp('^'+REPO+'/releases/tags/choir-[a-f0-9-]{36}$').test(path))return method==='GET';
 if(/^\/upload\/\d+$/.test(path))return method==='POST';
 return false;
}
export function createAuthHandler(fetcher=fetch){return async(req,env)=>{
 const u=new URL(req.url),callback=u.origin+'/auth/callback';
 const cors={'Access-Control-Allow-Origin':SITE,'Access-Control-Allow-Methods':'GET, PUT, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, Accept','Vary':'Origin',...H};
 if(req.method==='OPTIONS')return new Response(null,{status:req.headers.get('Origin')===SITE?204:403,headers:cors});
 if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET||!env.SESSION_SECRET||env.SESSION_SECRET.length<32)return new Response('계정 연결 앱 설정을 완료해 주세요.',{status:503,headers:cors});
 if(u.pathname==='/auth/start'&&req.method==='GET'){
  const nonce=u.searchParams.get('nonce');if(!/^[a-f0-9-]{36}$/.test(nonce||''))return new Response('잘못된 요청입니다.',{status:400,headers:H});
  const state=random(),verifier=random(),challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
  const data={state,nonce,verifier,created:Date.now()},url=new URL('https://github.com/login/oauth/authorize');
  for(const[k,v]of Object.entries({client_id:env.GITHUB_CLIENT_ID,redirect_uri:callback,state,code_challenge:challenge,code_challenge_method:'S256'}))url.searchParams.set(k,v);
  return new Response(null,{status:302,headers:{...H,Location:url.href,'Set-Cookie':COOKIE+'='+encodeURIComponent(JSON.stringify(data))+'; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=600'}});
 }
 if(u.pathname==='/auth/callback'&&req.method==='GET'){
  const data=cookie(req);if(!data||typeof data.created!=='number'||Date.now()-data.created>600000||Date.now()<data.created||data.state!==u.searchParams.get('state'))return new Response('계정 연결 요청을 확인할 수 없습니다.',{status:400,headers:H});
  const base={type:'choir-github-oauth',nonce:data.nonce};if(u.searchParams.has('error')||!u.searchParams.get('code'))return result({...base,error:'authorization_denied'});
  try{
   const response=await fetcher('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code:u.searchParams.get('code'),redirect_uri:callback,code_verifier:data.verifier}),redirect:'error'});
   const token=await response.json();if(!response.ok||!token.access_token)return result({...base,error:'exchange_failed'});
   const options={headers:{Authorization:'Bearer '+token.access_token,Accept:'application/vnd.github+json','User-Agent':'choir-sound-log'},redirect:'error'};
   const user=await fetcher('https://api.github.com/user',options),profile=await user.json();if(!user.ok||profile.login?.toLowerCase()!=='cro-cop-kyc')return result({...base,error:'not_owner'});
   const repo=await fetcher('https://api.github.com'+REPO,options),permission=await repo.json();if(!repo.ok||!permission.permissions?.push)return result({...base,error:'not_writer'});
   const session=await seal({githubToken:token.access_token,owner:profile.login,expires:Date.now()+Math.min(token.expires_in||3600,3600)*1000},env);
   return result({...base,session});
  }catch{return result({...base,error:'connection_failed'});}
 }
 if(u.pathname.startsWith('/proxy/')){
  if(req.headers.get('Origin')!==SITE)return new Response('Forbidden',{status:403,headers:cors});
  let session;try{session=await unseal((req.headers.get('Authorization')||'').replace(/^Bearer /,''),env);}catch{return new Response('Unauthorized',{status:401,headers:cors});}
  if(typeof session.owner!=='string'||session.owner.toLowerCase()!=='cro-cop-kyc'||!Number.isFinite(session.expires)||session.expires<Date.now()||typeof session.githubToken!=='string')return new Response('Unauthorized',{status:401,headers:cors});
  const path=u.pathname.slice(6);if(!allowedRoute(path,req.method))return new Response('Forbidden',{status:403,headers:cors});
  const upload=path.startsWith('/upload/');const dest=upload?'https://uploads.github.com'+REPO+'/releases/'+path.split('/')[2]+'/assets':'https://api.github.com'+path;
  const query=upload?'?name='+encodeURIComponent(u.searchParams.get('name')||'choir.mp4'):req.method==='GET'&&path.includes('/contents/')?'?ref=main':'';
  try{
   const upstream=await fetcher(dest+query,{method:req.method,headers:{Authorization:'Bearer '+session.githubToken,Accept:'application/vnd.github+json','User-Agent':'choir-sound-log',...(req.headers.get('Content-Type')?{'Content-Type':req.headers.get('Content-Type')}:{})},body:['GET','HEAD'].includes(req.method)?undefined:req.body,redirect:'error'});
   return new Response(upstream.body,{status:upstream.status,headers:{...cors,'Content-Type':'application/json'}});
  }catch{return new Response('GitHub connection failed',{status:502,headers:cors});}
 }
 return new Response('Not found',{status:404,headers:H});
};}
export default {fetch:createAuthHandler()};
