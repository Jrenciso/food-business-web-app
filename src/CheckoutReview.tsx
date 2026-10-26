import { ChevronRight } from 'lucide-react';
import { money, quantityItemLabel } from './data';
import { Modal } from './ui';
import CheckoutPayment, { checkoutPaymentValue, hasCheckoutPaymentIntent, type CheckoutPaymentDraft } from './CheckoutPayment';
import type { Line, OrderType, PaymentMethodOption } from './types';

export default function CheckoutReview({open,onClose,onFinalize,saving,type,customer,contact,address,landmark,dineInReference,riderName,notes,lines,subtotal,deliveryFee,discount,total,currency,paymentDraft,onPaymentDraft,methods,canPay}:{open:boolean;onClose:()=>void;onFinalize:()=>void;saving:boolean;type:OrderType;customer:string;contact:string;address:string;landmark:string;dineInReference:string;riderName:string;notes:string;lines:Line[];subtotal:number;deliveryFee:number;discount:number;total:number;currency:string;paymentDraft:CheckoutPaymentDraft;onPaymentDraft:(draft:CheckoutPaymentDraft)=>void;methods:PaymentMethodOption[];canPay:boolean}){
 if(!open)return null;
 const intent=hasCheckoutPaymentIntent(paymentDraft,methods),payment=checkoutPaymentValue(paymentDraft,total,methods),valid=!intent||Boolean(payment);
 const paymentStatus=!intent?'Save as unpaid':!payment?'Complete payment details to continue':payment.amount>=total?'Save as paid':'Save with partial payment';
 return <Modal title="Review order & payment" onClose={()=>{if(!saving)onClose()}} wide actions={<><button className="outline" disabled={saving} onClick={onClose}>Back to order</button><div className="checkout-finalize-action"><span role="status">{paymentStatus}</span><button className="primary" disabled={saving||!valid} onClick={onFinalize}>{saving?'Saving…':'Finalize order'} <ChevronRight size={17}/></button></div></>}>
  <div className="checkout-review">
   <div className="checkout-review-heading"><div><span className="eyebrow">REVIEW BEFORE SAVING</span><h3>{type==='delivery'?'Delivery':type==='dine-in'?'Dine-in':type==='take-out'?'Take-out':'Pickup'} order</h3></div><span className="checkout-no-ticket">Ticket number assigned after confirmation</span></div>
   <div className="checkout-review-fields">{customer&&<div><span>Customer</span><strong>{customer}</strong></div>}{contact&&<div><span>Contact</span><strong>{contact}</strong></div>}{type==='delivery'&&<><div><span>Delivery address</span><strong>{address}</strong></div>{landmark&&<div><span>Directions</span><strong>{landmark}</strong></div>}<div><span>Assigned rider</span><strong>{riderName||'—'}</strong></div></>}{type==='dine-in'&&dineInReference&&<div><span>Table / reference</span><strong>{dineInReference}</strong></div>}{notes&&<div className="checkout-review-notes"><span>Order notes</span><strong>{notes}</strong></div>}</div>
   <section className="checkout-review-items"><h3>Items</h3>{lines.map((line,index)=><div className="checkout-review-item" key={`${line.itemId}-${index}`}><span><b>{quantityItemLabel(line.quantity,line.name)}</b>{line.flavors?.length?<small>Flavors: {line.flavors.join(', ')}</small>:null}{line.note&&<small>Note: {line.note}</small>}</span><strong>{money(line.quantity*line.unitPrice,currency)}</strong></div>)}</section>
   <div className="checkout-review-totals"><div><span>Subtotal</span><strong>{money(subtotal,currency)}</strong></div>{type==='delivery'&&<div><span>Delivery fee</span><strong>{money(deliveryFee,currency)}</strong></div>}{discount>0&&<div><span>Discount</span><strong>−{money(discount,currency)}</strong></div>}<div className="checkout-review-total"><span>Total</span><strong>{money(total,currency)}</strong></div><div><span>Already paid</span><strong>{money(0,currency)}</strong></div></div>
   <CheckoutPayment remaining={total} currency={currency} methods={methods} draft={paymentDraft} onChange={onPaymentDraft} canPay={canPay}/>
   <p className="checkout-review-note">The order and any payment you entered are saved together after confirmation. No payment is recorded when the payment amount is zero.</p>
  </div>
 </Modal>
}
