import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { seed } from './data';
import type { Database, Role } from './types';

const env=import.meta.env;
const url=env.VITE_SUPABASE_URL?.trim();
const key=env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const cloudConfigured=Boolean(url&&key);
export const cloudClient:SupabaseClient|null=cloudConfigured?createClient(url!,key!,{
 auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
}):null;
const client=()=>{if(!cloudClient)throw Error('Shared backend is not configured.');return cloudClient};
const unwrap=<T>(result:{data:T;error:{message:string}|null}):NonNullable<T>=>{if(result.error)throw Error(result.error.message);if(result.data===null)throw Error('The server returned no data.');return result.data as NonNullable<T>};

export interface CloudBusiness { business_id:string;business_name:string;member_role:Role;employee_id:string|null;display_name:string }
export interface CloudSnapshot { data:Database;revision:number;role:Role;employeeId:string|null;displayName:string;accessStatus?:'linked'|'pending'|'disabled' }
export interface StaffAccount { username:string;employee_id:string;must_change_password:boolean;active:boolean }
export interface RiderLocation {employeeId:string;name:string;orderId:string|null;latitude:number|null;longitude:number|null;accuracy:number|null;updatedAt:string|null;sessionSeenAt:string|null;sharing:boolean;status:'sharing'|'waiting'|'paused'|'offline'}
export function emptyLiveWorkspace():Database{
 const fresh=seed();
 return {...fresh,categories:[],items:[],orders:[],team:[],attendance:[],adjustments:[],payrollRuns:[],
  payrollBatches:[],payrollDraft:null,deliveryAreas:[],workShifts:[],activity:[],nextTicket:1001,
  settings:{...fresh.settings,businessName:'New food business',tagline:'',logo:'',phone:'',address:'',
   activeUserId:'',dataMode:'live'}};
}
export const cloud={
 async staffPasswordRequired():Promise<boolean>{
  const {data,error}=await client().rpc('staff_password_change_required');
  // An older Supabase project has no username accounts yet. Keep existing owner
  // and email-based staff sign-ins usable while the additive migration is applied.
  if(error?.code==='PGRST202'&&/staff_password_change_required/i.test(error.message))return false;
  if(error)throw Error(error.message);
  return data===true;
 },
 async staffAccount(action:string,businessId:string,employeeId?:string,username?:string,password?:string){
  const {data,error}=await client().functions.invoke('staff-accounts',{body:{action,businessId,employeeId,username,password}});
  if(error){
   let detail='';
   const response=(error as typeof error & {context?:Response}).context;
   if(response)try{const body=await response.clone().json() as {error?:string;message?:string};detail=body.error||body.message||''}catch{}
   throw Error(detail||data?.error||error.message);
  }
  if(data?.error)throw Error(data.error);return data as {ok?:boolean;username?:string;temporaryPassword?:string;accounts?:StaffAccount[]};
 },
 async riderLocations(businessId:string):Promise<RiderLocation[]>{return unwrap(await client().rpc('owner_rider_locations',{p_business_id:businessId})) as RiderLocation[]},
 async setRiderLocation(businessId:string,orderId:string|null,latitude:number,longitude:number,accuracy:number){const {error}=await client().rpc('set_rider_location',{p_business_id:businessId,p_order_id:orderId,p_latitude:latitude,p_longitude:longitude,p_accuracy:accuracy});if(error)throw Error(error.message)},
 async setRiderSharing(businessId:string,sharing:boolean){const {error}=await client().rpc('set_rider_sharing',{p_business_id:businessId,p_sharing:sharing});if(error)throw Error(error.message)},
 async stopRiderLocation(businessId:string){const {error}=await client().rpc('stop_rider_location',{p_business_id:businessId});if(error)throw Error(error.message)},
 async riderCollection(businessId:string,orderId:string,amount:number,method:string,reference:string,requestId:string){return unwrap(await client().rpc('record_rider_collection',{p_business_id:businessId,p_order_id:orderId,p_amount:amount,p_method:method,p_reference:reference,p_request_id:requestId}))},
 async session(){const {data,error}=await client().auth.getUser();if(error&&error.name!=='AuthSessionMissingError')throw Error(error.message);return {user:data.user}},
 async signIn(email:string,password:string){const {data,error}=await client().auth.signInWithPassword({email,password});if(error)throw Error(error.message);if(!data.user||!data.session)throw Error('Sign-in did not create a session.');return data},
 async signUp(email:string,password:string){const {data,error}=await client().auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}});if(error)throw Error(error.message);if(!data.user)throw Error('Account creation was not confirmed by the server.');return data},
 async signOut(){const {error}=await client().auth.signOut();if(error)throw Error(error.message)},
 onAuthChange(fn:(event:string)=>void){return client().auth.onAuthStateChange(event=>{window.setTimeout(()=>fn(event),0)}).data.subscription},
 async businesses():Promise<CloudBusiness[]>{return unwrap(await client().rpc('my_businesses')) as CloudBusiness[]},
 async createBusiness(name:string):Promise<string>{const initial=emptyLiveWorkspace();initial.settings.businessName=name.trim();return unwrap(await client().rpc('create_business',{p_name:name.trim(),p_initial:initial})) as string},
 async read(businessId:string):Promise<CloudSnapshot>{return unwrap(await client().rpc('read_operations',{p_business_id:businessId})) as CloudSnapshot},
 async apply(businessId:string,revision:number,action:string,next:Database,requestId:string):Promise<CloudSnapshot>{return unwrap(await client().rpc('apply_operations',{p_business_id:businessId,p_expected_revision:revision,p_action:action,p_next:next,p_request_id:requestId})) as CloudSnapshot},
 async saveEmployeeAccess(businessId:string,revision:number,next:Database,requestId:string,email:string,role:Role,employeeId:string,active:boolean):Promise<CloudSnapshot>{return unwrap(await client().rpc('save_employee_access',{p_business_id:businessId,p_expected_revision:revision,p_next:next,p_request_id:requestId,p_email:email,p_role:role,p_employee_id:employeeId,p_active:active})) as CloudSnapshot},
 async importLocal(businessId:string,revision:number,local:Database,requestId:string):Promise<CloudSnapshot>{return unwrap(await client().rpc('import_local_operations',{p_business_id:businessId,p_expected_revision:revision,p_import:local,p_request_id:requestId})) as CloudSnapshot},
 async setMember(businessId:string,email:string,role:Role,employeeId:string,active:boolean):Promise<'linked'|'pending'|'disabled'>{const {data,error}=await client().rpc('set_business_member',{p_business_id:businessId,p_email:email,p_role:role,p_employee_id:employeeId||null,p_active:active});if(error)throw Error(error.message);return data as 'linked'|'pending'|'disabled'},
};
