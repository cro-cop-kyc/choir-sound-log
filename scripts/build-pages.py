"""Build only public web assets; never publish local databases, comments or videos."""
from pathlib import Path
import json,shutil
root=Path(__file__).resolve().parents[1];out=root/'dist';out.mkdir(exist_ok=True)
for name in ['index.html','style.css','app.js','engine.js','assignments.js']:shutil.copyfile(root/name,out/name)
html=(out/'index.html').read_text(encoding='utf-8')
html=html.replace('<script type="module"','<script>window.GITHUB_PAGES_MODE=true;</script><script type="module"')
html=html.replace('MP4 최대 1GB · 수동 기록 확정 시 이 PC의 저장소에 영상이 보관됩니다.','GitHub Pages에서는 기록 파일을 다운로드한 뒤 GitHub에 등록합니다. 영상은 GitHub Releases에 첨부하여 연결할 수 있습니다.')
html=html.replace('<button id="save">수동 기록 확정</button>','<button id="save">GitHub 등록용 기록 파일 만들기</button><p><a href="https://github.com/cro-cop-kyc/choir-sound-log/upload/main/records" target="_blank" rel="noopener">다운로드한 기록 파일을 GitHub에 등록하기</a></p>')
(out/'index.html').write_text(html,encoding='utf-8')
records=[]
for p in sorted((root/'records').glob('*.json')):
 r=json.loads(p.read_text(encoding='utf-8'));r['sourceFile']=p.name;records.append(r)
(out/'records.json').write_text(json.dumps(records,ensure_ascii=False),encoding='utf-8')
(out/'.nojekyll').touch()
print('GitHub Pages assets ready:',len(records),'records')
