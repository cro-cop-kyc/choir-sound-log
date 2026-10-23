export function newRecordUrl(record){
 const url=new URL('https://github.com/cro-cop-kyc/choir-sound-log/new/main');
 url.searchParams.set('filename','records/'+record.id+'.json');
 url.searchParams.set('value',JSON.stringify(record,null,2));
 return url.href;
}
