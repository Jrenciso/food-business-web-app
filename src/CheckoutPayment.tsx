import { CreditCard } from 'lucide-react';
import { cashPayment } from './operations';
import { money } from './data';
import { cents, pesos } from './ui';
import type { PaymentEntryValue } from './PaymentEntry';
import type { PaymentMethodOption } from './types';

export interface CheckoutPaymentDraft { method:string; tender:string; amount:string; reference:string; cashConfirmed:boolean }

export const emptyCheckoutPaymentDraft=(_remaining:number,methods:PaymentMethodOption[]=[]):CheckoutPaymentDraft=>{
 const active=methods.filter(method=>method.active);
 const method=active.find(option=>option.id==='cash')||active[0];
 return {method:method?.id||'',tender:pesos(0),amount:pesos(0),reference:'',cashConfirmed:false};
};

export function hasCheckoutPaymentIntent(draft:CheckoutPaymentDraft,methods:PaymentMethodOption[]):boolean{
 const chosen=methods.find(method=>method.id===draft.method&&method.active);
 return chosen?.id==='cash'?cents(draft.tender)>0:cents(draft.amount)>0;
}

export function checkoutPaymentValue(draft:CheckoutPaymentDraft,remaining:number,methods:PaymentMethodOption[]):PaymentEntryValue|null{
 const option=methods.find(method=>method.id===draft.method&&method.active);
 if(!option||remaining<=0)return null;
 if(option.id==='cash'){
  const tenderedAmount=cents(draft.tender);
  if(tenderedAmount<=0)return null;
  const preview=cashPayment(remaining,tenderedAmount);
  if(!draft.cashConfirmed||preview.applied<=0||preview.applied>remaining)return null;
  return {amount:preview.applied,method:option.id,methodLabel:option.label,reference:draft.reference.trim(),tenderedAmount,changeAmount:preview.change,cashConfirmed:true};
 }
 const amount=cents(draft.amount);
 if(amount<=0||amount>remaining)return null;
 return {amount,method:option.id,methodLabel:option.label,reference:draft.reference.trim()};
}

export default function CheckoutPayment({remaining,currency,methods,draft,onChange,canPay=true}:{remaining:number;currency:string;methods:PaymentMethodOption[];draft:CheckoutPaymentDraft;onChange:(draft:CheckoutPaymentDraft)=>void;canPay?:boolean}){
 const activeMethods=methods.filter(method=>method.active),chosen=activeMethods.find(method=>method.id===draft.method),isCash=chosen?.id==='cash';
 const tendered=cents(draft.tender),preview=isCash&&tendered>0?cashPayment(remaining,tendered):null;
 const payment=checkoutPaymentValue(draft,remaining,methods),intent=hasCheckoutPaymentIntent(draft,methods);
 const balanceAfter=payment?Math.max(0,remaining-payment.amount):remaining;
 const setMethod=(method:string)=>onChange({...draft,method,tender:pesos(0),amount:pesos(0),cashConfirmed:false,reference:''});
 return <section className="checkout-payment" aria-labelledby="checkout-payment-heading">
  <div className="checkout-payment-heading"><div><h3 id="checkout-payment-heading">Payment</h3><p className="muted">Optional at checkout. Leave payment at zero to save as unpaid.</p></div><span className="checkout-balance-pill">Balance due <strong>{money(balanceAfter,currency)}</strong></span></div>
  {!activeMethods.length?<p className="muted">No payment methods are enabled. This order can still be finalized unpaid.</p>:<>
   <label>Payment method<select aria-label="Payment method" disabled={!canPay} value={draft.method} onChange={event=>setMethod(event.target.value)}>{activeMethods.map(method=><option key={method.id} value={method.id}>{method.label}</option>)}</select></label>
   {isCash&&<>
    <label>Cash received<input aria-label="Cash received" type="number" min="0" step="0.01" inputMode="decimal" disabled={!canPay} value={draft.tender} onChange={event=>onChange({...draft,tender:event.target.value,cashConfirmed:false})}/></label>
    <div className="tender-shortcuts"><button type="button" className="outline small" disabled={!canPay} onClick={()=>onChange({...draft,tender:pesos(remaining),cashConfirmed:false})}>Exact amount · {money(remaining,currency)}</button>{[50000,100000].filter(value=>value>remaining).slice(0,2).map(value=><button type="button" className="outline small" disabled={!canPay} key={value} onClick={()=>onChange({...draft,tender:pesos(value),cashConfirmed:false})}>{money(value,currency)}</button>)}</div>
    <div className="register-metrics payment-preview"><div><span>Payment amount</span><strong>{money(preview?.applied||0,currency)}</strong></div><div><span>Change to return</span><strong>{money(preview?.change||0,currency)}</strong></div><div><span>Balance due</span><strong>{money(payment?balanceAfter:remaining,currency)}</strong></div></div>
    {intent&&<label className="checkline"><input type="checkbox" disabled={!canPay} checked={draft.cashConfirmed} onChange={event=>onChange({...draft,cashConfirmed:event.target.checked})}/> I received the cash and returned the displayed change.</label>}
   </>}
   {chosen&&!isCash&&<>
    <label>Payment amount<input aria-label="Payment amount" type="number" min="0" max={pesos(remaining)} step="0.01" inputMode="decimal" disabled={!canPay} value={draft.amount} onChange={event=>onChange({...draft,amount:event.target.value})}/></label>
    <p className="muted small-note">Enter the amount received. The app does not independently verify this payment.</p>
    <div className="checkout-payment-noncash"><span>Payment amount</span><strong>{money(payment?.amount||0,currency)}</strong><span>Balance due after payment</span><strong>{money(balanceAfter,currency)}</strong></div>
   </>}
   {chosen&&<label>Transaction / reference (optional)<input disabled={!canPay} value={draft.reference} onChange={event=>onChange({...draft,reference:event.target.value})} placeholder={isCash?'Cash note':'Bank or wallet reference'}/></label>}
   {!canPay&&<p className="muted small-note">Payment at checkout is owner-only. You can still finalize this order unpaid.</p>}
   {intent&&<p className={`checkout-payment-summary ${payment?'is-valid':'is-invalid'}`} role="status"><CreditCard size={16}/>{payment?`${money(payment.amount,currency)} will be recorded with this order.`:isCash&&!draft.cashConfirmed?'Confirm the cash received and change returned to record payment.':'Enter a valid amount no greater than the balance due.'}</p>}
  </>}
 </section>;
}
