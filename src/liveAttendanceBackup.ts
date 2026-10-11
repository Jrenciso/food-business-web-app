import { activeWorkspace, uid } from './data';
import type { Attendance, Database } from './types';

const prefix='urban-ops-live-attendance-backup-';
export interface LiveAttendanceBackup { kind:'live-local-attendance-backup'; createdAt:string; attendance:Attendance[] }

export function saveLiveAttendanceBackup(data:Database):LiveAttendanceBackup{
 if(activeWorkspace()!=='live'||data.settings.dataMode!=='live')throw Error('Open the Live Local workspace before backing up attendance.');
 const backup:LiveAttendanceBackup={kind:'live-local-attendance-backup',createdAt:new Date().toISOString(),attendance:structuredClone(data.attendance)};
 localStorage.setItem(`${prefix}${Date.now()}-${uid()}`,JSON.stringify(backup));
 return backup;
}

export function latestLiveAttendanceBackup():LiveAttendanceBackup|null{
 const keys=Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter((key):key is string=>!!key&&key.startsWith(prefix)).sort();
 const raw=keys.length?localStorage.getItem(keys[keys.length-1]):null;
 if(!raw)return null;
 try{return JSON.parse(raw) as LiveAttendanceBackup}catch{return null}
}

export function downloadLiveAttendanceBackup(backup:LiveAttendanceBackup){
 const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=`live-local-attendance-before-reset-${backup.createdAt.replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),30000);
}
