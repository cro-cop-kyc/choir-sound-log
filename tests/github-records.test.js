import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newRecordUrl} from '../github-records.js';
test('manual record reaches GitHub editor intact without a file download',()=>{
 const r={id:'example',date:'2026-10-24',summary:'직접 작성한 기록\n가사 & 음량 # 확인',assignments:[{name:'가상대원',microphone:'2'}]};
 const url=new URL(newRecordUrl(r));
 assert.equal(url.origin,'https://github.com');assert.equal(url.searchParams.get('filename'),'records/example.json');assert.deepEqual(JSON.parse(url.searchParams.get('value')),r);
});
