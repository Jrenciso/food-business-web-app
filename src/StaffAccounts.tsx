import { useEffect, useState } from 'react';
import { cloud, type StaffAccount } from './cloud';
import { useApp } from './AppContext';
import type { TeamMember } from './types';

const accountRequests = new Map<string,Promise<StaffAccount[]>>();
function accountsFor(businessId:string,refresh=false){
 if(refresh)accountRequests.delete(businessId);
 let request=accountRequests.get(businessId);
 if(!request){
  request=cloud.staffAccount('list',businessId).then(result=>result.accounts||[]).catch(error=>{accountRequests.delete(businessId);throw error});
  accountRequests.set(businessId,request);
 }
 return request;
}

export default function StaffAccounts({ employee }: { employee: TeamMember }) {
 const { cloudBusinessId, notify } = useApp();
 const [account, setAccount] = useState<StaffAccount | null>(null);
 const [username, setUsername] = useState('');
 const [issued, setIssued] = useState<{ username:string;temporaryPassword:string } | null>(null);
 const [busy, setBusy] = useState(false);
 const [unavailable,setUnavailable]=useState(false),[loadError,setLoadError]=useState('');
 const load = async (refresh=false) => {
  if(!cloudBusinessId)return;
  try { const accounts = await accountsFor(cloudBusinessId,refresh);setAccount(accounts.find(a => a.employee_id === employee.id) || null);setUnavailable(false);setLoadError(''); }
  catch(e) { setUnavailable(true);setLoadError(e instanceof Error?e.message:'Could not reach the staff account service.'); }
 };
 useEffect(() => { void load(); }, [cloudBusinessId,employee.id]);
 const act = async (action: 'create'|'reset'|'disable'|'enable') => {
  if (!cloudBusinessId || busy) return;
  if ((action==='reset'||action==='disable') && !window.confirm(`${action === 'reset' ? 'Reset password for' : 'Disable'} ${employee.name}?`)) return;
  setBusy(true);setIssued(null);
  try {
   const result = await cloud.staffAccount(action,cloudBusinessId,employee.id,username.trim().toLowerCase());
   if(result.temporaryPassword && result.username) setIssued({ username:result.username,temporaryPassword:result.temporaryPassword });
   notify(action === 'create' ? 'Staff account created' : action === 'reset' ? 'Temporary password issued' : `Account ${action}d`);
   await load(true);
  } catch(e) { notify(e instanceof Error ? e.message : 'Account change failed.', 'error'); }
  finally { setBusy(false); }
 };
 if (employee.role === 'owner') return null;
 return <div className="staff-account-panel">
  <strong>App sign-in</strong>
  {unavailable?<><p className="muted">{loadError||'Staff account service is unavailable.'}</p><button className="outline" onClick={()=>void load(true)}>Retry connection</button></>:
  !account ? <><p className="muted">Usernames are unique across all businesses. Save the employee profile before creating access.</p>
   <div className="staff-account-actions"><input aria-label={`Username for ${employee.name}`} placeholder="username" value={username} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))}/><button className="outline" disabled={busy||!employee.active||!employee.id||!/^([a-z][a-z0-9_]{3,31})$/.test(username)} onClick={()=>void act('create')}>Create login</button></div></>:
   <><p>{account.username} · {account.active?'Active':'Disabled'}{account.must_change_password?' · password change required':''}</p><div className="staff-account-actions"><button className="outline" disabled={busy} onClick={()=>void act('reset')}>Reset password</button><button className="outline" disabled={busy||!employee.active&& !account.active} onClick={()=>void act(account.active?'disable':'enable')}>{account.active?'Disable':'Enable'}</button></div></>}
  {issued&&<div className="issued-password" role="status"><p><strong>{issued.username}</strong> · temporary password: <code>{issued.temporaryPassword}</code></p><p>Give this to the employee privately in person. It is shown only now and must be changed at first sign-in.</p><button className="outline" onClick={()=>setIssued(null)}>Hide password</button></div>}
 </div>;
}
