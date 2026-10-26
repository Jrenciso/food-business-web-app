import type { Attendance, Database, DeliveryArea, Item, NewOrderDisplaySettings, Order, OrderFieldKey, OrderFieldRules, OrderType, PayBasis, PayrollBatch, PayrollBatchAdjustment, PayrollBatchRow, PayrollRun, RateVersion, Role, TeamMember, WorkShift } from './types';
import { urbanMenu } from './urbanSeed';
import { nextOrderStatuses, orderEditUnavailableReason } from './orderRules';
import { activePaymentMethods, defaultPaymentMethods } from './paymentMethods';
import { canAcceptOrders, cashPayment, currentOperatingDate, dayActionAllowed, defaultLocationId, defaultModules, defaultRegisterId, moduleCatalog, moduleEnabled, modulesFor, openBusinessDay, riderCashHeld } from './operations';
export const uid=()=>crypto.randomUUID();
export const money=(n:number,currency='PHP')=>new Intl.NumberFormat('en-PH',{style:'currency',currency}).format(n/100);
export const quantityPrefix=(quantity:number)=>`${quantity} ×`;
export const quantityItemLabel=(quantity:number,itemName:string)=>`${quantityPrefix(quantity)} ${itemName}`;
export const businessDay=(value:string|Date,timezone='Asia/Manila')=>new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export const dateTime=(value:string,timezone='Asia/Manila')=>new Intl.DateTimeFormat('en-PH',{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export const balance=(o:Order)=>Math.max(0,o.total-collected(o));
export const collected=(o:Order)=>o.payments.length?o.payments.reduce((a,p)=>a+(p.kind==='payment'?p.amount:-p.amount),0):o.paidAmount||0;
export const paymentState=(o:Order)=>{const paid=o.payments.filter(p=>p.kind==='payment').reduce((a,p)=>a+p.amount,0),refunded=o.payments.filter(p=>p.kind==='refund').reduce((a,p)=>a+p.amount,0);return refunded>0&&refunded===paid?'Refunded':collected(o)>=o.total?'Paid':collected(o)>0?'Partially paid':'Unpaid'};
export const can=(role:Role,action:'pos'|'menu'|'settings'|'reports'|'payment'|'cancel'|'prep'|'deliver'|'staff'|'attendance'|'payroll'|'register')=>role==='owner'||action==='register'||(action==='pos'&&(role==='chef'||role==='kitchen'||role==='rider'))||(action==='prep'&&(role==='chef'||role==='kitchen'))||(action==='deliver'&&role==='rider');
export const orderFieldKeys:OrderFieldKey[]=['customer','contact','deliveryArea','address','landmark','rider','dineInReference','notes'];
export const orderFieldLabels:Record<OrderFieldKey,string>={customer:'Customer name',contact:'Mobile / contact number',deliveryArea:'Delivery area',address:'Delivery address',landmark:'Landmark / directions',rider:'Assigned rider',dineInReference:'Table number / dine-in reference',notes:'Order notes / instructions'};
export function defaultOrderFieldRules():OrderFieldRules{
 const common={customer:'required',contact:'optional',deliveryArea:'hidden',address:'hidden',landmark:'hidden',rider:'hidden',dineInReference:'hidden',notes:'optional'} as const;
 return {
  delivery:{...common,contact:'required',deliveryArea:'required',address:'required',landmark:'optional',rider:'required'},
  'take-out':{...common},
  'dine-in':{...common,contact:'hidden',dineInReference:'optional'},
  pickup:{...common},
 };
}
export function defaultNewOrderDisplaySettings():NewOrderDisplaySettings{return {showImages:true,layout:'tiles',tileSize:'standard',enabledOrderTypes:['pickup','take-out','delivery','dine-in'],orderCreationRoles:['owner','chef','kitchen'],fieldRules:defaultOrderFieldRules()}}
export function normalizeNewOrderDisplaySettings(input?:Partial<NewOrderDisplaySettings>|null):NewOrderDisplaySettings{
 const defaults=defaultNewOrderDisplaySettings(),source={...(input||{})} as Partial<NewOrderDisplaySettings>&{defaultOrderType?:unknown};
 // Retire the former single default-order selector without letting the stale
 // property leak back into settings writes from older shared workspaces.
 delete source.defaultOrderType;
 const validTypes=(source.enabledOrderTypes||defaults.enabledOrderTypes).filter((x):x is OrderType=>['pickup','take-out','delivery','dine-in'].includes(x));
 const validRoles=(source.orderCreationRoles||defaults.orderCreationRoles).filter((x):x is Role=>['owner','chef','kitchen','rider'].includes(x));
 const baseRules=defaultOrderFieldRules(),fieldRules={...baseRules} as OrderFieldRules;
 for(const type of ['pickup','take-out','delivery','dine-in'] as OrderType[]){
  const saved=source.fieldRules?.[type];
  for(const key of orderFieldKeys){const rule=saved?.[key];if(rule==='required'||rule==='optional'||rule==='hidden')fieldRules[type][key]=rule}
 }
 // Delivery fulfillment fields are system requirements. Inapplicable fields
 // remain hidden regardless of values supplied by stale clients.
 fieldRules.delivery.deliveryArea='required';fieldRules.delivery.address='required';fieldRules.delivery.rider='required';
 fieldRules['dine-in'].contact='hidden';
 for(const type of ['pickup','take-out','dine-in'] as OrderType[]){fieldRules[type].deliveryArea='hidden';fieldRules[type].address='hidden';fieldRules[type].landmark='hidden';fieldRules[type].rider='hidden'}
 for(const type of ['pickup','take-out','delivery'] as OrderType[])fieldRules[type].dineInReference='hidden';
 return {...defaults,...source,enabledOrderTypes:validTypes.length?validTypes:defaults.enabledOrderTypes,orderCreationRoles:['owner',...validRoles.filter(role=>role!=='owner')],fieldRules};
}
export const canCreateOrders=(role:Role,settings:Database['settings'])=>role==='owner'||normalizeNewOrderDisplaySettings(settings.newOrderDisplay).orderCreationRoles.includes(role);
export function validateNewOrderFields(order:Order,settings:Database['settings']){
 const rules=normalizeNewOrderDisplaySettings(settings.newOrderDisplay).fieldRules[order.type];
 const values:Record<OrderFieldKey,string>={customer:order.customer,contact:order.contact,deliveryArea:order.deliveryAreaId||'',address:order.address,landmark:order.landmark,rider:order.riderId,dineInReference:order.dineInReference||'',notes:order.notes};
 for(const key of orderFieldKeys){const rule=rules[key],value=values[key]?.trim()||'';if(rule==='required'&&!value)throw Error(`${orderFieldLabels[key]} is required for ${order.type==='take-out'?'Take-out':order.type==='dine-in'?'Dine-in':order.type==='pickup'?'Pickup':'Delivery'}.`);if(rule==='hidden'&&value)throw Error(`${orderFieldLabels[key]} must be cleared for this order type.`)}
}
export const rateAt=(employee:TeamMember,date:string):RateVersion|null=>[...employee.rates].filter(r=>r.effectiveDate<=date).sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate)||b.recordedAt.localeCompare(a.recordedAt))[0]||null;
export const monthDays=(date:string)=>{const [y,m]=date.split('-').map(Number);return new Date(y,m,0).getDate()};
export const accrued=(rate:RateVersion|null,date:string)=>{if(!rate)return 0;if(rate.basis==='daily')return rate.amount;const days=monthDays(date),base=Math.floor(rate.amount/days),remainder=rate.amount-base*days;return base+(Number(date.slice(8))<=remainder?1:0)};
export const attendanceCost=(a:Attendance)=>a.worked?accrued(a.rateSnapshot,a.date):0;
export const attendanceTimeError=(worked:boolean,start:string,end:string)=>{
 if(!worked)return '';
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end))return 'Enter valid time in and time out for a worked day.';
 if(end<=start)return 'Time out must be later than time in. Overnight shifts are not supported.';
 return '';
};
export function laborCost(d:Database,from:string,to:string){const base=d.attendance.filter(a=>a.date>=from&&a.date<=to).reduce((n,a)=>n+attendanceCost(a),0);const adjustments=d.adjustments.filter(a=>!a.voidedAt&&a.date>=from&&a.date<=to).reduce((n,a)=>n+a.amount,0);return {base,adjustments,total:base+adjustments}}
export function payrollRun(d:Database,employeeId:string,from:string,to:string):PayrollRun{const e=d.team.find(x=>x.id===employeeId);if(!e)throw Error('Employee not found');const lines=d.attendance.filter(a=>a.employeeId===employeeId&&a.worked&&a.date>=from&&a.date<=to).sort((a,b)=>a.date.localeCompare(b.date)).map(a=>({date:a.date,basis:(a.rateSnapshot?.basis||'daily') as PayBasis,rate:a.rateSnapshot?.amount||0,accrual:attendanceCost(a),start:a.start,end:a.end}));const adjustments=d.adjustments.filter(a=>a.employeeId===employeeId&&a.date>=from&&a.date<=to).map(a=>({date:a.date,amount:a.amount,reason:a.reason,category:a.category||'Manual adjustment'}));return {id:uid(),employeeId,employeeName:e.name,role:e.title||e.role,from,to,generatedAt:new Date().toISOString(),lines,adjustments,gross:lines.reduce((n,l)=>n+l.accrual,0)+adjustments.reduce((n,a)=>n+a.amount,0)}}
export const finalizedRun=(d:Database,employeeId:string,date:string)=>d.payrollRuns.find(r=>r.employeeId===employeeId&&r.from<=date&&r.to>=date);
export const payrollAssignment=(d:Database,employeeId:string,date:string)=>d.payrollBatches?.flatMap(batch=>batch.status==='generated'?batch.rows.map(row=>({batch,row})):[]).find(x=>x.row.employeeId===employeeId&&x.row.lines.some(line=>line.date===date));
export const availablePayrollAdjustments=(d:Database,employeeId:string,from:string,to:string):PayrollBatchAdjustment[]=>d.adjustments.filter(a=>a.employeeId===employeeId&&a.date>=from&&a.date<=to&&!a.batchId&&!a.voidedAt).map(a=>({id:a.id,amount:a.amount,reason:a.reason,category:a.category||'Manual adjustment',date:a.date}));
export function preparePayrollRow(d:Database,employee:TeamMember,from:string,to:string,adjustments:PayrollBatchAdjustment[]=[]):PayrollBatchRow{
 const lines=d.attendance.filter(a=>a.employeeId===employee.id&&a.date>=from&&a.date<=to&&a.worked&&!attendanceTimeError(true,a.start,a.end)&&a.rateSnapshot&&Number.isSafeInteger(a.rateSnapshot.amount)&&a.rateSnapshot.amount>0&&!payrollAssignment(d,employee.id,a.date)).sort((a,b)=>a.date.localeCompare(b.date)).map(a=>({attendanceId:a.id,date:a.date,start:a.start,end:a.end,basis:a.rateSnapshot!.basis,rate:a.rateSnapshot!.amount,accrual:attendanceCost(a),shiftName:a.shiftName}));
 const base=lines.reduce((n,l)=>n+l.accrual,0),additions=adjustments.filter(a=>a.amount>0).reduce((n,a)=>n+a.amount,0),deductions=adjustments.filter(a=>a.amount<0).reduce((n,a)=>n-a.amount,0);
 return {employeeId:employee.id,employeeName:employee.name,role:employee.title||employee.role,lines,adjustments,base,additions,deductions,net:base+additions-deductions,payment:null};
}
function migratePayrollRuns(d:Database):PayrollBatch[]{
 const groups=new Map<string,PayrollRun[]>();
 for(const run of d.payrollRuns){const key=`${run.from}|${run.to}`;groups.set(key,[...(groups.get(key)||[]),run])}
 return [...groups.values()].map((runs,index)=>({id:`legacy-payroll-${index+1}`,number:`Legacy ${index+1}`,from:runs[0].from,to:runs[0].to,createdAt:runs[0].generatedAt,status:'generated' as const,origin:'legacy' as const,rows:runs.map(run=>{
  const adjustments:PayrollBatchAdjustment[]=run.adjustments.map((a,i)=>{const original=d.adjustments.find(x=>x.employeeId===run.employeeId&&x.date===a.date&&x.amount===a.amount&&x.reason===a.reason);if(original)original.batchId=`legacy-payroll-${index+1}`;return {id:original?.id||`legacy-adjustment-${run.id}-${i}`,date:a.date,amount:a.amount,reason:a.reason,category:a.category||'Manual adjustment'}});
  const lines=run.lines.map((line,i)=>({attendanceId:d.attendance.find(a=>a.employeeId===run.employeeId&&a.date===line.date)?.id||`legacy-line-${run.id}-${i}`,date:line.date,start:line.start||'',end:line.end||'',basis:line.basis,rate:line.rate,accrual:line.accrual}));
  const base=lines.reduce((n,l)=>n+l.accrual,0),additions=adjustments.filter(a=>a.amount>0).reduce((n,a)=>n+a.amount,0),deductions=adjustments.filter(a=>a.amount<0).reduce((n,a)=>n-a.amount,0);
  return {employeeId:run.employeeId,employeeName:run.employeeName,role:run.role,lines,adjustments,base,additions,deductions,net:run.gross,payment:null};
 })}));
}
export const deliveryAreaSeed=():DeliveryArea[]=>[
 ['sonoma','Sonoma',8000],['amaia','Amaia / Phirst Park Pandi',9000],['brighthomes','Brighthomes / Primeville / EPDR / Calle, Malabon / Caysio Pabahay / Caypombo',4000],['pintong','Pintong Bato / Malawak / Sunrays / Villa Corazon',4000],['msapa','M. Sapa',6000]
].map(([id,label,fee],order)=>({id:String(id),label:String(label),fee:Number(fee),aliases:'',notes:'',active:true,order}));
export const workShiftSeed=():WorkShift[]=>[['opening','Opening','08:30','16:30'],['kitchen','Kitchen','09:00','17:00'],['midday','Midday','10:00','18:00'],['rider','Rider','11:00','19:00'],['afternoon','Afternoon','13:00','22:00']].map(([id,name,start,end],order)=>({id,name,start,end,active:true,order}));
export function seed():Database{const menu=urbanMenu(),today=businessDay(new Date());const team:TeamMember[]=[['owner1','Alex Reyes','owner',0,'monthly'],['chef1','Sam Dela Cruz','chef',90000,'daily'],['kitchen1','Jo Lim','kitchen',65000,'daily'],['rider1','Nico Ramos','rider',55000,'daily']].map(([id,name,role,amount,basis])=>({id:String(id),name:String(name),contact:'',role:role as Role,title:'',active:true,activeFrom:today,activeTo:'',notes:'',rates:[{id:uid(),amount:Number(amount),basis:basis as PayBasis,effectiveDate:today,recordedAt:new Date().toISOString()}]}));return {...menu,items:menu.items.map((i,n)=>({...i,order:i.order??n,favorite:false})),orders:[],team,attendance:[],adjustments:[],payrollRuns:[],payrollBatches:[],payrollDraft:null,manualPayrollEntries:[],deliveryAreas:deliveryAreaSeed(),workShifts:workShiftSeed(),activity:[],locations:[{id:defaultLocationId,name:'Main location'}],registers:[{id:defaultRegisterId,locationId:defaultLocationId,name:'Main register'}],businessDays:[],cashMovements:[],settings:{businessName:'Urban Casero',tagline:'One-Stop Snackshop',logo:'',phone:'',address:'',currency:'PHP',timezone:'Asia/Manila',businessDayCutoff:'00:00',footer:'Thank you for ordering!',defaultDeliveryFee:4500,accent:'#be7934',theme:'light',activeUserId:'owner1',dataMode:'sample',tileSizes:{},newOrderDisplay:defaultNewOrderDisplaySettings(),payrollSchedule:'weekly',payrollCutoff:15,paymentMethods:defaultPaymentMethods(),modules:defaultModules(),dayControlRoles:[],cashVarianceThreshold:50000},nextTicket:1001}}
export function archiveSampleLabor(d:Database){if(!d.attendance.length&&!d.adjustments.length&&!d.payrollRuns.length&&!d.payrollBatches?.length)return;d.sampleLaborArchive=[...(d.sampleLaborArchive||[]),{at:new Date().toISOString(),attendance:d.attendance,adjustments:d.adjustments,payrollRuns:d.payrollRuns,payrollBatches:d.payrollBatches||[]}];d.attendance=[];d.adjustments=[];d.payrollRuns=[];d.payrollBatches=[];d.payrollDraft=null}
const LEGACY_KEY='urban-ops-v1',OLD_KEY='salo-counter-v2',workspaceKey=(w:'sample'|'live')=>`urban-ops-workspace-${w}-v1`;
export const activeWorkspace=()=>localStorage.getItem('urban-ops-active-workspace')==='live'?'live' as const:'sample' as const;
export const setActiveWorkspace=(w:'sample'|'live')=>localStorage.setItem('urban-ops-active-workspace',w);
export const sortedItems=(items:Item[],categories:{id:string;order:number}[])=>[...items].sort((a,b)=>(categories.find(c=>c.id===a.categoryId)?.order??999)-(categories.find(c=>c.id===b.categoryId)?.order??999)||Number(!!b.favorite)-Number(!!a.favorite)||(a.order??items.indexOf(a))-(b.order??items.indexOf(b))||a.name.localeCompare(b.name));
const validStatusAdvance=(before:Order,after:Order)=>{
 const previous=before.statusHistory[before.statusHistory.length-1],latest=after.statusHistory[after.statusHistory.length-1];
 return after.statusHistory.length===before.statusHistory.length+1&&
  JSON.stringify(after.statusHistory.slice(0,-1))===JSON.stringify(before.statusHistory)&&
  latest?.status===after.status&&
  (!previous||Date.parse(latest.at)>Date.parse(previous.at));
};
function validateOperationalMutation(before:Database,after:Database,actor:TeamMember,action:Parameters<typeof can>[1]){
 if(action==='register'){
  if(!moduleEnabled(before,'register')||!dayActionAllowed(before,actor.role))throw Error('Register actions are not available to this role.');
  const outside=(d:Database)=>JSON.stringify({...d,businessDays:[],cashMovements:[],activity:[]});
  if(outside(before)!==outside(after))throw Error('Register action changed unrelated records.');
  const oldDays=before.businessDays||[],newDays=after.businessDays||[],oldMoves=before.cashMovements||[],newMoves=after.cashMovements||[];
  if(newDays.length<oldDays.length||newDays.length>oldDays.length+1||newMoves.length<oldMoves.length||newMoves.length>oldMoves.length+1||JSON.stringify(newMoves.slice(0,oldMoves.length))!==JSON.stringify(oldMoves))throw Error('Register history is append-only.');
  for(const oldDay of oldDays){const next=newDays.find(x=>x.id===oldDay.id);if(!next||next.businessDate!==oldDay.businessDate||next.openedAt!==oldDay.openedAt||next.openedById!==oldDay.openedById||JSON.stringify(next.closeSnapshots.slice(0,oldDay.closeSnapshots.length))!==JSON.stringify(oldDay.closeSnapshots)||next.closeSnapshots.length>oldDay.closeSnapshots.length+1)throw Error('Saved business-day history cannot be changed.');if(oldDay.state==='closed'&&next.state!==oldDay.state)throw Error('Closed days stay closed; add an owner correction snapshot.');}
  if(newDays.length>oldDays.length){const next=newDays[newDays.length-1]!;if(openBusinessDay(before)||next.state!=='accepting'||next.businessDate!==currentOperatingDate(before)||newDays.slice(0,-1).some(x=>x.businessDate===next.businessDate)&&(!next.reopenedFromId||actor.role!=='owner'||!next.reopenReason?.trim()||!newDays.slice(0,-1).some(x=>x.id===next.reopenedFromId&&x.state==='closed')))throw Error('Open one business day for the current date.');if(!Number.isSafeInteger(next.openingFloat||0)||next.openingFloat!<0)throw Error('Opening float must be zero or more.');}
  if(newMoves.length>oldMoves.length){const movement=newMoves[newMoves.length-1]!;if(!openBusinessDay(before)||!Number.isSafeInteger(movement.amount)||movement.amount<=0||!movement.category.trim()||!movement.description.trim()||movement.fromCustody===movement.toCustody||movement.actorId!==actor.id)throw Error('Enter a valid cash movement for an open day.');if(movement.kind==='cash-in'&&/^(sale|customer payment)$/i.test(movement.category))throw Error('Customer payments are recorded on tickets, not as cash in.');if(movement.kind==='rider-handover'&&(!movement.riderId||movement.fromCustody!=='rider'||movement.amount>riderCashHeld(before,movement.riderId)))throw Error('Rider handover exceeds cash held by that rider.');}
  return;
 }
 if(action==='attendance'&&!moduleEnabled(before,'attendance'))throw Error('Attendance is turned off in Settings.');
 if(action==='payroll'&&!moduleEnabled(before,'payroll'))throw Error('Payroll is turned off in Settings.');
 if(action==='attendance'){
  for(const original of before.attendance)if(!after.attendance.some(a=>a.id===original.id))throw Error('Attendance history cannot be deleted.');
  const keys=new Set<string>();
  for(const record of after.attendance){
   const key=`${record.employeeId}|${record.date}`;
   if(keys.has(key))throw Error('An attendance record already exists for this employee and date.');
   keys.add(key);
   const previous=before.attendance.find(a=>a.id===record.id);
   if(!previous||JSON.stringify(previous)!==JSON.stringify(record)){
    const error=attendanceTimeError(record.worked,record.start,record.end);
    if(error)throw Error(error);
    if(record.worked&&!record.rateSnapshot&&!previous)throw Error('A pay rate is required for a new worked day.');
    if(record.worked&&record.shiftId&&(!previous||previous.shiftId!==record.shiftId||previous.start!==record.start||previous.end!==record.end)){
     const shift=after.workShifts?.find(s=>s.id===record.shiftId&&s.active);
     if(!shift||shift.name!==record.shiftName||shift.start!==record.start||shift.end!==record.end)throw Error('Choose an active work shift for this log.');
    }
    if(payrollAssignment(before,record.employeeId,record.date))throw Error('This work date is in a payroll batch. Void the unpaid batch before correcting attendance.');
   }
  }
 }
 if(action==='payroll'&&!moduleEnabled(before,'attendance')){
  const oldEntries=before.manualPayrollEntries||[],entries=after.manualPayrollEntries||[];
  const outside=(d:Database)=>JSON.stringify({...d,manualPayrollEntries:[],cashMovements:[],activity:[]});
  if(actor.role!=='owner'||outside(before)!==outside(after)||entries.length!==oldEntries.length+1||JSON.stringify(entries.slice(0,-1))!==JSON.stringify(oldEntries))throw Error('Manual payroll records are append-only and owner-only.');
  const entry=entries[entries.length-1];if(!entry||!before.team.some(t=>t.id===entry.employeeId&&t.active)||!Number.isSafeInteger(entry.amount)||entry.amount<=0||entry.from>entry.to||!activePaymentMethods(before.settings).some(m=>m.id===entry.method)||entry.actorId!==actor.id)throw Error('Enter a valid manual payroll payment.');
  const oldMoves=before.cashMovements||[],newMoves=after.cashMovements||[],cashFromRegister=entry.method==='cash'&&moduleEnabled(before,'register');
  if(newMoves.length!==oldMoves.length+(cashFromRegister?1:0)||JSON.stringify(newMoves.slice(0,oldMoves.length))!==JSON.stringify(oldMoves))throw Error('Payroll cash must create exactly one linked drawer movement.');
  if(cashFromRegister){const day=openBusinessDay(before),movement=newMoves[newMoves.length-1];if(!day||!movement||movement.id!==`payroll-${entry.id}`||movement.amount!==entry.amount||movement.kind!=='cash-out'||movement.category!=='Payroll'||movement.fromCustody!=='register'||movement.registerSessionId!==day.registerSessionId)throw Error('Payroll drawer movement is invalid.');}
  return;
 }
 if(action==='payroll'){
  const oldBatches=before.payrollBatches||[],newBatches=after.payrollBatches||[];
  for(const old of oldBatches){
   const current=newBatches.find(b=>b.id===old.id);
   if(!current)throw Error('Payroll history cannot be deleted.');
   const withoutPayment=(batch:PayrollBatch)=>JSON.stringify({...batch,rows:batch.rows.map(row=>({...row,payment:null,paymentHistory:undefined})),status:undefined,voidedAt:undefined});
   if(withoutPayment(old)!==withoutPayment(current))throw Error('Generated payroll calculations cannot be edited.');
   if(old.status==='void'&&JSON.stringify(old)!==JSON.stringify(current))throw Error('Voided payroll batches cannot be changed.');
   if(current.status==='void'){
    if(old.rows.some(row=>row.payment))throw Error('A paid payroll batch cannot be voided.');
    if(!current.voidedAt)throw Error('Voided payroll batch needs a timestamp.');
   }else if(current.status!==old.status)throw Error('Invalid payroll batch status.');
   for(const oldRow of old.rows){
    const row=current.rows.find(r=>r.employeeId===oldRow.employeeId);
    if(!row)throw Error('Payroll employee row is missing.');
    const oldHistory=oldRow.paymentHistory||[],newHistory=row.paymentHistory||[];
    if(oldRow.payment&&!row.payment){if(newHistory.length!==oldHistory.length+1||JSON.stringify(newHistory.slice(0,-1))!==JSON.stringify(oldHistory)||JSON.stringify(newHistory[newHistory.length-1])!==JSON.stringify(oldRow.payment))throw Error('A payment correction must retain the prior payment record.');}
    else if(oldRow.payment&&JSON.stringify(oldRow.payment)!==JSON.stringify(row.payment))throw Error('Recorded payroll payments cannot be changed or repeated.');
    else if(JSON.stringify(oldHistory)!==JSON.stringify(newHistory))throw Error('Payroll payment history cannot be changed.');
    if(!oldRow.payment&&row.payment){
     if(current.status!=='generated'||row.net<0||row.payment.amount!==row.net||!Number.isFinite(Date.parse(row.payment.at))||!/^\d{4}-\d{2}-\d{2}$/.test(row.payment.date)||!Number.isFinite(Date.parse(`${row.payment.date}T12:00:00Z`)))throw Error('Invalid payroll payment.');
     if(row.payment.method&&!activePaymentMethods(after.settings).some(m=>m.id===row.payment!.method&&m.label===row.payment!.methodLabel))throw Error('Choose an enabled payroll payment method.');
    }
   }
  }
  const allocated=new Map<string,PayrollBatch>();
  for(const batch of newBatches.filter(b=>b.status==='generated')){
   if(batch.from>batch.to||!batch.rows.length)throw Error('Payroll batch needs a valid period and employees.');
   const employeeIds=new Set<string>();
   for(const row of batch.rows){
    if(employeeIds.has(row.employeeId))throw Error('An employee appears twice in the payroll batch.');
    employeeIds.add(row.employeeId);
    if(!row.lines.length&&!oldBatches.some(b=>b.id===batch.id))throw Error('Payroll employee needs eligible worked time logs.');
    for(const line of row.lines){
     const key=`${row.employeeId}|${line.date}`;
     const previous=allocated.get(key);
     if(previous&&!(previous.origin==='legacy'&&batch.origin==='legacy'))throw Error('A work date is already assigned to a payroll batch.');
     allocated.set(key,batch);
     if(!oldBatches.some(b=>b.id===batch.id)){
      const attendance=after.attendance.find(a=>a.employeeId===row.employeeId&&a.date===line.date&&a.id===line.attendanceId);
      if(!attendance?.worked||attendanceTimeError(true,attendance.start,attendance.end)||!attendance.rateSnapshot||line.date<batch.from||line.date>batch.to||line.accrual!==attendanceCost(attendance)||line.rate!==attendance.rateSnapshot.amount||line.basis!==attendance.rateSnapshot.basis||line.start!==attendance.start||line.end!==attendance.end||line.shiftName!==attendance.shiftName)throw Error('Payroll batch contains an invalid time log.');
     }
    }
    const base=row.lines.reduce((n,l)=>n+l.accrual,0),additions=row.adjustments.filter(a=>a.amount>0).reduce((n,a)=>n+a.amount,0),deductions=row.adjustments.filter(a=>a.amount<0).reduce((n,a)=>n-a.amount,0);
    if(!oldBatches.some(b=>b.id===batch.id)&&(base!==row.base||additions!==row.additions||deductions!==row.deductions||row.net!==base+additions-deductions||row.net<0))throw Error('Payroll batch totals do not match employee rows.');
    if(!oldBatches.some(b=>b.id===batch.id))for(const adjustment of row.adjustments){const record=after.adjustments.find(a=>a.id===adjustment.id&&a.employeeId===row.employeeId);if(!record||record.batchId!==batch.id||record.amount!==adjustment.amount||record.date!==adjustment.date||record.reason!==adjustment.reason)throw Error('Payroll adjustment does not match the batch.');}
    if(!oldBatches.some(b=>b.id===batch.id)&&row.payment)throw Error('A new payroll batch must start unpaid.');
   }
  }
  const runKeys=new Set<string>();
  for(const original of before.payrollRuns){const current=after.payrollRuns.find(r=>r.id===original.id);if(!current||JSON.stringify(current)!==JSON.stringify(original))throw Error('Saved payroll snapshots cannot be changed or deleted.');}
  for(const run of after.payrollRuns){
   const key=`${run.employeeId}|${run.from}|${run.to}`;
   if(runKeys.has(key))throw Error('A payroll snapshot already exists for this employee and period.');
   runKeys.add(key);
   if(!before.payrollRuns.some(r=>r.id===run.id)){
    if(run.from>run.to)throw Error('Invalid payroll period.');
    const computed=payrollRun(after,run.employeeId,run.from,run.to);
    if(JSON.stringify({lines:run.lines,adjustments:run.adjustments,gross:run.gross})!==JSON.stringify({lines:computed.lines,adjustments:computed.adjustments,gross:computed.gross}))throw Error('Payroll snapshot does not match current attendance and adjustments.');
   }
  }
  for(const old of before.adjustments){
   const current=after.adjustments.find(a=>a.id===old.id);
   if((!current||JSON.stringify(current)!==JSON.stringify(old))&&payrollAssignment(before,old.employeeId,old.date)&&!newBatches.find(b=>b.id===payrollAssignment(before,old.employeeId,old.date)?.batch.id&&b.status==='void'))throw Error('This adjustment is included in an active payroll batch and cannot be changed.');
  }
  for(const adjustment of after.adjustments){
   const old=before.adjustments.find(a=>a.id===adjustment.id);
   if((!old||JSON.stringify(old)!==JSON.stringify(adjustment))&&payrollAssignment(before,adjustment.employeeId,adjustment.date)&&!newBatches.find(b=>b.id===payrollAssignment(before,adjustment.employeeId,adjustment.date)?.batch.id&&b.status==='void'))throw Error('This date belongs to an active payroll batch.');
   if(!Number.isSafeInteger(adjustment.amount)||!adjustment.amount||!adjustment.reason.trim()||!adjustment.date)throw Error('Adjustment requires a valid nonzero amount, date, and reason.');
  }
 }
 if(action==='settings'){
  if(JSON.stringify(modulesFor(after))!==JSON.stringify(after.settings.modules)||moduleCatalog.some(module=>typeof after.settings.modules?.[module.id]!=='boolean'))throw Error('Choose a valid setting for every module.');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(after.settings.businessDayCutoff||'00:00')||!Number.isSafeInteger(after.settings.cashVarianceThreshold||0)||after.settings.cashVarianceThreshold!<0)throw Error('Choose a valid business-day cutoff and cash variance threshold.');
  if((after.settings.dayControlRoles||[]).some(role=>!['chef','kitchen','rider'].includes(role)))throw Error('Choose valid roles for business-day controls.');
  const raw=after.settings.newOrderDisplay;
  if(!raw||!Array.isArray(raw.orderCreationRoles)||!raw.orderCreationRoles.includes('owner'))throw Error('Owner order access must remain enabled.');
  for(const type of ['pickup','take-out','delivery','dine-in'] as OrderType[]){const rules=raw.fieldRules?.[type];if(!rules)throw Error('Order field settings are incomplete.');for(const key of orderFieldKeys)if(!['required','optional','hidden'].includes(rules[key]))throw Error('Choose Required, Optional, or Hidden for every order field.');}
  if(raw.fieldRules.delivery.deliveryArea!=='required'||raw.fieldRules.delivery.address!=='required'||raw.fieldRules.delivery.rider!=='required')throw Error('Delivery area, address, and assigned rider are required system fields.');
  if(raw.fieldRules['dine-in'].contact!=='hidden')throw Error('Dine-in orders do not collect a contact number.');
  const supportedTypes:OrderType[]=['pickup','take-out','delivery','dine-in'],supportedRoles:Role[]=['owner','chef','kitchen','rider'];
  if(typeof raw.showImages!=='boolean'||!['tiles','list'].includes(raw.layout)||!['compact','standard','large'].includes(raw.tileSize)||
   !Array.isArray(raw.enabledOrderTypes)||!raw.enabledOrderTypes.length||raw.enabledOrderTypes.some(type=>!supportedTypes.includes(type))||new Set(raw.enabledOrderTypes).size!==raw.enabledOrderTypes.length||
   raw.orderCreationRoles.some(role=>!supportedRoles.includes(role))||new Set(raw.orderCreationRoles).size!==raw.orderCreationRoles.length||
   Object.keys(raw.fieldRules).length!==supportedTypes.length||supportedTypes.some(type=>!raw.fieldRules[type]||Object.keys(raw.fieldRules[type]).length!==orderFieldKeys.length))
   throw Error('New order settings contain unsupported roles, types, or field rules.');
  const methods=after.settings.paymentMethods||[],methodIds=new Set<string>(),methodLabels=new Set<string>();
  for(const original of before.settings.paymentMethods||[])if(!methods.some(m=>m.id===original.id))throw Error('Disable a payment method instead of deleting it.');
  for(const method of methods){const label=method.label.trim().toLowerCase();if(!method.id||!label||methodIds.has(method.id)||methodLabels.has(label)||!Number.isSafeInteger(method.order))throw Error('Payment methods need unique names and valid order.');methodIds.add(method.id);methodLabels.add(label)}
  const shifts=after.workShifts||[],ids=new Set<string>(),names=new Set<string>();
  for(const old of before.workShifts||[])if(!shifts.some(s=>s.id===old.id))throw Error('Deactivate a work shift instead of deleting it.');
  for(const shift of shifts){const name=shift.name.trim().toLowerCase();if(!name||ids.has(shift.id)||names.has(name)||attendanceTimeError(true,shift.start,shift.end)||!Number.isSafeInteger(shift.order))throw Error('Each work shift needs a unique name and valid same-day hours.');ids.add(shift.id);names.add(name)}
  if(!['weekly','twice-monthly','monthly'].includes(after.settings.payrollSchedule||'weekly')||!Number.isInteger(after.settings.payrollCutoff)||after.settings.payrollCutoff!<1||after.settings.payrollCutoff!>27)throw Error('Choose a valid payroll schedule and cut-off day.');
 }
 if(action==='pos'){
  if(after.orders.length>before.orders.length&&!canAcceptOrders(before))throw Error('New orders are stopped. Open or resume the current business day in Register.');
  for(const original of before.orders){
   const current=after.orders.find(o=>o.id===original.id);
   if(!current||JSON.stringify(current)!==JSON.stringify(original)){
    const reason=orderEditUnavailableReason(original);
    if(reason)throw Error(reason);
   }
  if(actor.role!=='owner'){
   const added=after.orders.filter(o=>!before.orders.some(x=>x.id===o.id));
   if(after.orders.length!==before.orders.length+1||added.length!==1||before.orders.some(o=>JSON.stringify(after.orders.find(x=>x.id===o.id))!==JSON.stringify(o)))throw Error('Staff may create one new ticket at a time.');
   const enabled=after.settings.newOrderDisplay?.enabledOrderTypes||['pickup','take-out','delivery','dine-in'];
   if(!canCreateOrders(actor.role,after.settings))throw Error('Your role is not allowed to create new orders. Ask the owner to enable this access in Settings.');
   if(!enabled.includes(added[0].type))throw Error('This order type is disabled in New order settings.');
   if(added[0].status!=='New'||added[0].payments.length||added[0].sample)throw Error('Staff tickets must start new, unpaid, and live.');
   validateNewOrderFields(added[0],after.settings);
   if(actor.role==='rider'&&added[0].type==='delivery'&&added[0].riderId!==actor.id)throw Error('Rider-created deliveries must be assigned to the signed-in rider.');
   return;
  }
  for(const original of before.orders){const current=after.orders.find(o=>o.id===original.id);if(current&&JSON.stringify(current)!==JSON.stringify(original)&&current.type!==original.type)validateNewOrderFields(current,after.settings)}
  for(const order of after.orders.filter(o=>!before.orders.some(x=>x.id===o.id)))validateNewOrderFields(order,after.settings);
  }
 }
 if(action==='payment')for(const original of before.orders){const current=after.orders.find(o=>o.id===original.id);if(!current)throw Error('Order payment history cannot be deleted.');if(JSON.stringify(current.payments.slice(0,original.payments.length))!==JSON.stringify(original.payments))throw Error('Existing payment records cannot be changed.');for(const payment of current.payments.slice(original.payments.length)){if(payment.kind==='payment'&&!activePaymentMethods(after.settings).some(m=>m.id===payment.method&&m.label===payment.methodLabel))throw Error('Choose an enabled payment method.');if(payment.isTest&&after.settings.dataMode!=='sample')throw Error('Mock payments cannot be recorded in this workspace.');if(payment.kind==='payment'&&payment.method==='cash'){const result=cashPayment(balance(original),payment.tenderedAmount||0);if(!payment.cashConfirmed||result.applied!==payment.amount||result.change!==payment.changeAmount||payment.custody!=='register')throw Error('Confirm the cash received and change returned.')}else if(payment.kind==='payment'&&(payment.tenderedAmount!==undefined||payment.changeAmount!==undefined||payment.cashConfirmed))throw Error('Non-cash payments cannot have tender or change.');}}
 if(actor.role==='owner'){
  if(action==='cancel')for(const original of before.orders){
   const current=after.orders.find(o=>o.id===original.id);
   if(!current)continue;
   if(current.status!==original.status&&(!nextOrderStatuses(original,actor.role,actor.id).includes(current.status)||!validStatusAdvance(original,current)))throw Error('Invalid order status transition');
   if(current.status===original.status&&JSON.stringify(current.statusHistory)!==JSON.stringify(original.statusHistory))throw Error('Status history cannot change without a status transition');
  }
  return;
 }
 if(action!=='prep'&&action!=='deliver')throw Error('Role is not allowed to perform this action');
 const nonOrders=(d:Database)=>JSON.stringify({...d,orders:[],activity:[]});
 if(nonOrders(before)!==nonOrders(after)||before.orders.length!==after.orders.length)throw Error('Role is not allowed to change these records');
 let changed=0;
 for(const original of before.orders){
  const current=after.orders.find(o=>o.id===original.id);
  if(!current)throw Error('Role is not allowed to change these records');
  if(JSON.stringify(current)===JSON.stringify(original))continue;
  changed++;
  if(!nextOrderStatuses(original,actor.role,actor.id).includes(current.status)||!validStatusAdvance(original,current))throw Error('Role is not allowed to make this status change');
  const aside=(o:Order)=>JSON.stringify({...o,status:undefined,statusHistory:undefined});
  if(aside(original)!==aside(current))throw Error('Role is not allowed to edit ticket details');
 }
 if(changed!==1)throw Error('Role is not allowed to change these records');
}
export const db={load(workspace:'sample'|'live'=activeWorkspace()):Database{
 let raw=localStorage.getItem(workspaceKey(workspace));
 let fresh:Database;
 if(!raw&&workspace==='sample'){
  const legacy=localStorage.getItem(LEGACY_KEY);
  if(legacy){try{
   const prior=JSON.parse(legacy) as Database;
   const sampleOrders=[...(prior.sampleOrderArchive||[]),...prior.orders.filter(o=>o.sample)];
   const liveOrders=prior.orders.filter(o=>!o.sample);
   if(liveOrders.length&&!localStorage.getItem(workspaceKey('live'))){
    const live=structuredClone(prior);
    live.orders=liveOrders;live.activity=[];live.settings.dataMode='live';
    localStorage.setItem(workspaceKey('live'),JSON.stringify(live));
   }
   prior.orders=[...new Map(sampleOrders.map(o=>[o.id,o])).values()];
   if(prior.settings.dataMode==='live'){
    const labor=prior.sampleLaborArchive?.[prior.sampleLaborArchive.length-1];
    prior.attendance=labor?.attendance||[];prior.adjustments=labor?.adjustments||[];prior.payrollRuns=labor?.payrollRuns||[];prior.payrollBatches=labor?.payrollBatches;
   }
   prior.activity=[];prior.settings.dataMode='sample';
   fresh=prior;
  }catch{fresh=seed()}}else fresh=seed();
  try{const old=localStorage.getItem(OLD_KEY);if(old&&!fresh.legacyDemoArchive)fresh.legacyDemoArchive=JSON.parse(old)}catch{}
 }else{
  try{fresh=raw?JSON.parse(raw):seed()}catch{fresh=seed()}
  if(!raw&&workspace==='live')fresh={...fresh,orders:[],attendance:[],adjustments:[],payrollRuns:[],payrollBatches:[],payrollDraft:null,activity:[],nextTicket:1001};
 }
 fresh.deliveryAreas??=deliveryAreaSeed();fresh.activity??=[];
 fresh.workShifts??=workShiftSeed();
 fresh.payrollBatches??=migratePayrollRuns(fresh);
 fresh.payrollDraft??=null;fresh.manualPayrollEntries??=[];
 fresh.items=fresh.items.map((i,n)=>({...i,order:i.order??n,favorite:i.favorite??false}));
 fresh.settings.tileSizes??={};fresh.settings.newOrderDisplay=normalizeNewOrderDisplaySettings(fresh.settings.newOrderDisplay);delete (fresh.settings.newOrderDisplay as unknown as Record<string,unknown>).defaultOrderType;fresh.settings.payrollSchedule??='weekly';fresh.settings.payrollCutoff??=15;fresh.settings.paymentMethods??=defaultPaymentMethods();fresh.settings.modules={...defaultModules(),...fresh.settings.modules};fresh.settings.businessDayCutoff??='00:00';fresh.settings.dayControlRoles??=[];fresh.settings.cashVarianceThreshold??=50000;fresh.locations??=[{id:defaultLocationId,name:'Main location'}];fresh.registers??=[{id:defaultRegisterId,locationId:defaultLocationId,name:'Main register'}];fresh.businessDays??=[];fresh.cashMovements??=[];fresh.settings.dataMode=workspace;
 this.save(fresh);return fresh
},save(data:Database){localStorage.setItem(workspaceKey(data.settings.dataMode),JSON.stringify(data))},prepareMutation(data:Database,role:Role,action:Parameters<typeof can>[1],fn:(draft:Database)=>void,actor:TeamMember){if(!can(role,action)){throw Error('Role is not allowed to perform this action')}if(action==='pos'&&!canCreateOrders(role,data.settings))throw Error('Your role is not allowed to create new orders. Ask the owner to enable this access in Settings.');const draft=structuredClone(data);fn(draft);validateOperationalMutation(data,draft,actor,action);return draft},mutate(data:Database,role:Role,action:Parameters<typeof can>[1],fn:(draft:Database)=>void,actor:TeamMember){const draft=this.prepareMutation(data,role,action,fn,actor);this.save(draft);return draft},resetSampleMenu(data:Database){const draft=structuredClone(data);const menu=urbanMenu();draft.categories=menu.categories;draft.items=menu.items;this.save(draft);return draft},clearSampleOrders(data:Database){const draft=structuredClone(data);draft.orders=draft.orders.filter(o=>!o.sample);this.save(draft);return draft}};

