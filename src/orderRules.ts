import type { Order, Role, Status } from './types';

export const orderEditUnavailableReason=(order:Order)=>
 order.status==='Out for delivery'||order.status==='Completed'
  ?'Orders cannot be edited after dispatch or completion.'
  :order.status==='Cancelled'
   ?'Cancelled orders cannot be edited.'
   :'';

export const canEditOrder=(order:Order,role:Role)=>role==='owner'&&!orderEditUnavailableReason(order);

export const nextStatusTimestamp=(history:Order['statusHistory'])=>{
 const previous=history[history.length-1]?.at;
 const time=Date.now();
 return new Date(previous&&new Date(previous).getTime()>=time?new Date(previous).getTime()+1:time).toISOString();
};

export function nextOrderStatuses(order:Order,role:Role,userId:string):Status[]{
 const {status,type}=order;
 if(status==='Completed'||status==='Cancelled')return [];
 if(role==='rider'){
  if(type!=='delivery'||order.riderId!==userId)return [];
  if(status==='Ready')return ['Picked up'];
  if(status==='Picked up')return ['Out for delivery'];
  if(status==='Out for delivery')return ['Completed'];
  return [];
 }
 if(role==='chef'||role==='kitchen'){
  if(status==='New')return ['Preparing'];
  if(status==='Preparing')return ['Ready'];
  if(status==='Ready')return ['Picked up'];
  return [];
 }
 if(status==='New')return ['Preparing','Cancelled'];
 if(status==='Preparing')return ['Ready','Cancelled'];
 if(status==='Ready')return type==='pickup'?['Picked up','Completed','Cancelled']:['Picked up','Cancelled'];
 if(status==='Picked up')return type==='pickup'?['Completed','Cancelled']:['Out for delivery','Cancelled'];
 if(status==='Out for delivery'&&type==='delivery')return ['Completed','Cancelled'];
 return [];
}
