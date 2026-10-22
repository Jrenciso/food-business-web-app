import type { Database, Order, OrderType, Status } from './types';
import { wingFlavors } from './urbanSeed';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const supportedTypes:OrderType[] = ['pickup','take-out','delivery','dine-in'];
const popularNames = ['Crispy Pata','Urban Casero Signature Ribs','Sinigang na Liempo','Chicken Inasal (Petso)','Cream of Spinach'];
const firstNames = ['TEST-Mia','TEST-Juan','TEST-Alex','TEST-Sam','TEST-Jo','TEST-Nico','TEST-Lea','TEST-Rafi','TEST-Kai','TEST-Toni'];
const lastNames = ['Sample','Demo','Fixture','Preview','Example','Sandbox'];
const flavorLineNotes = ['Sauce on the side','Less spicy','Pack separately','No garnish','Serve together'];

function hashSeed(value:string){
  let hash=2166136261;
  for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619)}
  return hash>>>0;
}
function randomFor(seed:string,index:number){
  let state=(hashSeed(seed)+Math.imul(index+1,0x9e3779b1))>>>0;
  return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296};
}
function int(rng:()=>number,min:number,max:number){return min+Math.floor(rng()*(max-min+1))}
function pick<T>(rng:()=>number,values:T[]):T{return values[Math.floor(rng()*values.length)]}
function orderPath(type:OrderType,seededIndex:number,rng:()=>number):Status[]{
  if(seededIndex%29===0){
    const beforeCancel=pick(rng,['New','Preparing','Ready'] as const);
    return beforeCancel==='New'?['New','Cancelled']:beforeCancel==='Preparing'?['New','Preparing','Cancelled']:['New','Preparing','Ready','Cancelled'];
  }
  if(type==='dine-in'){
    const paths:Status[][]=[['New'],['New','Preparing'],['New','Preparing','Ready'],['New','Preparing','Ready','Completed']];
    return [...pick(rng,paths)];
  }
  if(type==='delivery'){
    const paths:Status[][]=[['New'],['New','Preparing'],['New','Preparing','Ready'],['New','Preparing','Ready','Picked up'],['New','Preparing','Ready','Picked up','Out for delivery'],['New','Preparing','Ready','Picked up','Out for delivery','Completed']];
    return [...pick(rng,paths)];
  }
  const paths:Status[][]=[['New'],['New','Preparing'],['New','Preparing','Ready'],['New','Preparing','Ready','Picked up'],['New','Preparing','Ready','Picked up','Completed']];
  return [...pick(rng,paths)];
}

export function enabledFixtureTypes(data:Database):OrderType[]{
  const enabled=data.settings.newOrderDisplay?.enabledOrderTypes||supportedTypes;
  const types=supportedTypes.filter(type=>enabled.includes(type));
  return types.filter(type=>type!=='delivery'||(data.deliveryAreas.some(area=>area.active)&&data.team.some(member=>member.active&&member.role==='rider')));
}

export function makeBulkTestOrder(data:Database,index:number,seed:string,firstTicket:number,generationId:string,nowMs:number):Order{
  const rng=randomFor(seed,index);
  const types=enabledFixtureTypes(data);
  if(!types.length)throw Error('Enable at least one order type with an active delivery area and rider, if using Delivery.');
  const type=types[(index+int(rng,0,types.length-1))%types.length];
  const orderId=`bulk-test-${generationId}-${index+1}`;
  const createdMs=nowMs-(6*HOUR+int(rng,0,30*DAY-6*HOUR));
  const createdAt=new Date(createdMs).toISOString();
  const dateSuffix=new Date(createdMs).toISOString().slice(0,10).replaceAll('-','');
  const baseItems=data.items.filter(item=>item.available&&Number.isSafeInteger(item.price)&&item.price>=0);
  const popular=baseItems.filter(item=>popularNames.includes(item.name));
  if(!baseItems.length)throw Error('Add an available menu item before generating test orders.');
  const areas=data.deliveryAreas.filter(area=>area.active);
  const riders=data.team.filter(member=>member.active&&member.role==='rider');
  const selectedArea=type==='delivery'?pick(rng,areas):undefined;
  const rider=type==='delivery'?pick(rng,riders):undefined;
  const lineCount=int(rng,1,5);
  const lines=Array.from({length:lineCount},()=>{
    const item=pick(rng,rng()<0.48&&popular.length?popular:baseItems);
    const shuffledFlavors=[...wingFlavors];
    for(let at=shuffledFlavors.length-1;at>0;at--){const other=int(rng,0,at);[shuffledFlavors[at],shuffledFlavors[other]]=[shuffledFlavors[other],shuffledFlavors[at]]}
    const flavors=item.flavorCount?shuffledFlavors.slice(0,item.flavorCount):undefined;
    return {itemId:item.id,name:item.name,unitPrice:item.price,quantity:int(rng,1,3),note:rng()<0.22?pick(rng,flavorLineNotes):'',...(flavors?.length?{flavors}:{})};
  });
  const subtotal=lines.reduce((sum,line)=>sum+line.unitPrice*line.quantity,0);
  const deliveryFee=selectedArea?.fee||0;
  const discount=rng()<0.28?Math.min(subtotal,Math.floor(subtotal*int(rng,3,12)/100/100)*100):0;
  const total=subtotal+deliveryFee-discount;
  const path=orderPath(type,index,rng);
  const statusHistory=path.map((status,step)=>({status,at:new Date(createdMs+step*int(rng,8,26)*60*1000).toISOString()}));
  // Keep all generated event timestamps increasing and within the selected range.
  const createdDate=Date.parse(createdAt);
  let prior=createdDate;
  const normalizedHistory=statusHistory.map((event,step)=>{
    const at=step===0?createdDate:prior+int(rng,8,26)*60*1000;
    prior=at;
    return {...event,at:new Date(at).toISOString()};
  });
  const canceled=path[path.length-1]==='Cancelled';
  const methods=(data.settings.paymentMethods||[]).filter(method=>method.active);
  const paymentState=canceled||!methods.length?'unpaid':pick(rng,['unpaid','unpaid','partial','paid','paid'] as const);
  const payments:Order['payments']=[];
  if(paymentState!=='unpaid'&&total>0){
    const method=pick(rng,methods);
    const paid=paymentState==='paid'?total:int(rng,1,Math.max(1,total-1));
    const paymentAt=new Date(prior+int(rng,5,35)*60*1000).toISOString();
    const firstAmount=paymentState==='paid'&&rng()<0.25?Math.max(1,Math.floor(total*0.4)):paid;
    payments.push({id:`${orderId}-payment-1`,amount:firstAmount,method:method.id,methodLabel:method.label,reference:`TEST-REF-${dateSuffix}-${index+1}-A`,at:paymentAt,kind:'payment',receivedById:'owner1',receivedByName:'TEST Sample Owner',receivedByRole:'owner'});
    if(firstAmount<paid){const secondMethod=pick(rng,methods);payments.push({id:`${orderId}-payment-2`,amount:paid-firstAmount,method:secondMethod.id,methodLabel:secondMethod.label,reference:`TEST-REF-${dateSuffix}-${index+1}-B`,at:new Date(Date.parse(paymentAt)+int(rng,5,25)*60*1000).toISOString(),kind:'payment',receivedById:'owner1',receivedByName:'TEST Sample Owner',receivedByRole:'owner'});}
  }
  const customer=`${pick(rng,firstNames)} ${pick(rng,lastNames)} ${index+1}`;
  return {
    id:orderId,number:String(firstTicket+index),createdAt,type,
    ...(type==='dine-in'?{dineInReference:`TEST Table ${1+(index%12)}`} :{}),
    customer,contact:`TEST-CONTACT-${dateSuffix}-${String(index+1).padStart(4,'0')}`,
    address:type==='delivery'?`TEST DELIVERY — ${100+index} Fictional Demo Street, Sample Barangay, Pandi`:'' ,
    landmark:type==='delivery'?'TEST LANDMARK — near the demo marker':'',
    notes:`TEST FIXTURE · seed ${seed} · generated order ${index+1}`,
    lines,subtotal,deliveryFee,
    ...(selectedArea?{deliveryAreaId:selectedArea.id,deliveryAreaLabel:selectedArea.label,deliveryAreaFee:selectedArea.fee}:{}),
    discount,total,status:path[path.length-1],statusHistory:normalizedHistory,payments,
    riderId:rider?.id||'',sample:true,testData:'bulk-order-generator',testDataSeed:seed,
  };
}

export function makeBulkTestOrderBatch(data:Database,count:number,seed:string,offset:number,firstTicket:number,generationId:string,nowMs:number){
  return Array.from({length:count},(_,index)=>makeBulkTestOrder(data,offset+index,seed,firstTicket,generationId,nowMs));
}

export function removeBulkTestOrders(data:Database){
  const removed=data.orders.filter(order=>order.testData==='bulk-order-generator').length;
  return {removed,orders:data.orders.filter(order=>order.testData!=='bulk-order-generator')};
}
