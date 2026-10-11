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
export function emptyLiveWorkspace():Database{
 const fresh=seed();
 return {...fresh,categories:[],items:[],orders:[],team:[],attendance:[],adjustments:[],payrollRuns:[],
  payrollBatches:[],payrollDraft:null,deliveryAreas:[],workShifts:[],activity:[],nextTicket:1001,
  settings:{...fresh.settings,businessName:'New food business',tagline:'',logo:'',phone:'',address:'',
   activeUserId:'',dataMode:'live'}};
}
export const cloud={
 async session(){const {data,error}=await client().auth.getUser();if(error&&error.name!=='AuthSessionMissingError')throw Error(error.message);return {user:data.user}},
 async signIn(email:string,password:string){const {data,error}=await client().auth.signInWithPassword({email,password});if(error)throw Error(error.message);if(!data.user||!data.session)throw Error('Sign-in did not create a session.');return data},
 async signUp(email:string,password:string){const {data,error}=await client().auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}});if(error)throw Error(error.message);if(!data.user)throw Error('Account creation was not confirmed by the server.');return data},
 async signOut(){const {error}=await client().auth.signOut();if(error)throw Error(error.message)},
 onAuthChange(fn:()=>void){return client().auth.onAuthStateChange(()=>{window.setTimeout(fn,0)}).data.subscription},
 async businesses():Promise<CloudBusiness[]>{return unwrap(await client().rpc('my_businesses')) as CloudBusiness[]},
 async createBusiness(name:string):Promise<string>{const initial=emptyLiveWorkspace();initial.settings.businessName=name.trim();return unwrap(await client().rpc('create_business',{p_name:name.trim(),p_initial:initial})) as string},
 async read(businessId:string):Promise<CloudSnapshot>{return unwrap(await client().rpc('read_operations',{p_business_id:businessId})) as CloudSnapshot},
 async apply(businessId:string,revision:number,action:string,next:Database,requestId:string):Promise<CloudSnapshot>{return unwrap(await client().rpc('apply_operations',{p_business_id:businessId,p_expected_revision:revision,p_action:action,p_next:next,p_request_id:requestId})) as CloudSnapshot},
 async saveEmployeeAccess(businessId:string,revision:number,next:Database,requestId:string,email:string,role:Role,employeeId:string,active:boolean):Promise<CloudSnapshot>{return unwrap(await client().rpc('save_employee_access',{p_business_id:businessId,p_expected_revision:revision,p_next:next,p_request_id:requestId,p_email:email,p_role:role,p_employee_id:employeeId,p_active:active})) as CloudSnapshot},
 async importLocal(businessId:string,revision:number,local:Database,requestId:string):Promise<CloudSnapshot>{return unwrap(await client().rpc('import_local_operations',{p_business_id:businessId,p_expected_revision:revision,p_import:local,p_request_id:requestId})) as CloudSnapshot},
 async setMember(businessId:string,email:string,role:Role,employeeId:string,active:boolean):Promise<'linked'|'pending'|'disabled'>{const {data,error}=await client().rpc('set_business_member',{p_business_id:businessId,p_email:email,p_role:role,p_employee_id:employeeId||null,p_active:active});if(error)throw Error(error.message);return data as 'linked'|'pending'|'disabled'},
};
