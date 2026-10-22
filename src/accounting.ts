import { businessDay } from './data';
import type { Database, Order, Payment } from './types';

export interface AccountingRow {ticket:string;orderDate:string;paymentAt:string;type:string;area:string;
 transaction:'sale'|'payment'|'refund';amount:number;method:string;receiver:string;receiverRole:string;reference:string}
export function accounting(data:Database,from:string,to:string) {
 const zone=data.settings.timezone||'Asia/Manila';
 const rows:AccountingRow[]=[];
 let salesBooked=0,paymentsReceived=0,refunds=0,riderCollections=0,otherCollections=0,outstanding=0;
 const riderGroups=new Map<string,number>();
 for(const order of data.orders){
  const orderDate=businessDay(order.createdAt,zone);
  if(order.status!=='Cancelled' && orderDate>=from && orderDate<=to){
   salesBooked+=order.total;rows.push(row(order,orderDate,'','sale',order.total));
  }
  for(const payment of order.payments){
   const paymentDate=businessDay(payment.at,zone);
   if(paymentDate>=from&&paymentDate<=to){
    const signed=payment.kind==='refund'?-payment.amount:payment.amount;
    rows.push(row(order,orderDate,new Date(payment.at).toLocaleString('sv-SE',{timeZone:zone,hour12:false}),payment.kind,signed,payment));
    if(payment.kind==='refund')refunds+=payment.amount;
    else {paymentsReceived+=payment.amount;
     if(payment.receivedByRole==='rider'){
      riderCollections+=payment.amount;
      const key=`${payment.receivedByName||'Rider'} · ${payment.methodLabel||payment.method}`;
      riderGroups.set(key,(riderGroups.get(key)||0)+payment.amount);
     } else otherCollections+=payment.amount;
    }
   }
  }
  if(order.status!=='Cancelled' && orderDate<=to){
   const paid=order.payments.filter(p=>businessDay(p.at,zone)<=to)
    .reduce((sum,p)=>sum+(p.kind==='refund'?-p.amount:p.amount),0);
   outstanding+=Math.max(0,order.total-paid);
  }
 }
 rows.sort((a,b)=>(a.paymentAt||a.orderDate).localeCompare(b.paymentAt||b.orderDate)||a.ticket.localeCompare(b.ticket));
 return {rows,salesBooked,paymentsReceived,refunds,netCollected:paymentsReceived-refunds,riderCollections,
  otherCollections,outstanding,riderGroups:[...riderGroups].sort((a,b)=>a[0].localeCompare(b[0]))};
}
function row(order:Order,orderDate:string,paymentAt:string,transaction:AccountingRow['transaction'],amount:number,p?:Payment):AccountingRow{
 return {ticket:order.number,orderDate,paymentAt,type:order.type,area:order.type==='delivery'?order.deliveryAreaLabel||'':'',
  transaction,amount,method:p?.methodLabel||p?.method||'',receiver:p?.receivedByName|| (p?'Unattributed / legacy':''),
  receiverRole:p?.receivedByRole|| (p?'unattributed':''),reference:p?.reference||''};
}
