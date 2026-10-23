"""Build only public web assets; never publish local databases, comments or videos."""
from pathlib import Path
import json,shutil
root=Path(__file__).resolve().parents[1];out=root/'dist';out.mkdir(exist_ok=True)
for name in ['index.html','style.css','app.js','engine.js','assignments.js','github-records.js']:shutil.copyfile(root/name,out/name)
html=(out/'index.html').read_text(encoding='utf-8')
html=html.replace('<script type="module"','<script>window.GITHUB_PAGES_MODE=true;</script><script type="module"')
html=html.replace('MP4 최대 1GB · 수동 기록 확정 시 이 PC의 저장소에 영상이 보관됩니다.','수동 기록은 영상 없이도 작성할 수 있습니다. 이 페이지에서 선택한 영상은 GitHub에 자동 업로드되지 않습니다.')
html=html.replace('id="file" type="file" accept=".mp4,video/mp4" required','id="file" type="file" accept=".mp4,video/mp4"')
html=html.replace('생성 및 분석 <span>→</span>','수동 기록 작성 <span>→</span>')
html=html.replace('AI 분석을 시도하고, 실패하면 수동 작성으로 기록을 이어갑니다.','AI 엔진 준비 중입니다. 직접 작성한 내용을 GitHub에 기록합니다.')
html=html.replace('AI 분석 실패로 직접 작성하는 보완 기록입니다. 저장 후에도 수동 작성 표시가 남습니다.','직접 작성한 기록입니다. 저장 화면의 Commit changes를 완료하면 모두에게 공유됩니다.')
html=html.replace('<button id="save">수동 기록 확정</button>','<button id="save">GitHub에 기록 저장</button>')
(out/'index.html').write_text(html,encoding='utf-8')
records=[]
for p in sorted((root/'records').glob('*.json')):
 r=json.loads(p.read_text(encoding='utf-8'));r['sourceFile']=p.name;records.append(r)
(out/'records.json').write_text(json.dumps(records,ensure_ascii=False),encoding='utf-8')
(out/'.nojekyll').touch()
print('GitHub Pages assets ready:',len(records),'records')
