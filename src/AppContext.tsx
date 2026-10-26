import { dayActionAllowed } from './operations';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { activeWorkspace, can, db, setActiveWorkspace } from './data';
import { activePaymentMethods } from './paymentMethods';
import { cashPayment, currentOperatingDate, defaultLocationId, moduleEnabled, openBusinessDay } from './operations';
import { cloud, cloudConfigured, emptyLiveWorkspace, type CloudBusiness, type CloudSnapshot } from './cloud';
import type { Database, Role, TeamMember } from './types';
import type { PaymentEntryValue } from './PaymentEntry';
export type Page='dashboard'|'pos'|'orders'|'menu'|'employees'|'attendance'|'payroll'|'reports'|'settings'|'register'|'monitor';
type Workspace='sample'|'live';
interface State {data:Database;user:TeamMember;role:Role;workspace:Workspace;signedIn:boolean;page:Page;setPage:(p:Page)=>void;attendanceDate:string;setAttendanceDate:(date:string)=>void;commit:(action:Parameters<typeof can>[1],fn:(d:Database)=>void,access?:{email:string;role:Role;employeeId:string;active:boolean},options?:{requestId?:string;checkoutPayment?:PaymentEntryValue})=>Promise<boolean>;switchRole:(id:string)=>void;switchWorkspace:(w:Workspace)=>void;signIn:(id:string,w:Workspace)=>boolean;signOut:()=>void;replace:(d:Database)=>void;notify:(message:string,kind?:'success'|'error'|'info')=>void;cloudMode:boolean;cloudAvailable:boolean;switchMode:(mode:'demo'|'cloud')=>void;authReady:boolean;cloudAuthenticated:boolean;cloudBusinesses:CloudBusiness[];cloudBusinessId:string;cloudSignIn:(email:string,password:string)=>Promise<boolean>;cloudSignUp:(email:string,password:string)=>Promise<boolean>;cloudCreateBusiness:(name:string)=>Promise<boolean>;cloudSelectBusiness:(id:string)=>Promise<boolean>;cloudImportLocal:()=>Promise<boolean>;cloudSetMember:(email:string,role:Role,employeeId:string,active:boolean)=>Promise<boolean>;staffPasswordRequired:boolean;changeStaffPassword:(password:string)=>Promise<boolean>;refreshCloud:()=>Promise<void>;saveState:'idle'|'saving'|'error';retryPending:()=>Promise<void>}
const Context=createContext<State|null>(null);
export const useApp=()=>{const c=useContext(Context);if(!c)throw Error('App context missing');return c};
const SESSION='urban-ops-demo-session';
function DemoProvider({children,onSwitch}:{children:React.ReactNode;onSwitch:(mode:'demo'|'cloud')=>void}){
 const [workspace,setWorkspace]=useState<Workspace>(activeWorkspace);
 const [data,setData]=useState<Database>(()=>db.load(activeWorkspace()));
 const [session,setSession]=useState<string|null>(()=>localStorage.getItem(SESSION));
 const [page,setPage]=useState<Page>('dashboard');
 const [attendanceDate,setAttendanceDate]=useState('');
 const [toast,setToast]=useState<{id:number;message:string;kind:'success'|'error'|'info'}|null>(null);
 const user=data.team.find(t=>t.id===session)||data.team.find(t=>t.role==='owner')||data.team[0],role=user.role,signedIn=!!session&&data.team.some(t=>t.id===session&&t.active);
 useEffect(()=>{document.documentElement.dataset.theme=data.settings.theme;document.documentElement.style.setProperty('--accent',data.settings.accent)},[data.settings.theme,data.settings.accent]);
 useEffect(()=>{document.title=`${data.settings.businessName||'Food Operations'} | Operations`},[data.settings.businessName]);
 useEffect(()=>{if(signedIn&&role!=='owner'&&page!=='orders'&&page!=='pos'&&page!=='monitor'&&!(page==='register'&&dayActionAllowed(data,role)))setPage('orders')},[page,role,signedIn,data]);
 useEffect(()=>{if(toast&&toast.kind!=='error'){const id=window.setTimeout(()=>setToast(t=>t?.id===toast.id?null:t),6000);return()=>clearTimeout(id)}},[toast]);
 const notify:State['notify']=(message,kind)=>setToast({id:Date.now(),message,kind:kind||(/^(enter|choose|add at least|amount exceeds|refund exceeds|cannot|could not|this .*cannot|that .*not allowed|invalid|missing|no active|reassign|select an active)/i.test(message)?'error':'success')});
 const commit:State['commit']=async(action,fn,_access,options)=>{try{if(!signedIn)throw Error('Sign in required');const next=db.prepareMutation(data,role,action,fn,user);if(options?.checkoutPayment){if(role!=='owner')throw Error('Only the owner can record payment during checkout.');const order=next.orders.find(o=>!data.orders.some(old=>old.id===o.id));if(!order)throw Error('Checkout ticket was not created.');const payment=options.checkoutPayment;if(!activePaymentMethods(next.settings).some(method=>method.id===payment.method&&method.label===payment.methodLabel))throw Error('Choose an enabled payment method.');const prior=order.payments.reduce((sum,entry)=>sum+(entry.kind==='refund'?-entry.amount:entry.amount),0),remaining=order.total-prior;if(payment.amount<=0||payment.amount>remaining)throw Error('Payment amount exceeds the remaining balance.');const registerOn=moduleEnabled(next,'register'),day=openBusinessDay(next);if(registerOn&&(!day||day.state!=='accepting'||day.businessDate!==currentOperatingDate(next)))throw Error('Open register session is required before recording this payment.');if(payment.method==='cash'){const result=cashPayment(remaining,payment.tenderedAmount||0);if(!payment.cashConfirmed||result.applied!==payment.amount||result.change!==payment.changeAmount)throw Error('Confirm the cash received and change returned.')}else if(payment.tenderedAmount!==undefined||payment.changeAmount!==undefined||payment.cashConfirmed)throw Error('Non-cash payments cannot include cash tender or change.');order.payments.push({id:crypto.randomUUID(),amount:payment.amount,method:payment.method,methodLabel:payment.methodLabel,reference:payment.reference,at:new Date().toISOString(),kind:'payment',receivedById:user.id,receivedByName:user.name,receivedByRole:role,...(payment.method==='cash'?{tenderedAmount:payment.tenderedAmount,changeAmount:payment.changeAmount,cashConfirmed:true,custody:registerOn?'register' as const:'external' as const}: {custody:'external' as const}),locationId:defaultLocationId,...(registerOn?{registerSessionId:day!.registerSessionId}:{}),businessDate:currentOperatingDate(next)});}db.save(next);setData(next);notify('Order saved');return true}catch(e){const message=e instanceof Error?e.message:'Could not save changes.';if(message.includes('Role'))setData(db.load(workspace));notify(message.includes('Role')?'This demo role cannot perform that action.':message==='Sign in required'?'Sign in to continue.':e instanceof DOMException&&e.name==='QuotaExceededError'?'Could not save. Browser storage may be full.':message,'error');return false}};
 const signIn:State['signIn']=(id,w)=>{try{const next=db.load(w),actor=next.team.find(t=>t.id===id&&t.active);if(!actor){notify('Select an active demo profile.','error');return false}setActiveWorkspace(w);localStorage.setItem(SESSION,id);setWorkspace(w);setData(next);setSession(id);setPage(actor.role==='owner'?'dashboard':'orders');notify(`Signed in as ${actor.name}`);return true}catch{notify('Could not sign in. Browser storage may be unavailable.','error');return false}};
 const signOut=()=>{localStorage.removeItem(SESSION);setSession(null);setPage('dashboard');notify('Signed out','info')};
 const switchRole=(id:string)=>{const next=data.team.find(t=>t.id===id&&t.active);if(!next){notify('That demo profile is unavailable.','error');return}try{localStorage.setItem(SESSION,id);setSession(id);setPage(next.role==='owner'?'dashboard':'orders');notify(`Previewing ${next.name}`)}catch{notify('Could not switch demo role.','error')}};
 const switchWorkspace=(w:Workspace)=>{if(w===workspace)return;try{const next=db.load(w),actor=next.team.find(t=>t.id===user.id&&t.active)||next.team.find(t=>t.role==='owner'&&t.active);if(!actor)throw Error('No active profile');setActiveWorkspace(w);localStorage.setItem(SESSION,actor.id);setWorkspace(w);setData(next);setSession(actor.id);setPage(actor.role==='owner'?'dashboard':'orders');notify(`Opened ${w==='sample'?'SAMPLE / TEST DATA':'LIVE LOCAL'} workspace`)}catch{notify('Could not open workspace.','error')}};
 const replace=(next:Database)=>{try{db.save(next);setData(next);notify('Changes saved')}catch{notify('Could not save. Browser storage may be full.','error')}};
 return <Context.Provider value={{data,user,role,workspace,signedIn,page,setPage,attendanceDate,setAttendanceDate,commit,switchRole,switchWorkspace,signIn,signOut,replace,notify,cloudMode:false,cloudAvailable:cloudConfigured,switchMode:onSwitch,authReady:true,cloudAuthenticated:false,cloudBusinesses:[],cloudBusinessId:'',cloudSignIn:async()=>false,cloudSignUp:async()=>false,cloudCreateBusiness:async()=>false,cloudSelectBusiness:async()=>false,cloudImportLocal:async()=>false,cloudSetMember:async()=>false,staffPasswordRequired:false,changeStaffPassword:async()=>false,refreshCloud:async()=>{},saveState:'idle',retryPending:async()=>{}}}>{children}{toast&&<div className={`toast toast-${toast.kind}`} role={toast.kind==='error'?'alert':'status'} aria-live={toast.kind==='error'?'assertive':'polite'}><span className="toast-icon">{toast.kind==='error'?<AlertCircle/>:toast.kind==='success'?<CheckCircle2/>:<Info/>}</span><span>{toast.message}</span><button aria-label="Dismiss notification" onClick={()=>setToast(null)}><X size={18}/></button></div>}</Context.Provider>
}

type PendingCloudWrite={action:Parameters<typeof can>[1];next:Database;revision:number;requestId:string;access?:{email:string;role:Role;employeeId:string;active:boolean};checkoutPayment?:PaymentEntryValue};
function CloudProvider({children,onSwitch}:{children:React.ReactNode;onSwitch:(mode:'demo'|'cloud')=>void}){
 const [snapshot,setSnapshot]=useState<CloudSnapshot|null>(null),snapshotRef=useRef<CloudSnapshot|null>(null);
 const [businesses,setBusinesses]=useState<CloudBusiness[]>([]),[businessId,setBusinessId]=useState('');
 const [authReady,setAuthReady]=useState(false),[authenticated,setAuthenticated]=useState(false);
 const [staffPasswordRequired,setStaffPasswordRequired]=useState(false);
 const [saveState,setSaveState]=useState<'idle'|'saving'|'error'>('idle');
 const [page,setPage]=useState<Page>('dashboard'),[attendanceDate,setAttendanceDate]=useState('');
 const [toast,setToast]=useState<{id:number;message:string;kind:'success'|'error'|'info'}|null>(null);
 const pendingRef=useRef<PendingCloudWrite|null>(null),busyRef=useRef(false);
 const data=snapshot?.data||emptyLiveWorkspace(),role=snapshot?.role||'owner';
 const user:TeamMember={id:snapshot?.employeeId||'',name:snapshot?.displayName||(role==='owner'?'Owner':'Member'),contact:'',role,
  title:'',active:true,activeFrom:'',activeTo:'',notes:'',rates:[]};
 const signedIn=authenticated&&!!snapshot;
 const notify:State['notify']=(message,kind='success')=>setToast({id:Date.now(),message,kind});
 const accept=(next:CloudSnapshot)=>{snapshotRef.current=next;setSnapshot(next);setSaveState('idle')};
 const loadBusiness=async(id:string,navigate=true)=>{const next=await cloud.read(id);accept(next);setBusinessId(id);
  localStorage.setItem('urban-ops-cloud-business',id);if(navigate)setPage(next.role==='owner'?'dashboard':'orders')};
 const initialize=async()=>{try{const session=await cloud.session();if(!session.user){setAuthenticated(false);setSnapshot(null);snapshotRef.current=null;setStaffPasswordRequired(false);return}
   const passwordRequired=await cloud.staffPasswordRequired();setStaffPasswordRequired(passwordRequired);
   if(passwordRequired){setAuthenticated(true);setSnapshot(null);snapshotRef.current=null;return}
   setAuthenticated(true);const list=await cloud.businesses();setBusinesses(list);
   const remembered=localStorage.getItem('urban-ops-cloud-business');const chosen=list.find(b=>b.business_id===remembered)||list[0];
    // Initialization may run again after auth changes or tab resume. Refresh
    // the data without overriding the page the user is currently viewing.
    if(chosen)await loadBusiness(chosen.business_id,false);
  }catch(e){notify(e instanceof Error?e.message:'Could not connect to shared workspace.','error')}
  finally{setAuthReady(true)}};
 useEffect(()=>{void initialize();const subscription=cloud.onAuthChange(event=>{
   // Session restoration and token refreshes are routine background events.
   // Re-running initialize for them reloads the business and sends owners back
   // to the dashboard, even when they are actively working on another page.
   if(event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')return;
   void initialize();
  });return()=>subscription.unsubscribe()},[]);
 useEffect(()=>{if(!businessId)return;const id=window.setInterval(()=>{if(!pendingRef.current&&!busyRef.current)void cloud.read(businessId).then(next=>{if(next.revision!==snapshotRef.current?.revision)accept(next)}).catch(e=>{if(/access denied|password change required/i.test(e instanceof Error?e.message:'')){snapshotRef.current=null;setSnapshot(null);setBusinessId('');setBusinesses([]);notify('Business access is no longer available.','error')}else setSaveState('error')})},12000);return()=>clearInterval(id)},[businessId]);
 useEffect(()=>{document.documentElement.dataset.theme=data.settings.theme;document.documentElement.style.setProperty('--accent',data.settings.accent)},[data.settings.theme,data.settings.accent]);
 useEffect(()=>{document.title=`${data.settings.businessName||'Food Operations'} | Operations`},[data.settings.businessName]);
 useEffect(()=>{if(signedIn&&role!=='owner'&&page!=='orders'&&page!=='pos'&&page!=='monitor'&&!(page==='register'&&dayActionAllowed(data,role)))setPage('orders')},[signedIn,role,page,data]);
 useEffect(()=>{if(toast&&toast.kind!=='error'){const id=window.setTimeout(()=>setToast(t=>t?.id===toast.id?null:t),6000);return()=>clearTimeout(id)}},[toast]);
 const send=async(operation:PendingCloudWrite)=>{busyRef.current=true;setSaveState('saving');try{
   const next=operation.checkoutPayment?await cloud.finalizeCheckout(businessId,operation.revision,operation.next,operation.checkoutPayment,operation.requestId):operation.access?await cloud.saveEmployeeAccess(businessId,operation.revision,operation.next,operation.requestId,operation.access.email,operation.access.role,operation.access.employeeId,operation.access.active):operation.action==='pos'&&role!=='owner'?await cloud.staffOrder(businessId,operation.revision,operation.next,operation.requestId):await cloud.apply(businessId,operation.revision,operation.action,operation.next,operation.requestId);
   accept(next);pendingRef.current=null;notify(next.accessStatus==='pending'?'Employee saved. Ask them to create and confirm an account with this email.':next.accessStatus==='disabled'?'Employee saved; app access disabled.':next.accessStatus==='linked'?'Employee saved; app access linked.':'Saved to shared workspace');return true;
  }catch(e){const message=e instanceof Error?e.message:'Save did not reach the server.';
   const code=e&&typeof e==='object'&&'code' in e?String((e as {code?:unknown}).code||''):'';
   const status=e&&typeof e==='object'&&'status' in e?Number((e as {status?:unknown}).status):0;
   if(code==='40001'||/Workspace changed|revision|40001/i.test(message)){pendingRef.current=null;
    try{accept(await cloud.read(businessId))}catch{}notify('Another device changed this workspace. Review the latest data and retry your edit.','error')}
   else if(code==='42501'||code==='P0001'||code.startsWith('22')||code.startsWith('23')||code.startsWith('PGRST')||(status>=400&&status<500&&status!==408&&status!==429)){
    // A server rejection did not create a write to retry. Clear the queue and
    // refresh the authoritative view so one denied action cannot block later work.
    pendingRef.current=null;setSaveState('idle');
    try{accept(await cloud.read(businessId))}catch{}
    notify(message,'error')}
   else{pendingRef.current=operation;setSaveState('error');notify(`Save unconfirmed: ${message}. Use Retry pending save before submitting again.`,'error')}
   return false;
  }finally{busyRef.current=false}};
 const commit:State['commit']=async(action,fn,access,options)=>{if(!signedIn||!snapshotRef.current){notify('Sign in to continue.','error');return false}
  if(pendingRef.current||busyRef.current){notify('A save is pending. Retry it before making another change.','error');return false}
  try{const current=snapshotRef.current;const actor={...user,id:current.employeeId||user.id,role:current.role};
   const next=db.prepareMutation(current.data,current.role,action,fn,actor);
   if(current.role!=='owner')for(const order of next.orders)delete order.paidAmount;
   if(options?.checkoutPayment&&current.role!=='owner')throw Error('Only the owner can record payment during checkout.');
   return await send({action,next,revision:current.revision,requestId:options?.requestId||crypto.randomUUID(),access,checkoutPayment:options?.checkoutPayment});
  }catch(e){notify(e instanceof Error?e.message:'Could not prepare change.','error');return false}};
 const retryPending=async()=>{if(pendingRef.current&&!busyRef.current)await send(pendingRef.current)};
 const cloudSignIn=async(identifier:string,password:string)=>{try{const normalized=identifier.trim().toLowerCase();const email=normalized.includes('@')?normalized:`${normalized}@staff.urbancasero.invalid`;await cloud.signIn(email,password);await initialize();return true}catch{notify('Sign-in failed. Check your sign-in details and try again.','error');return false}};
 const changeStaffPassword=async(password:string)=>{try{await cloud.staffAccount('change-password','',undefined,undefined,password);setStaffPasswordRequired(false);await initialize();notify('Password changed');return true}catch(e){notify(e instanceof Error?e.message:'Could not change password.','error');return false}};
 const cloudSignUp=async(email:string,password:string)=>{try{await cloud.signUp(email,password);notify('Account created. Open the confirmation email, then sign in.','info');return true}catch(e){notify(e instanceof Error?e.message:'Could not create account.','error');return false}};
 const cloudCreateBusiness=async(name:string)=>{try{const id=await cloud.createBusiness(name);setBusinesses(await cloud.businesses());await loadBusiness(id);return true}catch(e){notify(e instanceof Error?e.message:'Could not create business.','error');return false}};
 const cloudSelectBusiness=async(id:string)=>{try{await loadBusiness(id);return true}catch(e){notify(e instanceof Error?e.message:'Could not open business.','error');return false}};
 const cloudImportLocal=async()=>{if(!snapshot||role!=='owner')return false;
  const local=db.load('live'),backup=new Blob([JSON.stringify(local,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(backup),link=document.createElement('a');link.href=url;link.download=`live-local-backup-${new Date().toISOString().slice(0,10)}.json`;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),30000);
  if(!window.confirm('A Live Local JSON backup was downloaded. Import it into this empty shared business? Existing shared records will not be overwritten.'))return false;
  try{setSaveState('saving');const next=await cloud.importLocal(businessId,snapshot.revision,local,crypto.randomUUID());accept(next);notify('Live Local records imported into the shared business. Keep the backup file.');return true}
  catch(e){setSaveState('error');notify(e instanceof Error?e.message:'Import failed. Local records remain in this browser.','error');return false}};
 const cloudSetMember=async(email:string,newRole:Role,employeeId:string,active:boolean)=>{try{const result=await cloud.setMember(businessId,email,newRole,employeeId,active);notify(result==='pending'?'Access saved. Ask the employee to create and confirm an account with this email.':result==='disabled'?'Employee access disabled.':'Employee access linked.');return true}catch(e){notify(e instanceof Error?e.message:'Membership update failed.','error');return false}};
 const signOut=()=>{void (async()=>{try{if(role==='rider'&&businessId)await cloud.stopRiderLocation(businessId);await cloud.signOut();setAuthenticated(false);setSnapshot(null);snapshotRef.current=null;setBusinessId('');setBusinesses([]);setPage('dashboard')}catch(e){notify(e instanceof Error?e.message:'Could not sign out.','error')}})()};
 const noDemo=()=>notify('Demo role and workspace switches are unavailable in shared mode.','error');
 return <Context.Provider value={{data,user,role,workspace:'live',signedIn,page,setPage,attendanceDate,setAttendanceDate,
  commit,switchRole:noDemo,switchWorkspace:noDemo,signIn:()=>false,signOut,replace:noDemo,notify,
  cloudMode:true,cloudAvailable:true,switchMode:onSwitch,authReady,cloudAuthenticated:authenticated,cloudBusinesses:businesses,cloudBusinessId:businessId,
  cloudSignIn,cloudSignUp,cloudCreateBusiness,cloudSelectBusiness,cloudImportLocal,cloudSetMember,staffPasswordRequired,changeStaffPassword,refreshCloud:initialize,saveState,retryPending}}>
  {children}{toast&&<div className={`toast toast-${toast.kind}`} role={toast.kind==='error'?'alert':'status'} aria-live={toast.kind==='error'?'assertive':'polite'}><span className="toast-icon">{toast.kind==='error'?<AlertCircle/>:toast.kind==='success'?<CheckCircle2/>:<Info/>}</span><span>{toast.message}</span><button aria-label="Dismiss notification" onClick={()=>setToast(null)}><X size={18}/></button></div>}
 </Context.Provider>;
}
export function AppProvider({children}:{children:React.ReactNode}){const [mode,setMode]=useState<'demo'|'cloud'>(()=>cloudConfigured&&localStorage.getItem('urban-ops-app-mode')!=='demo'?'cloud':'demo');const switchMode=(next:'demo'|'cloud')=>{if(next==='cloud'&&!cloudConfigured)return;localStorage.setItem('urban-ops-app-mode',next);setMode(next)};return mode==='cloud'?<CloudProvider onSwitch={switchMode}>{children}</CloudProvider>:<DemoProvider onSwitch={switchMode}>{children}</DemoProvider>}
