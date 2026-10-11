import { useRef, useState } from 'react';

import { Download, Printer } from 'lucide-react';

import { toBlob } from 'html-to-image';

import { useApp } from './AppContext';

import { businessDay, dateTime, money } from './data';

import { csv, Modal } from './ui';

import { activePaymentMethods, paymentMethodLabel } from './paymentMethods';

import type { PayrollBatch, PayrollBatchRow, Settings } from './types';



const sum=(values:number[])=>values.reduce((a,b)=>a+b,0);

const decimal=(amount:number)=>(amount/100).toFixed(2);

const slug=(value:string)=>value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'employee';

const hours=(start:string,end:string)=>start&&end?`${start}–${end}`:'Hours not recorded';



export function SavedPayrollRegister({batch,onHistory,onPayment,onPayslip}:{batch:PayrollBatch;onHistory:()=>void;onPayment:()=>void;onPayslip:(id:string)=>void}){

 const {data,notify}=useApp(),currency=data.settings.currency,totals={base:sum(batch.rows.map(r=>r.base)),additions:sum(batch.rows.map(r=>r.additions)),deductions:sum(batch.rows.map(r=>r.deductions)),net:sum(batch.rows.map(r=>r.net))};

 const exportRegister=()=>{csv(`payroll-${batch.number.toLowerCase()}.csv`,[['Batch','From','To','Employee','Base PHP','Earnings PHP','Deductions PHP','Net PHP','Status'],...batch.rows.map(r=>[batch.number,batch.from,batch.to,r.employeeName,decimal(r.base),decimal(r.additions),decimal(r.deductions),decimal(r.net),r.payment?'Paid':'Unpaid'])]);notify('Payroll register CSV downloaded')};

 return <><div className="surface payroll-controls"><div className="surface-head"><div><h3>{batch.status==='void'?'Cancelled':'Saved'} payroll register · {batch.number}</h3><p className="muted">{batch.from} to {batch.to} · {batch.rows.length} employees · Saved {dateTime(batch.createdAt,data.settings.timezone)}</p></div><button className="outline" onClick={onHistory}>Payroll history</button></div><p className="muted">{batch.status==='void'?'This historical register was cancelled.':'This register fixes the pay calculation. Payment is recorded separately.'}</p></div><div className="surface payroll-roster payroll-register-preview"><div className="surface-head"><h3>Employee pay</h3><button className="outline" onClick={exportRegister}><Download size={16}/> Download CSV</button></div><div className="table-wrap"><table><thead><tr><th>Employee</th><th>Base pay</th><th>Additional earnings</th><th>Deductions</th><th>Net pay</th></tr></thead><tbody>{batch.rows.map(row=><tr key={row.employeeId}><td data-label="Employee"><button className="payroll-name-button" onClick={()=>onPayslip(row.employeeId)}>{row.employeeName}</button><small className="payroll-dates">{row.lines.length} worked days · {row.payment?'Paid':'Unpaid'}</small></td><td data-label="Base pay">{money(row.base,currency)}</td><td data-label="Earnings">{money(row.additions,currency)}</td><td data-label="Deductions">{money(row.deductions,currency)}</td><td data-label="Net pay"><strong>{money(row.net,currency)}</strong></td></tr>)}</tbody><tfoot><tr><th>Total · {batch.rows.length} employees</th><td data-label="Base pay">{money(totals.base,currency)}</td><td data-label="Earnings">{money(totals.additions,currency)}</td><td data-label="Deductions">{money(totals.deductions,currency)}</td><td data-label="Net pay"><strong>{money(totals.net,currency)}</strong></td></tr></tfoot></table></div><div className="report-actions"><span className="muted">Select an employee name to open their payslip.</span>{batch.status==='generated'&&<button className="primary" onClick={onPayment}>Proceed to payment tracking</button>}</div></div></>

}



type PaymentDraft={paid:boolean;date:string;method:string;remark:string};

export function PayrollPaymentTracking({batch,onRegister,onPayslip}:{batch:PayrollBatch;onRegister:()=>void;onPayslip:(id:string)=>void}){

 const {data,commit,notify,setPage}=useApp(),today=businessDay(new Date(),'Asia/Manila'),currency=data.settings.currency,methods=activePaymentMethods(data.settings);

 const [draft,setDraft]=useState<Record<string,PaymentDraft>>(()=>Object.fromEntries(batch.rows.map(row=>[row.employeeId,{paid:!!row.payment,date:row.payment?.date||today,method:row.payment?.method||'',remark:row.payment?.remark||''}])));

 const [editing,setEditing]=useState('');

 const update=(id:string,patch:Partial<PaymentDraft>)=>setDraft(current=>({...current,[id]:{...current[id],...patch}}));

 const startPaid=(id:string)=>{update(id,{date:today,method:'',remark:''});setEditing(id)};

 const correct=(row:PayrollBatchRow)=>{if(!window.confirm(`Change ${row.employeeName} to For payment? The previous payment details will remain in correction history after you save the batch.`))return;update(row.employeeId,{paid:false});setEditing('')};

 const net=sum(batch.rows.map(r=>r.net)),paid=sum(batch.rows.filter(r=>draft[r.employeeId]?.paid).map(r=>r.net));

 const save=async ()=>{

  if(editing)return notify('Confirm or close the open payment details before saving.','error');

  const changes=batch.rows.filter(row=>!!row.payment!==!!draft[row.employeeId]?.paid);

  if(!changes.length)return notify('No payment status changes to save.','info');

  for(const row of changes){const next=draft[row.employeeId];if(next.paid&&(!/^\d{4}-\d{2}-\d{2}$/.test(next.date)||Number.isNaN(new Date(`${next.date}T12:00:00Z`).getTime())||new Date(`${next.date}T12:00:00Z`).toISOString().slice(0,10)!==next.date))return notify(`Enter a valid paid date for ${row.employeeName}.`,'error');if(next.paid&&next.method&&!methods.some(m=>m.id===next.method))return notify('Choose an enabled method, or leave it blank.','error')}

  if(await commit('payroll',d=>{const current=d.payrollBatches?.find(b=>b.id===batch.id);if(!current||current.status!=='generated')throw Error('This payroll register is unavailable for payment changes.');for(const original of changes){const row=current.rows.find(r=>r.employeeId===original.employeeId),next=draft[original.employeeId];if(!row)throw Error('Employee row is missing.');if(next.paid){if(row.payment)throw Error('This employee is already paid.');row.payment={at:new Date().toISOString(),date:next.date,method:next.method,methodLabel:methods.find(m=>m.id===next.method)?.label||'',reference:'',remark:next.remark.trim(),amount:row.net}}else{if(!row.payment)throw Error('This employee is already for payment.');row.paymentHistory=[...(row.paymentHistory||[]),row.payment];row.payment=null}}}))notify(`Payment status saved for ${changes.length} employees`)

 };

 return <><div className="surface payroll-controls"><div className="surface-head"><div><h3>4 · Payment tracking · {batch.number}</h3><p className="muted">{batch.from} to {batch.to} · Save employee payment states together.</p></div><button className="outline" onClick={onRegister}>Back to register</button></div></div><div className="surface payroll-roster payroll-payment-batch"><div className="surface-head"><div><h3>Batch payments</h3><p className="muted">Changes shown here remain pending until Save payment status.</p></div></div><div className="table-wrap"><table><thead><tr><th>Employee</th><th>Net pay</th><th>Payment status</th></tr></thead><tbody>{batch.rows.map(row=>{const entry=draft[row.employeeId],changed=!!entry?.paid!==!!row.payment;return <tr key={row.employeeId}><td><strong>{row.employeeName}</strong><button className="outline small payroll-payslip-button" onClick={()=>onPayslip(row.employeeId)}>View payslip</button></td><td>{money(row.net,currency)}</td><td><div className="payroll-payment-status">{entry?.paid?<><span className="payroll-status-badge paid">Paid{changed?' · unsaved':''}</span><small>{entry.date}</small><button className="text-btn" onClick={()=>correct(row)}>Change to For payment</button></>:<><span className="payroll-status-badge due">For payment{changed?' · unsaved':''}</span><button className="outline small" onClick={()=>startPaid(row.employeeId)}>Mark paid / transferred</button></>}</div>{editing===row.employeeId&&<div className="payroll-payment-inline"><h4>Mark {row.employeeName} paid</h4><label>Date paid<input type="date" value={entry.date} onChange={e=>update(row.employeeId,{date:e.target.value})}/></label><label>Transfer / payment method (optional)<select value={entry.method} onChange={e=>update(row.employeeId,{method:e.target.value})}><option value="">Not recorded</option>{methods.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label>{!methods.length&&<button className="text-btn" onClick={()=>setPage('settings')}>Enable payment methods in Settings</button>}<label>Remarks (optional)<input maxLength={160} value={entry.remark} onChange={e=>update(row.employeeId,{remark:e.target.value})}/></label><div className="report-actions"><button className="outline small" onClick={()=>setEditing('')}>Back / Keep for payment</button><button className="primary small" onClick={()=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)||Number.isNaN(new Date(`${entry.date}T12:00:00Z`).getTime())||new Date(`${entry.date}T12:00:00Z`).toISOString().slice(0,10)!==entry.date)return notify('Enter a valid paid date.','error');update(row.employeeId,{paid:true});setEditing('')}}>Confirm paid</button></div></div>}{row.payment&&entry.paid&&<small className="payroll-paid-date">Saved {row.payment.date}{row.payment.method&&` · ${paymentMethodLabel(data.settings,row.payment.method,row.payment.methodLabel)}`}</small>}</td></tr>})}</tbody></table></div><div className="payroll-payment-summary"><span>Net pay <strong>{money(net,currency)}</strong></span><span>Paid <strong>{money(paid,currency)}</strong></span><span>For payment <strong>{money(net-paid,currency)}</strong></span></div><div className="report-actions"><span className="muted">Confirm each paid row, then save all status changes once.</span><button className="primary" onClick={save}>Save payment status</button></div></div></>

}



export function PayrollPayslip({batch,row,onClose}:{batch:PayrollBatch;row:PayrollBatchRow;onClose:()=>void}){

 const {data,notify}=useApp(),settings:Settings=data.settings,card=useRef<HTMLDivElement>(null),[busy,setBusy]=useState(false);

 const download=async()=>{if(!card.current)return;setBusy(true);try{await document.fonts.ready;await Promise.all(Array.from(card.current.querySelectorAll('img')).map(img=>img.decode().catch(()=>undefined)));const blob=await toBlob(card.current,{backgroundColor:'#fffdf8',pixelRatio:2,cacheBust:true,canvasWidth:card.current.scrollWidth,canvasHeight:card.current.scrollHeight});if(!blob)throw Error('Empty payslip image');const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`payslip-${slug(row.employeeName)}-${batch.from}-to-${batch.to}.png`;document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),30000);notify('Payslip image downloaded')}catch{notify('Could not download payslip image. Check the logo and try again.','error')}finally{setBusy(false)}};

 const print=()=>{document.body.dataset.print='payroll';window.addEventListener('afterprint',()=>delete document.body.dataset.print,{once:true});window.print()};

 return <Modal title={`${row.employeeName} · payslip`} onClose={onClose} wide><div className="payslip-modal-inner"><div className="payslip-receipt payroll-print" ref={card}><div className="payslip-receipt-brand">{settings.logo&&<img src={settings.logo} alt="Business logo"/>}<h2>{settings.businessName}</h2><small>{settings.tagline}</small><strong>Payslip</strong></div>{settings.dataMode==='sample'&&<strong className="sample-tag">SAMPLE / TEST DATA</strong>}<div className="payslip-receipt-section"><p><span>Employee</span><strong>{row.employeeName}</strong></p><p><span>Role</span><strong>{row.role}</strong></p><p><span>Period</span><strong>{batch.from} to {batch.to}</strong></p><p><span>Issue date</span><strong>{businessDay(batch.createdAt,settings.timezone)}</strong></p></div><div className="payslip-receipt-section"><h4>Worked shifts · {row.lines.length} days</h4>{row.lines.map(line=><p key={line.attendanceId}><span>{line.date}<small>{line.shiftName||'Recorded hours'} · {hours(line.start,line.end)}</small></span><strong>{money(line.accrual,settings.currency)}</strong></p>)}</div><div className="payslip-receipt-section"><h4>Pay</h4><p><span>Base / gross pay</span><strong>{money(row.base,settings.currency)}</strong></p>{row.adjustments.map(a=><p key={a.id}><span>{a.amount<0?'Deduction':'Additional earning'}<small>{a.reason}</small></span><strong>{a.amount<0?'−':'+'}{money(Math.abs(a.amount),settings.currency)}</strong></p>)}<p className="payslip-receipt-net"><span>Net pay</span><strong>{money(row.net,settings.currency)}</strong></p></div><div className="payslip-receipt-section"><p><span>Payment status</span><strong>{row.payment?'Paid':'Unpaid'}</strong></p>{row.payment&&<p><span>Paid date</span><strong>{row.payment.date}</strong></p>}</div><div className="payslip-receipt-signatures"><span>Prepared by / date</span><span>Received by / date</span></div></div><div className="report-actions no-print"><button className="outline" onClick={print}><Printer size={16}/> Print</button><button className="primary" onClick={download} disabled={busy}><Download size={16}/>{busy?'Preparing image…':'Download PNG'}</button></div></div></Modal>

}

