import { createContext, useContext, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { activeWorkspace, can, db, setActiveWorkspace } from './data';
import type { Database, Role, TeamMember } from './types';
export type Page='dashboard'|'pos'|'orders'|'menu'|'employees'|'attendance'|'payroll'|'reports'|'settings';
type Workspace='sample'|'live';
interface State {data:Database;user:TeamMember;role:Role;workspace:Workspace;signedIn:boolean;page:Page;setPage:(p:Page)=>void;attendanceDate:string;setAttendanceDate:(date:string)=>void;commit:(action:Parameters<typeof can>[1],fn:(d:Database)=>void)=>boolean;switchRole:(id:string)=>void;switchWorkspace:(w:Workspace)=>void;signIn:(id:string,w:Workspace)=>boolean;signOut:()=>void;replace:(d:Database)=>void;notify:(message:string,kind?:'success'|'error'|'info')=>void}
const Context=createContext<State|null>(null);
export const useApp=()=>{const c=useContext(Context);if(!c)throw Error('App context missing');return c};
const SESSION='urban-ops-demo-session';
export function AppProvider({children}:{children:React.ReactNode}){
 const [workspace,setWorkspace]=useState<Workspace>(activeWorkspace);
 const [data,setData]=useState<Database>(()=>db.load(activeWorkspace()));
 const [session,setSession]=useState<string|null>(()=>localStorage.getItem(SESSION));
 const [page,setPage]=useState<Page>('dashboard');
 const [attendanceDate,setAttendanceDate]=useState('');
 const [toast,setToast]=useState<{id:number;message:string;kind:'success'|'error'|'info'}|null>(null);
 const user=data.team.find(t=>t.id===session)||data.team.find(t=>t.role==='owner')||data.team[0],role=user.role,signedIn=!!session&&data.team.some(t=>t.id===session&&t.active);
 useEffect(()=>{document.documentElement.dataset.theme=data.settings.theme;document.documentElement.style.setProperty('--accent',data.settings.accent)},[data.settings.theme,data.settings.accent]);
 useEffect(()=>{document.title=`${data.settings.businessName||'Food Operations'} | Operations`},[data.settings.businessName]);
 useEffect(()=>{if(signedIn&&role!=='owner'&&page!=='orders')setPage('orders')},[page,role,signedIn]);
 useEffect(()=>{if(toast&&toast.kind!=='error'){const id=window.setTimeout(()=>setToast(t=>t?.id===toast.id?null:t),6000);return()=>clearTimeout(id)}},[toast]);
 const notify:State['notify']=(message,kind)=>setToast({id:Date.now(),message,kind:kind||(/^(enter|choose|add at least|amount exceeds|refund exceeds|cannot|could not|this .*cannot|that .*not allowed|invalid|missing|no active|reassign|select an active)/i.test(message)?'error':'success')});
 const commit:State['commit']=(action,fn)=>{try{if(!signedIn)throw Error('Sign in required');const next=db.mutate(data,role,action,fn,user);setData(next);notify('Changes saved');return true}catch(e){const message=e instanceof Error?e.message:'Could not save changes.';if(message.includes('Role'))setData(db.load(workspace));notify(message.includes('Role')?'This demo role cannot perform that action.':message==='Sign in required'?'Sign in to continue.':e instanceof DOMException&&e.name==='QuotaExceededError'?'Could not save. Browser storage may be full.':message,'error');return false}};
 const signIn:State['signIn']=(id,w)=>{try{const next=db.load(w),actor=next.team.find(t=>t.id===id&&t.active);if(!actor){notify('Select an active demo profile.','error');return false}setActiveWorkspace(w);localStorage.setItem(SESSION,id);setWorkspace(w);setData(next);setSession(id);setPage(actor.role==='owner'?'dashboard':'orders');notify(`Signed in as ${actor.name}`);return true}catch{notify('Could not sign in. Browser storage may be unavailable.','error');return false}};
 const signOut=()=>{localStorage.removeItem(SESSION);setSession(null);setPage('dashboard');notify('Signed out','info')};
 const switchRole=(id:string)=>{const next=data.team.find(t=>t.id===id&&t.active);if(!next){notify('That demo profile is unavailable.','error');return}try{localStorage.setItem(SESSION,id);setSession(id);setPage(next.role==='owner'?'dashboard':'orders');notify(`Previewing ${next.name}`)}catch{notify('Could not switch demo role.','error')}};
 const switchWorkspace=(w:Workspace)=>{if(w===workspace)return;try{const next=db.load(w),actor=next.team.find(t=>t.id===user.id&&t.active)||next.team.find(t=>t.role==='owner'&&t.active);if(!actor)throw Error('No active profile');setActiveWorkspace(w);localStorage.setItem(SESSION,actor.id);setWorkspace(w);setData(next);setSession(actor.id);setPage(actor.role==='owner'?'dashboard':'orders');notify(`Opened ${w==='sample'?'SAMPLE / TEST DATA':'LIVE LOCAL'} workspace`)}catch{notify('Could not open workspace.','error')}};
 const replace=(next:Database)=>{try{db.save(next);setData(next);notify('Changes saved')}catch{notify('Could not save. Browser storage may be full.','error')}};
 return <Context.Provider value={{data,user,role,workspace,signedIn,page,setPage,attendanceDate,setAttendanceDate,commit,switchRole,switchWorkspace,signIn,signOut,replace,notify}}>{children}{toast&&<div className={`toast toast-${toast.kind}`} role={toast.kind==='error'?'alert':'status'} aria-live={toast.kind==='error'?'assertive':'polite'}><span className="toast-icon">{toast.kind==='error'?<AlertCircle/>:toast.kind==='success'?<CheckCircle2/>:<Info/>}</span><span>{toast.message}</span><button aria-label="Dismiss notification" onClick={()=>setToast(null)}><X size={18}/></button></div>}</Context.Provider>
}
