import json, sqlite3, uuid, datetime, hashlib
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import unquote, urlparse
ROOT=Path(__file__).parent.resolve(); DATA=ROOT/'data'; DATA.mkdir(exist_ok=True)
def db():
 c=sqlite3.connect(DATA/'records.sqlite'); c.row_factory=sqlite3.Row; return c
with db() as c:
 c.executescript("CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, request_id TEXT UNIQUE, body TEXT, video TEXT); CREATE TABLE IF NOT EXISTS comments(id TEXT PRIMARY KEY, record_id TEXT, name TEXT, memo TEXT, created TEXT); CREATE TRIGGER IF NOT EXISTS immutable_records BEFORE UPDATE ON records BEGIN SELECT RAISE(ABORT,'immutable'); END;")
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
class Handler(BaseHTTPRequestHandler):
 def output(self,code,obj):
  b=json.dumps(obj,ensure_ascii=False).encode();self.send_response(code);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
 def do_GET(self):
  path=urlparse(self.path).path
  if path=='/api/records':
   with db() as c:rows=c.execute('SELECT body FROM records').fetchall()
   return self.output(200,sorted([json.loads(r[0]) for r in rows],key=lambda r:r['date'],reverse=True))
  if path.startswith('/api/comments/'):
   with db() as c:rows=c.execute('SELECT name,memo,created FROM comments WHERE record_id=? ORDER BY created',(path.rsplit('/',1)[1],)).fetchall()
   return self.output(200,[dict(r) for r in rows])
  if path.startswith('/media/'):
   with db() as c:r=c.execute('SELECT video FROM records WHERE id=?',(path.rsplit('/',1)[1],)).fetchone()
   if not r:return self.output(404,{'error':'기록이 없습니다.'})
   p=DATA/r[0];mime='video/mp4'
  else:
   allowed={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/engine.js':'engine.js','/style.css':'style.css'}
   if path not in allowed:return self.output(404,{'error':'페이지가 없습니다.'})
   p=ROOT/allowed[path];mime={'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8'}[p.suffix[1:]]
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
    for key in ['operator','summary','improvement','nextStep']:
     if not isinstance(m.get(key),str) or not m[key].strip() or len(m[key])>10000:raise ValueError()
    if not 0<length<=1024**3 or not m.get('filename','').lower().endswith('.mp4'):raise ValueError()
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
    r={k:m.get(k,'') for k in ['date','operator','summary','strength','improvement','nextStep','filename']};r.update(id=rid,mode='manual',analysisStatus='failed',analysisError='NOT_CONFIGURED',created=now(),test=m.get('test') is True,sha256=digest.hexdigest(),size=length)
    with db() as c:c.execute('INSERT INTO records VALUES(?,?,?,?)',(rid,m['requestId'],json.dumps(r,ensure_ascii=False),target.name))
    target=None;return self.output(201,r)
   if path.startswith('/api/comments/'):
    if not 0<length<50000:raise ValueError()
    m=json.loads(self.rfile.read(length));rid=path.rsplit('/',1)[1]
    if not m.get('name','').strip() or not m.get('memo','').strip():raise ValueError()
    with db() as c:
     if not c.execute('SELECT id FROM records WHERE id=?',(rid,)).fetchone():raise ValueError()
     c.execute('INSERT INTO comments VALUES(?,?,?,?,?)',(str(uuid.uuid4()),rid,m['name'][:80],m['memo'][:10000],now()))
    return self.output(201,{'ok':True})
   return self.output(404,{'error':'지원하지 않는 요청입니다.'})
  except sqlite3.IntegrityError:
   with db() as c:old=c.execute('SELECT body FROM records WHERE request_id=?',(m.get('requestId',''),)).fetchone()
   return self.output(200,json.loads(old[0])) if old else self.output(409,{'error':'이미 처리된 요청입니다.'})
  except (ValueError,KeyError,TypeError):return self.output(400,{'error':'날짜, 필수 항목, MP4 형식 및 1GB 파일 제한을 확인해 주세요.'})
  except Exception:return self.output(500,{'error':'저장 실패: 입력을 유지하고 같은 요청으로 재시도해 주세요.'})
  finally:
   if temp:temp.unlink(missing_ok=True)
   if target:target.unlink(missing_ok=True)
if __name__=='__main__':
 print('http://127.0.0.1:4174',flush=True);ThreadingHTTPServer(('127.0.0.1',4174),Handler).serve_forever()
