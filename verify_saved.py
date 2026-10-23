import sqlite3,json,hashlib
from pathlib import Path
root=Path(__file__).parent
with sqlite3.connect(root/'data/records.sqlite') as c:
 r=c.execute('SELECT id,body,video FROM records').fetchone();assert r
 record=json.loads(r[1]);assert record['test'] and record['mode']=='manual' and record['analysisStatus']=='failed'
 original=root.parent/'20261018-하늘소리찬양대.mp4'
 def digest(p):
  with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
 assert digest(original)==digest(root/'data'/r[2])==record['sha256']
 try:c.execute('UPDATE records SET body=? WHERE id=?',('{}',r[0]));raise AssertionError('Mutation allowed')
 except sqlite3.IntegrityError:c.rollback()
 assert c.execute('SELECT count(*) FROM comments WHERE record_id=?',(r[0],)).fetchone()[0]>=1
 assert c.execute('SELECT count(*) FROM records').fetchone()[0]==1
 print('PASS: actual MP4 hash, immutable body, manual/failed status, persisted comment, single record')
