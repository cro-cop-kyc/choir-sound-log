# GitHub 계정 연결 변경 및 검토

변경 전 태그: before-github-oauth-20261024 (6d9e996).

전용 키 입력/발급 화면을 제거하고 GitHub 계정 연결 버튼으로 변경했습니다. 계정 연결은 GitHub App으로 구성합니다. OAuth App의 public_repo 권한은 사용하지 않습니다.

GitHub App 설치는 choir-sound-log 저장소만 선택하고 Contents: Read and write만 부여합니다. GitHub 토큰은 인증 처리 서버에서만 사용합니다. 브라우저에는 암호화된 1시간 이내 앱 세션만 전달하며, API는 이 저장소의 기록/영상 경로만 허용합니다. 세션은 페이지 메모리에만 보관합니다.

아직 실제 계정 연결이 활성화된 상태는 아닙니다. auth-config.json의 authorizationService가 null이므로 연결 요청은 안내를 표시하고 작성/변경 권한을 열지 않습니다. 버튼 모양을 바꾼 것만으로 계정 연결이 완료되었다고 표시하지 않습니다.

활성화에 필요한 사용자 설정:

1. GitHub App 등록: 홈페이지 https://cro-cop-kyc.github.io/choir-sound-log/ . 비공개 설치용 앱으로 생성하고, choir-sound-log에만 설치합니다. Device flow와 webhook은 사용하지 않습니다.
2. auth-service/worker.js를 HTTPS 인증 처리 환경에 배포하고 GitHub App의 callback URL을 그 환경의 /auth/callback으로 등록합니다. 사이트 본체의 주소는 GitHub Pages 그대로입니다. 현재 다른 호스팅을 생성/재활성화하지 않았습니다.
3. 인증 환경에 GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SESSION_SECRET(32자 이상)을 비밀 설정으로 저장합니다. 비밀값은 공개 저장소나 채팅에 넣지 않습니다.
4. 공개 auth-config.json에는 인증 처리 환경의 origin만 입력하고 Pages를 다시 배포합니다.
5. 실제 계정 승인 후 임시 기록 생성/수정/삭제와 영상 업로드를 운영 환경에서 확인합니다. 지금 수행한 테스트는 격리된 모의 GitHub 응답을 사용한 코드 검증이며 실제 계정 승인 검증이 아닙니다.

롤백: 후속 변경 여부를 확인한 뒤 이 변경 커밋을 git revert하고 main에 push합니다. 이전 태그로 확인할 수 있으며 기록·영상·기존 DB는 변경하지 않았습니다.
