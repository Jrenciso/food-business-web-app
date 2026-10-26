import { useState } from 'react';
import { useApp } from './AppContext';
import { balance, money } from './data';
import { settleSampleOrders } from './operations';

export default function SampleSettlementPanel(){
 const {data,workspace,cloudMode,role,replace,notify}=useApp(),[lastBackup,setLastBackup]=useState('');
 if(cloudMode||workspace!=='sample'||role!=='owner')return null;
 const marked=data.orders.filter(order=>order.sample),unmarked=data.orders.filter(order=>!order.sample);
 const due=marked.filter(order=>order.status!=='Cancelled').reduce((sum,order)=>sum+balance(order),0);
 const statusCounts=marked.reduce<Record<string,number>>((rows,order)=>{rows[order.status]=(rows[order.status]||0)+1;return rows},{}),typeCounts=marked.reduce<Record<string,number>>((rows,order)=>{rows[order.type]=(rows[order.type]||0)+1;return rows},{}),paymentCount=marked.reduce((sum,order)=>sum+order.payments.length,0),dates=marked.map(order=>order.createdAt).sort();
 const prepare=()=>{
  if(unmarked.length)return notify('This workspace has unmarked orders. Move them to a separate test workspace before mock settlement.','error');
  if(!marked.length)return notify('There are no marked sample orders to settle.','info');
  const backupKey=`urban-ops-sample-backup-${new Date().toISOString().replaceAll(':','-')}`;
  try{const json=JSON.stringify(data);localStorage.setItem(backupKey,json);setLastBackup(backupKey);
   const url=URL.createObjectURL(new Blob([json],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=`${backupKey}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
  catch{return notify('Backup could not be saved. No orders were changed.','error')}
  if(!window.confirm(`Backup saved locally as ${backupKey}.\n\nComplete and add clearly marked mock payments to ${marked.filter(order=>order.status!=='Cancelled').length} non-cancelled sample orders? Cancelled orders remain unchanged.`))return;
  try{const result=settleSampleOrders(data);replace(result.data);notify(`${result.updated} sample tickets updated · ${result.paymentsAdded} mock settlements added. Backup: ${backupKey}`)}
  catch(error){notify(error instanceof Error?error.message:'Mock settlement failed.','error')}
 };
 return <div className="surface form-surface sample-settlement"><h3>Sample order preparation</h3><p className="muted">This tool runs only in the local Sample / Test workspace. It keeps earlier payments, totals, and ticket history and labels new payments as simulated.</p><div className="register-metrics"><div><span>Marked sample tickets</span><strong>{marked.length}</strong></div><div><span>Unmarked tickets</span><strong>{unmarked.length}</strong></div><div><span>Remaining non-cancelled balance</span><strong>{money(due,data.settings.currency)}</strong></div></div><p className="muted"><strong>Workspace:</strong> Sample / Test · {data.settings.businessName}. <strong>Date range:</strong> {dates[0]||'None'} to {dates[dates.length-1]||'None'}. <strong>Existing payments:</strong> {paymentCount}.</p><p className="muted"><strong>Status:</strong> {Object.entries(statusCounts).map(([name,count])=>`${name} ${count}`).join(' · ')||'None'}. <strong>Order types:</strong> {Object.entries(typeCounts).map(([name,count])=>`${name} ${count}`).join(' · ')||'None'}.</p><button className="outline" disabled={!marked.length||!!unmarked.length} onClick={prepare}>Back up and settle marked sample orders</button>{lastBackup&&<p className="muted">Backup stored in this browser: <code>{lastBackup}</code></p>}</div>;
}
