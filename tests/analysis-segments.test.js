import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {seekToSegment} from '../analysis-segments.js';
test('first analysis timestamps are inside the uploaded 239 second video',()=>{
 const r=JSON.parse(readFileSync(new URL('../records/c5741018-5f21-4520-8c10-000000000001.json',import.meta.url),'utf8'));
 assert.equal(r.duration,239);assert.equal(r.segments.length,5);
 for(const s of r.segments)assert.ok(s.start>=0&&s.start<s.end&&s.end<r.duration);
 assert.deepEqual(r.segments.map(s=>s.start),[69,135,140,175,205]);
});
test('loaded video jumps exactly to the selected start',()=>{
 const video={duration:239,readyState:1,currentTime:0,removeEventListener(){}};
 for(const start of [69,135,140,175,205]){seekToSegment(video,start);assert.equal(video.currentTime,start);}
});
test('latest click wins if metadata is still loading',()=>{
 const listeners=new Set();const video={duration:239,readyState:0,currentTime:0,addEventListener(_,cb){listeners.add(cb);},removeEventListener(_,cb){listeners.delete(cb);},load(){}};
 seekToSegment(video,69);seekToSegment(video,205);assert.equal(listeners.size,1);for(const callback of listeners)callback();assert.equal(video.currentTime,205);
});
