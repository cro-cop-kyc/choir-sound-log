export function createOAuthSession(service,host=window){
 const origin=new URL(service).origin;
 return {login(){return new Promise((resolve,reject)=>{
  const nonce=crypto.randomUUID(),url=new URL('/auth/start',origin);url.searchParams.set('nonce',nonce);
  const popup=host.open(url.href,'choir-github-account','popup,width=620,height=760');
  if(!popup){reject(Error('GitHub 계정 연결창을 열 수 없습니다. 팝업 허용 후 다시 눌러 주세요.'));return;}
  let done=false;
  const finish=(error,value)=>{if(done)return;done=true;host.removeEventListener('message',receive);clearInterval(poll);clearTimeout(timer);try{popup.close();}catch{}if(error)reject(error);else resolve(value);};
  function receive(event){
   if(event.origin!==origin||event.source!==popup||event.data?.type!=='choir-github-oauth'||event.data?.nonce!==nonce)return;
   if(event.data.error){finish(Error('GitHub 계정 연결을 완료하지 못했습니다. 다시 시도해 주세요.'));return;}
   if(typeof event.data.session!=='string'||!event.data.session){finish(Error('GitHub 계정 연결 응답이 올바르지 않습니다.'));return;}
   finish(null,{service:origin,session:event.data.session});
  }
  host.addEventListener('message',receive);
  const poll=setInterval(()=>{if(popup.closed)finish(Error('계정 연결창이 닫혔습니다.'));},500);
  const timer=setTimeout(()=>finish(Error('계정 연결 시간이 초과되었습니다.')),300000);
 });}};
}
