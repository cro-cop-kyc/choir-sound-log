import json, sqlite3, uuid, datetime, hashlib, os
from contextlib import contextmanager
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import unquote, urlparse
ROOT=Path(__file__).parent.resolve(); DATA=Path(os.environ.get('CHOIR_DATA_DIR',ROOT/'data')); DATA.mkdir(exist_ok=True)
@contextmanager
def db():
 c=sqlite3.connect(DATA/'records.sqlite');c.row_factory=sqlite3.Row
 try:
  with c:yield c
 finally:c.close()
with db() as c:
 c.executescript("CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, request_id TEXT UNIQUE, body TEXT, video TEXT); CREATE TABLE IF NOT EXISTS comments(id TEXT PRIMARY KEY, record_id TEXT, name TEXT, memo TEXT, created TEXT); CREATE TRIGGER IF NOT EXISTS immutable_records BEFORE UPDATE ON records BEGIN SELECT RAISE(ABORT,'immutable'); END;")
 c.execute('CREATE TABLE IF NOT EXISTS improvements(record_id TEXT PRIMARY KEY, content TEXT NOT NULL, updated TEXT NOT NULL)')
 columns={r[1] for r in c.execute('PRAGMA table_info(comments)')}
 for name,definition in [('updated',"TEXT NOT NULL DEFAULT ''"),('deleted','INTEGER NOT NULL DEFAULT 0')]:
  if name not in columns:c.execute(f'ALTER TABLE comments ADD COLUMN {name} {definition}')
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
class Handler(BaseHTTPRequestHandler):
 def output(self,code,obj):
  b=json.dumps(obj,ensure_ascii=False).encode();self.send_response(code);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
 def do_GET(self):
  path=urlparse(self.path).path
  if path=='/api/records':
   with db() as c:
    rows=c.execute('SELECT r.body,i.content,i.updated FROM records r LEFT JOIN improvements i ON r.id=i.record_id').fetchall()
   records=[]
   for row in rows:
    r=json.loads(row[0])
    if row[1] is not None:r.update(improvement=row[1],improvementUpdated=row[2])
    records.append(r)
   return self.output(200,sorted(records,key=lambda r:r['date'],reverse=True))
  if path.startswith('/media/'):
   with db() as c:r=c.execute('SELECT video FROM records WHERE id=?',(path.rsplit('/',1)[1],)).fetchone()
   if not r:return self.output(404,{'error':'기록이 없습니다.'})
   p=DATA/r[0];mime='video/mp4'
  else:
   allowed={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/engine.js':'engine.js','/assignments.js':'assignments.js','/github-records.js':'github-records.js','/github-store.js':'github-store.js','/admin-ui.js':'admin-ui.js','/oauth-session.js':'oauth-session.js','/auth-config.json':'auth-config.json','/style.css':'style.css'}
   if path not in allowed:return self.output(404,{'error':'페이지가 없습니다.'})
   p=ROOT/allowed[path];mime={'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8','json':'application/json'}[p.suffix[1:]]
  size=p.stat().st_size;start=0;end=size-1;partial=False
  try:
   if self.headers.get('Range','').startswith('bytes='):
    a,b=self.headers['Range'][6:].split('-');start=int(a or 0);end=min(int(b) if b else end,end);partial=True
   if start<0 or start>end:raise ValueError()
  except ValueError:return self.output(416,{'error':'잘못된 범위'})
  self.send_response(206 if partial else 200);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(end-start+1));self.send_header('Cache-Control','no-store');self.send_header('Accept-Ranges','bytes')
  if partial:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
  self.end_headers()
  try:
   with p.open('rb') as f:
    f.seek(start);remaining=end-start+1
    while remaining:
     chunk=f.read(min(1048576,remaining));self.wfile.write(chunk);remaining-=len(chunk)
  except (BrokenPipeError,ConnectionResetError):pass
 def do_POST(self):
  path=urlparse(self.path).path;origin=self.headers.get('Origin');temp=None;target=None
  if origin and origin!='http://'+self.headers.get('Host',''):return self.output(403,{'error':'다른 사이트의 요청입니다.'})
  try:
   length=int(self.headers.get('Content-Length','0'))
   if path=='/api/records':
    m=json.loads(unquote(self.headers.get('X-Record-Metadata','')));datetime.date.fromisoformat(m['date']);uuid.UUID(m['requestId'])
    for key in ['operator','summary','improvement']:
     if not isinstance(m.get(key),str) or not m[key].strip() or len(m[key])>10000:raise ValueError()
    if not 0<length<=1024**3 or not m.get('filename','').lower().endswith('.mp4'):raise ValueError()
    assignments=m.get('assignments')
    if not isinstance(assignments,list) or not 1<=len(assignments)<=1000:raise ValueError()
    used=set()
    for person in assignments:
     if not isinstance(person,dict) or not isinstance(person.get('name'),str) or not person['name'].strip() or len(person['name'])>80:raise ValueError()
     mic=person.get('microphone','')
     if not isinstance(mic,str) or (mic and (not mic.isascii() or not mic.isdigit() or not 1<=int(mic)<=9999)):raise ValueError()
     if mic and int(mic) in used:raise ValueError()
     if mic:used.add(int(mic))
     person['name']=person['name'].strip()
    with db() as c:old=c.execute('SELECT body FROM records WHERE request_id=?',(m['requestId'],)).fetchone()
    if old:return self.output(200,json.loads(old[0]))
    rid=str(uuid.uuid4());temp=DATA/(rid+'.tmp');digest=hashlib.sha256();remaining=length
    with temp.open('wb') as f:
     while remaining:
      chunk=self.rfile.read(min(1048576,remaining))
      if not chunk:raise ValueError()
      f.write(chunk);digest.update(chunk);remaining-=len(chunk)
    with temp.open('rb') as f:head=f.read(64)
    if b'ftyp' not in head:raise ValueError()
    target=DATA/(rid+'.mp4');temp.replace(target);temp=None
    r={k:m.get(k,'') for k in ['date','operator','summary','improvement','filename','assignments']};r.update(id=rid,mode='manual',analysisStatus='failed',analysisError='NOT_CONFIGURED',created=now(),test=m.get('test') is True,sha256=digest.hexdigest(),size=length)
    with db() as c:c.execute('INSERT INTO records VALUES(?,?,?,?)',(rid,m['requestId'],json.dumps(r,ensure_ascii=False),target.name))
    target=None;return self.output(201,r)
   if path.startswith('/api/improvements/'):
    if not 0<length<100000:raise ValueError()
    m=json.loads(self.rfile.read(length));item_id=path.rsplit('/',1)[1]
    with db() as c:
     if path.startswith('/api/improvements/'):
      content=m.get('content')
      if not isinstance(content,str) or not content.strip() or len(content)>10000:raise ValueError()
      if not c.execute('SELECT id FROM records WHERE id=?',(item_id,)).fetchone():return self.output(404,{'error':'기록을 찾을 수 없습니다.'})
      c.execute('INSERT INTO improvements VALUES(?,?,?) ON CONFLICT(record_id) DO UPDATE SET content=excluded.content,updated=excluded.updated',(item_id,content.strip(),now()))
    return self.output(200,{'ok':True})
   return self.output(404,{'error':'지원하지 않는 요청입니다.'})
  except sqlite3.IntegrityError:
   with db() as c:old=c.execute('SELECT body FROM records WHERE request_id=?',(m.get('requestId',''),)).fetchone()
   return self.output(200,json.loads(old[0])) if old else self.output(409,{'error':'이미 처리된 요청입니다.'})
  except (ValueError,KeyError,TypeError):return self.output(400,{'error':'필수 항목, 인원(1~1000명), 입력 길이 또는 MP4 형식과 1GB 제한을 확인해 주세요.'})
  except Exception:return self.output(500,{'error':'저장 실패: 입력을 유지하고 같은 요청으로 재시도해 주세요.'})
  finally:
   if temp:temp.unlink(missing_ok=True)
   if target:target.unlink(missing_ok=True)
if __name__=='__main__':
 port=int(os.environ.get('CHOIR_PORT','4174'));print(f'http://127.0.0.1:{port}',flush=True);ThreadingHTTPServer(('127.0.0.1',port),Handler).serve_forever()
