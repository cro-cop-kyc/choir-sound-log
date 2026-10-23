"""Remove only one explicitly marked test record, keeping a full DB backup and video."""
import sys,sqlite3,json,datetime
from pathlib import Path
root=Path(__file__).parent/'data'
if len(sys.argv)!=2:raise SystemExit('Usage: python rollback_test.py RECORD_ID')
c=sqlite3.connect(root/'records.sqlite');rid=sys.argv[1]
r=c.execute('SELECT body FROM records WHERE id=?',(rid,)).fetchone()
if not r or json.loads(r[0]).get('test') is not True:raise SystemExit('Only an existing test record can be rolled back.')
backup=root/('backup-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'.sqlite')
with sqlite3.connect(backup) as dest:c.backup(dest)
with c:
 c.execute('DELETE FROM comments WHERE record_id=?',(rid,));c.execute('DELETE FROM records WHERE id=?',(rid,))
print('Test record removed. Database backup:',backup,'Video preserved.')
