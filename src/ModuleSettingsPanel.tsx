import { useApp } from './AppContext';
import { cloud } from './cloud';
import { moduleCatalog, modulesFor, openBusinessDay } from './operations';
import type { ModuleId, Role } from './types';
import { cents, pesos } from './ui';

export default function ModuleSettingsPanel(){
 const {data,commit,notify,cloudMode}=useApp(),modules=modulesFor(data);
 const toggle=async(id:ModuleId)=>{
  if(id==='register'&&modules.register&&openBusinessDay(data))return notify('Close the open business day before turning off Register.','error');
  const next=!modules[id],entry=moduleCatalog.find(x=>x.id===id)!;
  if(id==='register'&&next&&cloudMode){try{if(!await cloud.registerFeatureReady())return notify('Deploy the business-day database migration before enabling Register in the shared workspace.','error')}catch(error){return notify(error instanceof Error?error.message:'Could not verify Register support.','error')}}
  if(!next&&!window.confirm(`Turn off ${entry.name}?\n\n${entry.dependency}\n\nSaved records will remain available when you turn it back on.`))return;
  if(await commit('settings',draft=>{draft.settings.modules={...modules,[id]:next}}))notify(`${entry.name} ${next?'enabled':'disabled'}`);
 };
 const toggleRole=async(role:Role)=>{const list=data.settings.dayControlRoles||[];if(await commit('settings',draft=>{draft.settings.dayControlRoles=list.includes(role)?list.filter(x=>x!==role):[...list,role]}))notify('Business-day permissions saved')};
 return <div className="surface form-surface module-settings"><h3>Modules</h3><p className="muted">Turn optional areas on or off for this business. Orders, Menu, Settings, and staff identity stay available for the core operation. Saved records are retained.</p><div className="module-list">{moduleCatalog.map(entry=><div className="module-row" key={entry.id}><div><strong>{entry.name}</strong><p>{entry.purpose}</p><small>{entry.dependency}</small></div><label className="checkline"><input type="checkbox" checked={modules[entry.id]} onChange={()=>toggle(entry.id)} aria-label={`Enable ${entry.name}`}/><span>{modules[entry.id]?'On':'Off'}</span></label></div>)}</div><div className="module-configuration"><h4>Business-day controls</h4><p className="muted">The owner can always open, stop, and close. Grant another operational role only if needed.</p><div className="module-roles">{(['chef','kitchen','rider'] as Role[]).map(role=><label className="checkline" key={role}><input type="checkbox" checked={(data.settings.dayControlRoles||[]).includes(role)} onChange={()=>toggleRole(role)}/>{role==='kitchen'?'Kitchen staff':role}</label>)}</div><div className="register-movement-grid"><label>Business-day cutoff<input type="time" value={data.settings.businessDayCutoff||'00:00'} onChange={e=>void commit('settings',draft=>{draft.settings.businessDayCutoff=e.target.value})}/><small>Orders before this local time belong to the previous business date.</small></label><label>Cash variance threshold ({data.settings.currency})<input type="number" min="0" step="0.01" value={pesos(data.settings.cashVarianceThreshold||0)} onChange={e=>void commit('settings',draft=>{draft.settings.cashVarianceThreshold=cents(e.target.value)})}/></label></div></div></div>;
}
