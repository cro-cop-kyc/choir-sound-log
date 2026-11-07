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
 const video={duration:239,readyState:1,currentTime:0,play(){this.playCount=(this.playCount||0)+1;return Promise.resolve();},removeEventListener(){}};
 for(const start of [69,135,140,175,205]){seekToSegment(video,start);assert.equal(video.currentTime,start);assert.ok(video.playCount>0);}
});
test('latest click wins if metadata is still loading',()=>{
 const listeners=new Set();const video={duration:239,readyState:0,currentTime:0,play(){this.playCount=(this.playCount||0)+1;return Promise.resolve();},addEventListener(_,cb){listeners.add(cb);},removeEventListener(_,cb){listeners.delete(cb);},load(){}};
 seekToSegment(video,69);seekToSegment(video,205);assert.equal(listeners.size,1);for(const callback of listeners)callback();assert.equal(video.currentTime,205);
});

test('blocked playback reports an actionable failure',async()=>{
 const video={duration:239,readyState:1,currentTime:0,play(){return Promise.reject(Error('blocked'));}};
 let failure;seekToSegment(video,135,error=>{failure=error;});await Promise.resolve();
 assert.equal(video.currentTime,135);assert.equal(failure.message,'blocked');
});
