import type { PaymentMethodOption, Settings } from './types';

export const defaultPaymentMethods=():PaymentMethodOption[]=>[
 {id:'cash',label:'Cash',active:true,order:0},
 {id:'gcash',label:'GCash',active:true,order:1},
 {id:'bank transfer',label:'Bank transfer',active:true,order:2},
 {id:'card',label:'Card',active:false,order:3},
 {id:'e-wallet',label:'E-wallet',active:false,order:4},
 {id:'other',label:'Other',active:false,order:5},
];
export const sortedPaymentMethods=(settings:Settings)=>[...(settings.paymentMethods||defaultPaymentMethods())].sort((a,b)=>a.order-b.order);
export const activePaymentMethods=(settings:Settings)=>sortedPaymentMethods(settings).filter(m=>m.active);
export const paymentMethodLabel=(settings:Settings,id:string,snapshot?:string)=>snapshot||defaultPaymentMethods().find(m=>m.id===id)?.label||settings.paymentMethods?.find(m=>m.id===id)?.label||id;
export const paymentMethodSummary=(settings:Settings,records:{method:string;methodLabel?:string}[])=>{
 const result=new Map<string,{id:string;label:string}>();
 for(const option of activePaymentMethods(settings))result.set(`${option.id}|${option.label}`,{id:option.id,label:option.label});
 for(const record of records){const label=paymentMethodLabel(settings,record.method,record.methodLabel);result.set(`${record.method}|${label}`,{id:record.method,label})}
 return [...result.values()];
};
