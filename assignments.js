export function normalizeAssignments(rows){
 if(!Array.isArray(rows)||rows.length<1||rows.length>1000)throw Error('찬양대원을 한 명 이상 입력해 주세요.');
 const used=new Set();
 return rows.map(row=>{
  const name=String(row.name||'').trim(),microphone=String(row.microphone||'').trim();
  if(!name||name.length>80)throw Error('각 찬양대원의 이름을 입력해 주세요.');
  if(microphone&&!/^[1-9]\d{0,3}$/.test(microphone))throw Error('마이크 번호는 1~9999 사이 숫자로 입력해 주세요.');
  if(microphone&&used.has(microphone))throw Error('같은 마이크 번호를 두 사람에게 배정할 수 없습니다.');
  if(microphone)used.add(microphone);
  return {name,microphone};
 });
}
