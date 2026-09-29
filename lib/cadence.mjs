/** Calendar-day intervals in Asia/Shanghai; an afternoon scan is due next week at 10:00. */
export function searchDue(last,everyDays,now=new Date()){
 if(!last||last.state!=='ready'||!Number.isFinite(Date.parse(last.checkedAt)))return true;
 return Math.floor((now.getTime()+8*3600000)/86400000)-Math.floor((Date.parse(last.checkedAt)+8*3600000)/86400000)>=everyDays;
}
