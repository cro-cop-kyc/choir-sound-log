import {createOAuthSession} from './oauth-session.js';
export function installAdminUI(store,onChange){
 const button=document.createElement('button');button.id='admin-toggle';button.className='small secondary';button.textContent='GitHub로 로그인';document.querySelector('header').append(button);
 const panel=document.createElement('dialog');panel.id='admin-dialog';panel.innerHTML='<h2>GitHub 계정 연결</h2><p id="admin-message" role="status"></p><button id="admin-close" class="small secondary">닫기</button>';document.body.append(panel);document.getElementById('admin-close').onclick=()=>panel.close();
 button.onclick=async()=>{
  if(store.connected){store.disconnect();button.textContent='GitHub로 로그인';await onChange();return;}
  button.disabled=true;
  try{
   const response=await fetch('./auth-config.json',{cache:'no-store'});if(!response.ok)throw Error('계정 연결 설정을 불러오지 못했습니다.');
   const config=await response.json();
   if(!config.authorizationService)throw Error('GitHub 계정 연결 앱 설정이 아직 완료되지 않았습니다. 현재는 기록 열람만 가능합니다.');
   const service=new URL(config.authorizationService);if(service.protocol!=='https:')throw Error('계정 연결 주소가 올바르지 않습니다.');
   const session=await createOAuthSession(service.href).login();
   const user=await store.connect(session);button.textContent=user+' · 로그아웃';await onChange();
  }catch(error){store.disconnect();document.getElementById('admin-message').textContent=error.message;panel.showModal();}
  finally{button.disabled=false;}
 };
}
