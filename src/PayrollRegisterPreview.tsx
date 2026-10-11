import { ArrowLeft } from 'lucide-react';
import { money } from './data';
import type { PayrollBatchRow } from './types';

interface Props {
  rows: PayrollBatchRow[];
  includedIds: string[];
  from: string;
  to: string;
  currency: string;
  onToggle: (id: string) => void;
  onBack: () => void;
  onGenerate: () => void;
}

export default function PayrollRegisterPreview({rows,includedIds,from,to,currency,onToggle,onBack,onGenerate}:Props){
 const included=rows.filter(row=>includedIds.includes(row.employeeId));
 const total={base:0,additions:0,deductions:0,net:0};
 for(const row of included){total.base+=row.base;total.additions+=row.additions;total.deductions+=row.deductions;total.net+=row.net}
 return <>
  <div className="surface payroll-controls">
   <small className="muted">3 · Payroll register</small>
   <h2 className="payroll-period-heading">{from} to {to}</h2>
   <p className="muted">Asia/Manila business dates · {included.length} of {rows.length} employees included</p>
   <p className="muted payroll-review-helper">Review before saving. The calculation is fixed when saved; payment is tracked separately.</p>
   <button className="outline small" onClick={onBack}><ArrowLeft size={15}/> Back to adjustments</button>
  </div>
  <div className="surface payroll-roster payroll-register-preview">
   <div className="surface-head"><div><h3>Review employee pay</h3><p className="muted">Select the employees to include in this batch. Totals use included rows only.</p></div></div>
   <div className="table-wrap"><table><thead><tr><th>Include · Employee</th><th>Base pay</th><th>Additional earnings</th><th>Deductions</th><th>Projected net pay</th></tr></thead><tbody>
    {rows.map(row=>{const includedRow=includedIds.includes(row.employeeId);return <tr className={includedRow?'':'excluded'} key={row.employeeId}>
     <td data-label="Employee"><label className="payroll-register-name"><input type="checkbox" checked={includedRow} onChange={()=>onToggle(row.employeeId)} aria-label={`Include ${row.employeeName}`}/><span><strong>{row.employeeName}</strong><small>{row.role} · {row.lines.length} worked days</small></span></label><details><summary>Dates and adjustments</summary><small>Dates: {row.lines.map(l=>l.date).join(', ')}</small>{row.adjustments.map(a=><small key={a.id}>{a.amount<0?'Deduction':'Earning'} · {a.reason} · {money(Math.abs(a.amount),currency)}</small>)}</details></td>
     <td data-label="Base pay">{money(row.base,currency)}</td><td data-label="Earnings">{money(row.additions,currency)}</td><td data-label="Deductions">{money(row.deductions,currency)}</td><td data-label="Projected net"><strong>{money(row.net,currency)}</strong></td>
    </tr>})}
   </tbody><tfoot><tr><th>Total · {included.length} employees</th><td data-label="Base pay">{money(total.base,currency)}</td><td data-label="Earnings">{money(total.additions,currency)}</td><td data-label="Deductions">{money(total.deductions,currency)}</td><td data-label="Projected net"><strong>{money(total.net,currency)}</strong></td></tr></tfoot></table></div>
   <div className="report-actions"><span className="muted">{included.length} included · Net = base + earnings − deductions</span><button className="primary" onClick={onGenerate} disabled={!included.length||included.some(row=>row.net<0)}>Save payroll register</button></div>
  </div>
 </>
}
