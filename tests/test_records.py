"""Integration checks in an isolated temporary database, never user records."""
import os,sys,tempfile,threading,json,uuid,unittest,urllib.request,urllib.error
from pathlib import Path
from urllib.parse import quote
tmp=tempfile.TemporaryDirectory();os.environ['CHOIR_DATA_DIR']=tmp.name
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import server
class RecordTests(unittest.TestCase):
 def test_workflow(self):
  http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
  thread=threading.Thread(target=http.serve_forever,daemon=True);thread.start()
  base='http://127.0.0.1:'+str(http.server_port)
  def request(path,body=None,headers=None):
   data=None if body is None else body if isinstance(body,bytes) else json.dumps(body).encode()
   with urllib.request.urlopen(urllib.request.Request(base+path,data=data,headers=headers or {'Content-Type':'application/json'})) as r:return json.load(r)
  try:
   source=Path(__file__).resolve().parents[2]/'20261018-하늘소리찬양대.mp4'
   meta=dict(requestId=str(uuid.uuid4()),date='2026-10-18',operator='테스트',summary='수동 보완',improvement='초기 개선점',choirCount=30,microphones='1, 2, 5번',filename=source.name,test=True)
   record=request('/api/records',source.read_bytes(),{'X-Record-Metadata':quote(json.dumps(meta))})
   self.assertEqual(record['choirCount'],30);self.assertEqual(record['microphones'],'1, 2, 5번')
   rid=record['id'];request('/api/improvements/'+rid,{'content':'수정된 개선점'})
   saved=request('/api/records')[0];self.assertEqual(saved['improvement'],'수정된 개선점');self.assertEqual(saved['summary'],'수동 보완')
   with server.db() as c:self.assertEqual(json.loads(c.execute('SELECT body FROM records WHERE id=?',(rid,)).fetchone()[0])['improvement'],'초기 개선점')
   with self.assertRaises(urllib.error.HTTPError) as removed:request('/api/comments/'+rid)
   self.assertEqual(removed.exception.code,404);removed.exception.close()
   with self.assertRaises(urllib.error.HTTPError) as e:request('/api/improvements/'+rid,{'content':' '})
   self.assertEqual(e.exception.code,400)
   e.exception.close()
   self.assertEqual(request('/api/records')[0]['improvement'],'수정된 개선점')
  finally:http.shutdown();http.server_close()
if __name__=='__main__':unittest.main()
