import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAssignments} from '../assignments.js';
test('name and microphone stay paired, unused mic stays empty',()=>assert.deepEqual(normalizeAssignments([{name:' 가상대원A ',microphone:'3'},{name:'가상대원B',microphone:''}]),[{name:'가상대원A',microphone:'3'},{name:'가상대원B',microphone:''}]));
test('missing names, empty roster, duplicate or invalid microphones fail',()=>{
 for(const rows of [[],[{name:'',microphone:'1'}],[{name:'A',microphone:'0'}],[{name:'A',microphone:'1'},{name:'B',microphone:'1'}]])assert.throws(()=>normalizeAssignments(rows));
});
