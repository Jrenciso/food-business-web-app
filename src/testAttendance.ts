import { addDays } from './analytics';
import { businessDay, rateAt, uid } from './data';
import type { Attendance, Database, RateVersion, TeamMember } from './types';

export function testAttendanceWeek(now:Date=new Date()):[string,string]{
 const today=businessDay(now,'Asia/Manila');
 const weekday=new Date(`${today}T12:00:00Z`).getUTCDay();
 const sunday=addDays(today,weekday===0?0:-weekday);
 return [addDays(sunday,-6),sunday];
}

const validRate=(rate:RateVersion|null):rate is RateVersion=>!!rate&&Number.isSafeInteger(rate.amount)&&rate.amount>0&&(rate.basis==='daily'||rate.basis==='monthly');
const savedRate=(employee:TeamMember,date:string)=>{
 const effective=rateAt(employee,date);
 if(validRate(effective))return effective;
 return [...employee.rates].sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate)||b.recordedAt.localeCompare(a.recordedAt)).find(validRate)||null;
};

export function makeTestAttendance(data:Database,from:string):Attendance[]{
 const patterns=[[0,1,3,4,6],[0,2,3,5,6],[0,1,4,5],[1,2,4,6]];
 const offDays=[2,1,3,5];
 const shifts=[['08:30','16:30'],['09:00','17:00'],['10:00','18:00'],['11:00','19:00']];
 const at=new Date().toISOString();
 return data.team.filter(e=>e.active).flatMap((employee,index)=>{
  const pattern=patterns[index%patterns.length],off=offDays[index%offDays.length],shift=shifts[index%shifts.length];
  return [...pattern,off].sort((a,b)=>a-b).map(day=>{
   const date=addDays(from,day),worked=day!==off,rate=worked?savedRate(employee,date):null;
   const notes=worked&&day===pattern[0]?(rate&&index%2===0?'TEST ATTENDANCE DATA · example shift':!rate?'TEST ATTENDANCE DATA · no valid saved rate; owner review needed':''):'';
   return {id:uid(),employeeId:employee.id,date,worked,start:worked?shift[0]:'',end:worked?shift[1]:'',notes,updatedAt:at,rateSnapshot:rate,revisions:[{at,summary:'TEST ATTENDANCE DATA created for payroll practice'}],testData:true};
  });
 });
}
