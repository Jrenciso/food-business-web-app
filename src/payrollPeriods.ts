import { addDays } from './analytics';
import { monthDays } from './data';
import type { Settings } from './types';

export interface PayrollPeriodOption { from:string; to:string; label:string }
const utc=(date:string)=>new Date(`${date}T12:00:00Z`);
const monthKey=(date:string,offset:number)=>{const [year,month]=date.split('-').map(Number);return new Date(Date.UTC(year,month-1+offset,1)).toISOString().slice(0,7)};
const month=(date:string)=>new Intl.DateTimeFormat('en-PH',{month:'long',timeZone:'UTC'}).format(utc(date));
const covered=(from:string,to:string,year:number)=>`${month(from)} ${Number(from.slice(8))}${Number(from.slice(0,4))!==year?`, ${from.slice(0,4)}`:''}–${from.slice(0,7)===to.slice(0,7)?'':`${month(to)} `}${Number(to.slice(8))}${Number(to.slice(0,4))!==year?`, ${to.slice(0,4)}`:''}`;
export function isoWeek(date:string){const day=utc(date);day.setUTCDate(day.getUTCDate()+4-(day.getUTCDay()||7));const isoYear=day.getUTCFullYear();const first=new Date(Date.UTC(isoYear,0,1));return {year:isoYear,week:Math.ceil((((day.getTime()-first.getTime())/86400000)+1)/7)};}
export function payrollPeriods(settings:Settings,today:string):PayrollPeriodOption[]{
 const schedule=settings.payrollSchedule||'weekly',periods:PayrollPeriodOption[]=[],year=Number(today.slice(0,4));
 if(schedule==='weekly'){
  const weekday=utc(today).getUTCDay(),monday=addDays(today,-((weekday+6)%7));
  for(let i=0;i<12;i++){const from=addDays(monday,-7*i),to=addDays(from,6),iso=isoWeek(from);periods.push({from,to,label:`Week ${iso.week}${iso.year!==year?` ${iso.year}`:''} (${covered(from,to,year)})`})}
 }else if(schedule==='monthly'){
  for(let i=0;i<8;i++){const key=monthKey(today,-i),from=`${key}-01`,to=`${key}-${monthDays(from)}`;periods.push({from,to,label:`${month(from)} ${key.slice(0,4)}`})}
 }else{
  const cutoff=Math.max(1,Math.min(27,settings.payrollCutoff||15));
  for(let i=0;i<8;i++){const key=monthKey(today,-i),first=`${key}-01`,middle=`${key}-${String(cutoff).padStart(2,'0')}`,second=addDays(middle,1),last=`${key}-${monthDays(first)}`;periods.push({from:first,to:middle,label:`Period 1 (${covered(first,middle,year)})`},{from:second,to:last,label:`Period 2 (${covered(second,last,year)})`})}
  periods.sort((a,b)=>b.from.localeCompare(a.from));
 }
 return periods.filter(period=>period.from<=today);
}
