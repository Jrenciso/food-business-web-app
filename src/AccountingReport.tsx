import { useState } from 'react';
import { accounting } from './accounting';
import { useApp } from './AppContext';
import { businessDay, money } from './data';
import { csv } from './ui';

export default function Accounting() {
 const { data,role,cloudMode }=useApp();
 const today=businessDay(new Date(),data.settings.timezone);
 const [from,setFrom]=useState(today),[to,setTo]=useState(today);
 if(role!=='owner')return null;
 const report=accounting(data,from,to), valid=from<=to;
 const transactionCsv=()=>csv(`accounting-transactions-${from}-to-${to}-${data.settings.timezone.replaceAll('/','-')}.csv`,[
  ['Ticket','Order date',`Payment date/time (${data.settings.timezone})`,'Order type','Delivery area','Transaction','Amount PHP','Method','Receiver','Receiver role','Reference'],
  ...report.rows.map(r=>[r.ticket,r.orderDate,r.paymentAt,r.type,r.area,r.transaction,(r.amount/100).toFixed(2),r.method,r.receiver,r.receiverRole,r.reference])
 ]);
 const summaryCsv=()=>csv(`accounting-summary-${from}-to-${to}.csv`,[
  ['Measure','Amount PHP'],['Sales booked',(report.salesBooked/100).toFixed(2)],['Payments received',(report.paymentsReceived/100).toFixed(2)],
  ['Rider collections',(report.riderCollections/100).toFixed(2)],['Other collections incl. unattributed legacy',(report.otherCollections/100).toFixed(2)],
  ['Refunds',(-report.refunds/100).toFixed(2)],['Net collected',(report.netCollected/100).toFixed(2)],
  ['Outstanding as of end date',(report.outstanding/100).toFixed(2)],[],['Rider / method','Amount PHP'],
  ...report.riderGroups.map(([name,amount])=>[name,(amount/100).toFixed(2)])
 ]);
 return <section id="accounting-report" className="surface accounting-panel"><div className="page-heading"><div><h2>Accounting · recorded sales and collections</h2>
  <p>Sales booked and money received are separate measures. This is not a profit report; food and operating costs are not included.</p></div></div>
  <div className="accounting-controls"><label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
   <label>To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
   <button className="outline" onClick={()=>{setFrom(today);setTo(today)}}>Today</button></div>
  {!valid?<p className="muted">Choose a valid date range.</p>:<>
   <div className="metric-grid">{[
    ['Sales booked',report.salesBooked],['Payments received',report.paymentsReceived],['Rider collections',report.riderCollections],
    ['Other collections',report.otherCollections],['Refunds',-report.refunds],['Net collected',report.netCollected],
    ['Outstanding as of end date',report.outstanding]
   ].map(([label,value])=><div className="metric" key={label}><span>{label}</span><strong>{money(Number(value),data.settings.currency)}</strong></div>)}</div>
   <h3>Rider collections by rider and method</h3>{report.riderGroups.length?report.riderGroups.map(([name,amount])=><div className="report-row" key={name}><span>{name}</span><strong>{money(amount,data.settings.currency)}</strong></div>):<p className="muted">None in this period.</p>}
   <p className="muted">Other collections include older payments with no recorded receiver. Outstanding covers all non-cancelled orders through the end date.</p>
   <div className="report-actions no-print"><button className="outline" onClick={transactionCsv}>Download transaction CSV</button><button className="outline" onClick={summaryCsv}>Download summary CSV</button></div>
   <p className="muted">{cloudMode?'Shared business records':'Isolated local demo records'} · business days use {data.settings.timezone}.</p>
  </>}</section>;
}
