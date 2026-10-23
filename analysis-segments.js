export function seekToSegment(video,start){
 if(!video||!Number.isFinite(start)||start<0)throw Error('잘못된 영상 구간입니다.');
 const move=()=>{video.currentTime=Number.isFinite(video.duration)?Math.min(start,Math.max(0,video.duration-0.05)):start;};
 if(video._pendingSegmentSeek)video.removeEventListener('loadedmetadata',video._pendingSegmentSeek);
 if(video.readyState>=1)move();else{video._pendingSegmentSeek=move;video.addEventListener('loadedmetadata',move,{once:true});video.load();}
}
