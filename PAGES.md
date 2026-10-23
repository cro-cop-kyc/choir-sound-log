# GitHub Pages

사이트 주소: https://cro-cop-kyc.github.io/choir-sound-log/

main 브랜치에 올리면 GitHub Actions가 정적 파일만 빌드하여 Pages에 배포합니다. 댓글은 제거했습니다. 로컬 DB·영상·댓글은 자동으로 공개하지 않습니다.

기록 작성: 새 기록 → 날짜/담당자/대원별 마이크 배정 입력 → 수동 기록 작성 → 본문 작성 → GitHub에 기록 저장 → 내용이 자동 입력된 GitHub 저장 화면에서 Commit changes. 이후 자동 배포가 완료되면 모두에게 보입니다. 파일 다운로드나 수동 파일 업로드는 없습니다. 영상 선택은 선택 사항이며 영상 없이도 수동 작성 가능합니다. GitHub의 최종 Commit changes 전에는 공유 저장이 완료되지 않습니다.

개선점 수정은 해당 JSON 파일의 GitHub 편집 화면으로 연결됩니다. 작성과 수정은 GitHub 로그인 및 쓰기 권한이 필요합니다. 사이트 열람에는 로그인이 필요하지 않습니다.

영상은 GitHub Releases에 첨부한 뒤 기록 JSON의 videoUrl에 HTTPS 다운로드 주소를 입력하면 연결할 수 있습니다. 현재 로컬 MP4는 업로드하지 않았습니다. AI 실제 분석과 PDF는 아직 구현되지 않았습니다.

로컬 버전은 python server.py로 계속 이용할 수 있습니다. 기존 data 폴더는 그대로 보존합니다.
