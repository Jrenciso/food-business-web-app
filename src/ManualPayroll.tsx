import { useState } from 'react';
import { useApp } from './AppContext';
import { activePaymentMethods } from './paymentMethods';
import { money, uid } from './data';
import { cents } from './ui';
import { currentOperatingDate, moduleEnabled, openBusinessDay } from './operations';

export default function ManualPayroll(){
 const {data,user,commit,notify,saveState}=useApp(),methods=activePaymentMethods(data.settings);
 const today=currentOperatingDate(data),[employeeId,setEmployeeId]=useState(''),[from,setFrom]=useState(today),[to,setTo]=useState(today),[amount,setAmount]=useState(''),[method,setMethod]=useState(''),[reference,setReference]=useState(''),[note,setNote]=useState('');
 const selectedMethod=methods.find(item=>item.id===method),value=cents(amount),day=openBusinessDay(data);
 const save=async()=>{
  if(!employeeId||!from||!to||from>to||!Number.isSafeInteger(value)||value<=0||!selectedMethod)return notify('Choose an employee, valid dates, amount, and enabled payment method.','error');
  if(method==='cash'&&moduleEnabled(data,'register')&&!day)return notify('Open Register before paying payroll cash from the drawer.','error');
  const at=new Date().toISOString(),id=uid();
  if(await commit('payroll',draft=>{
   draft.manualPayrollEntries??=[];
   draft.manualPayrollEntries.push({id,employeeId,from,to,amount:value,method,reference:reference.trim(),note:note.trim(),at,actorId:user.id});
   if(method==='cash'&&moduleEnabled(draft,'register')&&day){draft.cashMovements??=[];draft.cashMovements.push({id:`payroll-${id}`,at,businessDate:currentOperatingDate(draft,new Date(at)),kind:'cash-out',category:'Payroll',description:`Payroll payment · ${draft.team.find(member=>member.id===employeeId)?.name||employeeId}${reference.trim()?` · ${reference.trim()}`:''}`,amount:value,fromCustody:'register',toCustody:'external',actorId:user.id,locationId:day.locationId,registerSessionId:day.registerSessionId})}
  })){setAmount('');setReference('');setNote('');notify('Manual payroll payment saved')}
 };
 return <section className="page-pad"><div className="page-heading"><div><h2>Payroll</h2><p>Manual payroll periods while Attendance is off.</p></div></div><div className="surface form-surface"><h3>Record a payroll payment</h3><p className="muted">Enter the agreed amount for this period. Attendance is off, so this payment is not calculated from work logs. A cash drawer payment creates one Payroll cash movement.</p><div className="register-movement-grid"><label>Employee<select value={employeeId} onChange={event=>setEmployeeId(event.target.value)}><option value="">Choose employee</option>{data.team.filter(member=>member.active&&member.role!=='owner').map(member=><option value={member.id} key={member.id}>{member.name}</option>)}</select></label><label>Amount<input type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={event=>setAmount(event.target.value)}/></label><label>From<input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label>To<input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label><label>Payment method<select value={method} onChange={event=>setMethod(event.target.value)}><option value="">Choose a method</option>{methods.map(item=><option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label>Reference<input value={reference} onChange={event=>setReference(event.target.value)}/></label><label className="full">Period note<input value={note} onChange={event=>setNote(event.target.value)}/></label></div><button className="primary" disabled={saveState!=='idle'} onClick={save}>Save payroll payment</button></div><div className="surface form-surface"><h3>Saved manual payments</h3><div className="register-ticket-list">{[...(data.manualPayrollEntries||[])].reverse().map(entry=><div key={entry.id}><span><b>{data.team.find(member=>member.id===entry.employeeId)?.name||entry.employeeId}</b><br/><small>{entry.from} to {entry.to} · {entry.method}{entry.reference?` · ${entry.reference}`:''}</small></span><b>{money(entry.amount,data.settings.currency)}</b></div>)}</div>{!data.manualPayrollEntries?.length&&<p className="muted">No manual payroll payments yet. Earlier payroll batches remain saved and will be available when Attendance is re-enabled.</p>}</div></section>;
}
