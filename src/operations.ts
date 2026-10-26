import type { BusinessDayRecord, Database, ModuleId, ModuleSettings, Order, Payment, Role, Status } from './types';

const collected=(o:Order)=>o.payments.reduce((sum,p)=>sum+(p.kind==='refund'?-p.amount:p.amount),0);
const balance=(o:Order)=>Math.max(0,o.total-collected(o));
const testOrder=(o:Order)=>Boolean(o.sample||o.testDataSeed);

export const moduleCatalog:{id:ModuleId;name:string;purpose:string;dependency:string}[]=[
 {id:'dashboard',name:'Dashboard',purpose:'Quick overview and activity summaries.',dependency:'Orders remain available without it.'},
 {id:'register',name:'Register / Business day',purpose:'Opening, cash custody, and daily close.',dependency:'When off, orders and payments continue without a day-opening requirement.'},
 {id:'attendance',name:'Attendance',purpose:'Work time and shift records.',dependency:'Staff sign-in and roles remain available; Payroll uses manual period input when off.'},
 {id:'payroll',name:'Payroll',purpose:'Pay calculations and saved payroll periods.',dependency:'Attendance can continue without Payroll.'},
 {id:'reports',name:'Reports',purpose:'Advanced operational reports and exports.',dependency:'The Register close summary remains available.'},
 {id:'riderTracking',name:'Rider tracking',purpose:'Current rider location sharing and map.',dependency:'Rider assignment, delivery progress, and payments remain available.'},
 {id:'liveOrderMonitor',name:'Live Order Monitor',purpose:'Read-only live queue display for the operations team.',dependency:'Requires signed-in business access; Orders remains the place to update tickets.'},
];
export const defaultModules=():ModuleSettings=>({dashboard:true,register:false,attendance:true,payroll:true,reports:true,riderTracking:true,liveOrderMonitor:true});
export const modulesFor=(d:Database):ModuleSettings=>({...defaultModules(),...d.settings.modules});
export const moduleEnabled=(d:Database,id:ModuleId)=>modulesFor(d)[id];

export function operatingDate(value:Date|string,timezone='Asia/Manila',cutoff='00:00'){
 const date=new Date(value),parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const get=(name:string)=>parts.find(part=>part.type===name)?.value||'00';
 let day=`${get('year')}-${get('month')}-${get('day')}`;
 if(`${get('hour')}:${get('minute')}`<cutoff){const prior=new Date(`${day}T00:00:00Z`);prior.setUTCDate(prior.getUTCDate()-1);day=prior.toISOString().slice(0,10)}
 return day;
}
export const currentOperatingDate=(d:Database,at=new Date())=>operatingDate(at,d.settings.timezone||'Asia/Manila',d.settings.businessDayCutoff||'00:00');
export const openBusinessDay=(d:Database)=>[...(d.businessDays||[])].reverse().find(day=>day.state!=='closed');
export const canAcceptOrders=(d:Database)=>!moduleEnabled(d,'register')||Boolean(openBusinessDay(d)?.state==='accepting'&&openBusinessDay(d)?.businessDate===currentOperatingDate(d));
export const dayActionAllowed=(d:Database,role:Role)=>role==='owner'||(d.settings.dayControlRoles||[]).includes(role);
export const defaultLocationId='default-location';
export const defaultRegisterId='main-register';

export function businessDaySummary(d:Database,day:BusinessDayRecord,includeTest=false){
 const date=day.businessDate,orders=d.orders.filter(o=>(o.businessDate||operatingDate(o.createdAt,d.settings.timezone,d.settings.businessDayCutoff))===date&&o.status!=='Cancelled'&&(includeTest||!testOrder(o)));
 const allOrders=d.orders.filter(o=>includeTest||!testOrder(o));
 const payments=allOrders.flatMap(o=>o.payments.map(p=>({order:o,p}))).filter(({p})=>(p.businessDate||operatingDate(p.at,d.settings.timezone,d.settings.businessDayCutoff))===date&&(includeTest||!p.isTest));
 const sessionPayments=payments.filter(({p})=>p.registerSessionId===day.registerSessionId||(!p.registerSessionId&&p.at>=day.openedAt&&(!day.closedAt||p.at<=day.closedAt)));
 const movements=(d.cashMovements||[]).filter(m=>m.businessDate===date&&(includeTest||!m.isTest));
 const registerCash=sessionPayments.reduce((sum,{p})=>sum+(p.method==='cash'&&p.custody==='register'?(p.kind==='refund'?-p.amount:p.amount):0),0);
 const movementCash=movements.reduce((sum,m)=>sum+(m.toCustody==='register'?m.amount:0)-(m.fromCustody==='register'?m.amount:0),0);
 const riderCash=[...new Set(d.orders.flatMap(o=>o.payments.filter(p=>p.custody==='rider').map(p=>p.receivedById)).filter((id):id is string=>!!id))].reduce((sum,id)=>sum+riderCashHeld(d,id,includeTest),0);
 const outstanding=allOrders.filter(o=>o.status!=='Cancelled').reduce((sum,o)=>sum+balance(o),0);
 const salesByType=orders.reduce<Record<string,number>>((totals,o)=>{totals[o.type]=(totals[o.type]||0)+o.total;return totals},{});
 const itemTotals=orders.flatMap(o=>o.lines).reduce<Record<string,{quantity:number;amount:number}>>((totals,line)=>{const row=totals[line.name]||{quantity:0,amount:0};row.quantity+=line.quantity;row.amount+=line.unitPrice*line.quantity;totals[line.name]=row;return totals},{});
 const outflowsByCategory=movements.filter(m=>m.kind==='cash-out').reduce<Record<string,number>>((totals,m)=>{totals[m.category]=(totals[m.category]||0)+m.amount;return totals},{});
 return {sales:orders.reduce((sum,o)=>sum+o.total,0),salesByType,itemTotals,outflowsByCategory,discounts:orders.reduce((sum,o)=>sum+o.discount,0),collections:payments.filter(x=>x.p.kind==='payment').reduce((sum,x)=>sum+x.p.amount,0),refunds:payments.filter(x=>x.p.kind==='refund').reduce((sum,x)=>sum+x.p.amount,0),expectedCash:(day.openingFloat||0)+registerCash+movementCash,riderCash,outstanding,unfinished:allOrders.filter(o=>o.status!=='Completed'&&o.status!=='Cancelled'),orders,payments,movements};
}

export function riderCashHeld(d:Database,riderId:string,includeTest=false){
 const collectedCash=d.orders.filter(o=>includeTest||!testOrder(o)).flatMap(o=>o.payments).filter(p=>p.method==='cash'&&p.custody==='rider'&&p.receivedById===riderId&&(includeTest||!p.isTest)).reduce((sum,p)=>sum+(p.kind==='refund'?-p.amount:p.amount),0);
 const handedOver=(d.cashMovements||[]).filter(m=>m.kind==='rider-handover'&&m.riderId===riderId&&(includeTest||!m.isTest)).reduce((sum,m)=>sum+m.amount,0);
 return Math.max(0,collectedCash-handedOver);
}

export function cashPayment(balanceCentavos:number,tenderCentavos:number){
 if(!Number.isSafeInteger(balanceCentavos)||!Number.isSafeInteger(tenderCentavos)||balanceCentavos<=0||tenderCentavos<=0)throw Error('Enter a valid cash amount.');
 const applied=Math.min(balanceCentavos,tenderCentavos);return {applied,change:tenderCentavos-applied,balanceAfter:balanceCentavos-applied};
}

const completionPath=(order:Order):Status[]=>{
 const steps:Status[]=order.type==='delivery'?['New','Preparing','Ready','Picked up','Out for delivery','Completed']:order.type==='dine-in'?['New','Preparing','Ready','Completed']:['New','Preparing','Ready','Picked up','Completed'];
 const index=steps.indexOf(order.status);
 return index<0?[]:steps.slice(index+1);
};
export function settleSampleOrders(input:Database,at=new Date()){
 if(input.settings.dataMode!=='sample')throw Error('Mock settlement is limited to the Sample / Test workspace.');
 const d=structuredClone(input);let updated=0,paymentsAdded=0;
 for(const order of d.orders){if(!order.sample||order.status==='Cancelled')continue;
  let changed=false,last=Math.max(at.getTime(),Date.parse(order.statusHistory[order.statusHistory.length-1]?.at||order.createdAt)+1);
  for(const status of completionPath(order)){order.statusHistory.push({status,at:new Date(last++).toISOString()});order.status=status;changed=true}
  const remaining=balance(order),reference=`MOCK-SETTLEMENT-${order.number}`;
  if(remaining>0&&!order.payments.some(p=>p.isTest&&p.reference===reference)){
   const payment:Payment={id:`mock-settlement-${order.id}`,amount:remaining,method:'cash',methodLabel:'Cash · simulated',reference,at:new Date(last++).toISOString(),kind:'payment',isTest:true,tenderedAmount:remaining,changeAmount:0,cashConfirmed:true,custody:'register',locationId:defaultLocationId,businessDate:operatingDate(new Date(last-1),d.settings.timezone,d.settings.businessDayCutoff)};
   order.payments.push(payment);paymentsAdded++;changed=true;
  }
  if(changed)updated++;
 }
 return {data:d,updated,paymentsAdded};
}

export function csvRow(values:(string|number)[]){return values.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')}
export function closeCsv(d:Database,day:BusinessDayRecord,includeTest=false){
 const summary=businessDaySummary(d,day,includeTest),rows=[csvRow(['Business date',day.businessDate,'Timezone',day.timezone,'Test payments included',includeTest?'Yes':'No']),csvRow(['Kind','Ticket / reference','Date / time','Method / category','Receiver / custody','Amount centavos'])];
 for(const {order,p} of summary.payments)rows.push(csvRow([p.isTest?'test payment':p.kind,`${order.number}${p.reference?` · ${p.reference}`:''}`,p.at,p.method,p.receivedByName||p.custody||'',p.kind==='refund'?-p.amount:p.amount]));
 for(const movement of summary.movements)rows.push(csvRow([movement.kind,movement.description,movement.at,movement.category,`${movement.fromCustody} → ${movement.toCustody}` ,movement.amount]));
 for(const [type,total] of Object.entries(summary.salesByType))rows.push(csvRow(['Sales by order type',type,'','','',total]));
 for(const [name,row] of Object.entries(summary.itemTotals))rows.push(csvRow(['Item sales',name,'',`${row.quantity} units`,'',row.amount]));
 for(const [category,total] of Object.entries(summary.outflowsByCategory))rows.push(csvRow(['Cash outflow',category,'','','',total]));
 rows.push(csvRow(['Sales booked','','','','',summary.sales]),csvRow(['Collections','','','','',summary.collections]),csvRow(['Expected register cash','','','','',summary.expectedCash]),csvRow(['Rider cash held','','','','',summary.riderCash]));
 return '\uFEFF'+rows.join('\r\n')+'\r\n';
}
