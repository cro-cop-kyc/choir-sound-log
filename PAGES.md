# GitHub Pages

사이트 주소: https://cro-cop-kyc.github.io/choir-sound-log/

main 브랜치에 올리면 GitHub Actions가 정적 파일만 빌드하여 Pages에 배포합니다. 댓글은 제거했습니다. 로컬 DB·영상·댓글은 자동으로 공개하지 않습니다.

방문자는 읽기 전용입니다. 상단 관리자 연결에서 cro-cop-kyc 계정의 전용 키를 입력하면 사이트 안에서 새 기록, 영상 업로드, 개선점 수정, 기록 삭제를 수행할 수 있습니다. 저장은 GitHub API를 통해 백그라운드로 처리하며, 파일 다운로드나 GitHub 편집 화면 이동은 없습니다.

관리자 연결은 일반 GitHub 웹 세션이나 OAuth 버튼이 아닌 저장소 전용 키 방식입니다. Fine-grained personal access token에서 Only select repositories → choir-sound-log, Contents → Read and write를 선택합니다. 비밀번호나 키를 채팅으로 전달하지 마세요. 발급 및 연결은 사용자가 직접 진행합니다. 키는 서버·코드·localStorage·sessionStorage에 저장하지 않고 열린 페이지 메모리에만 보관합니다. 새로고침/연결 해제 시 해제됩니다. 실제 키를 이용한 운영 저장 및 영상 업로드 검증은 관리자 연결 후 필요합니다.

기록은 records 폴더에 커밋됩니다. 영상은 별도 Release에 첨부됩니다. 기록 삭제는 JSON을 삭제하고, 변경 이력 및 첨부 영상은 보존합니다. 기록과 개선점 수정 시 SHA로 동시 변경을 확인합니다. 방문자는 GitHub 공개 API로 최신 기록을 조회하고, 요청 제한 시 배포된 records.json으로 대체합니다. 새 저장의 정적 배포 반영에는 잠시 시간이 걸릴 수 있습니다.

개선점 수정도 사이트 내부에서 처리됩니다. 사이트 열람에는 별도 연결이 필요하지 않습니다.

선택한 MP4는 저장 시 GitHub Releases로 업로드됩니다. 기존 로컬 MP4는 자동 이관하지 않았습니다. AI 실제 분석과 PDF는 아직 구현되지 않았습니다.

로컬 버전은 python server.py로 계속 이용할 수 있습니다. 기존 data 폴더는 그대로 보존합니다.
