import { useEffect, useRef, useState } from 'react';
import { Download, Pencil, X } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { useApp } from './AppContext';
import { balance, collected, dateTime, money, paymentState } from './data';
import type { Order } from './types';

const message=(order:Order)=>({
 New:'Your order is received and queued.',
 Preparing:'Your order is being prepared.',
 Ready:order.type==='pickup'?'Your order is ready for pickup.':order.type==='take-out'?'Your take-out order is ready at the counter.':order.type==='dine-in'?'Your order is ready to serve.':'Your order is ready for dispatch.',
 'Picked up':order.type==='pickup'?'Your pickup order has been handed over.':order.type==='take-out'?'Your take-out order has been handed over.':'Your order has been picked up for delivery.',
 'Out for delivery':'Your order is on its way.',
 Completed:'Your order is complete. Thank you!',
 Cancelled:'This order has been cancelled.'
})[order.status];

interface OrderUpdateProps {
 order:Order;
 onClose:()=>void;
 onGoToOrders?:()=>void;
 onEdit?:()=>void;
 editUnavailableReason?:string;
}

export default function OrderUpdate({order,onClose,onGoToOrders,onEdit,editUnavailableReason}:OrderUpdateProps){
 const {data,notify}=useApp(),settings=data.settings,card=useRef<HTMLDivElement>(null),dialog=useRef<HTMLDivElement>(null),goToOrdersButton=useRef<HTMLButtonElement>(null),[busy,setBusy]=useState(false);
 const currency=settings.currency,payment=paymentState(order);
 const onCloseRef=useRef(onClose);onCloseRef.current=onClose;

 useEffect(()=>{
  const previouslyFocused=document.activeElement instanceof HTMLElement?document.activeElement:null;
  (goToOrdersButton.current||dialog.current)?.focus();
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();onCloseRef.current();return}
   if(event.key!=='Tab'||!dialog.current)return;
   const focusable=Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])'));
   if(!focusable.length)return;
   const first=focusable[0],last=focusable[focusable.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  };
  document.addEventListener('keydown',onKeyDown);
  return()=>{document.removeEventListener('keydown',onKeyDown);if(previouslyFocused?.isConnected)previouslyFocused.focus()};
 },[]);

 const download=async()=>{
  if(!card.current)return;
  setBusy(true);
  try{
   await document.fonts.ready;
   await Promise.all(Array.from(card.current.querySelectorAll('img')).map(img=>img.decode().catch(()=>undefined)));
   const width=card.current.scrollWidth,height=card.current.scrollHeight;
   const blob=await toBlob(card.current,{backgroundColor:'#fffdf8',pixelRatio:2,cacheBust:true,width,height,canvasWidth:width,canvasHeight:height});
   if(!blob)throw Error('Empty image');
   const url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download=`order-update-${order.number}.png`;
   document.body.appendChild(link);link.click();link.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),30000);
   notify(`Order update #${order.number} downloaded`);
  }catch{notify('Could not download the order update. Check the business logo and try again.','error')}
  finally{setBusy(false)}
 };

 return <div className="modal-backdrop update-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <div className="modal update-modal" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="customer-order-update-title" tabIndex={-1}>
   <div className="modal-head update-modal-head">
    <h2 id="customer-order-update-title">Customer order update</h2>
    <div className="update-head-actions">{onGoToOrders&&<button ref={goToOrdersButton} className="outline small" onClick={onGoToOrders}>Go to orders</button>}<button className="icon-btn" aria-label="Close customer order update" onClick={onClose}><X/></button></div>
   </div>
   <div className="update-preview-scroll">
    <div className="order-update-card" ref={card}>
     <div className="update-brand">{settings.logo?<img src={settings.logo} alt="Business logo"/>:<span>✦</span>}<div><strong>{settings.businessName}</strong>{settings.tagline&&<small>{settings.tagline}</small>}</div></div>
     {order.sample&&<span className="sample-tag">SAMPLE / TEST</span>}
     <div className="update-kicker">ORDER UPDATE</div><h2>Ticket #{order.number}</h2>
     <div className="update-status">{order.status}</div><p>{message(order)}</p>
     <div className="update-details"><div><span>Order type</span><strong>{order.type==='pickup'?'Pickup':order.type==='take-out'?'Take-out':order.type==='dine-in'?'Dine-in':'Delivery'}</strong></div>{order.type==='delivery'&&<div><span>Delivery area</span><strong>{order.deliveryAreaLabel||'Not specified'}</strong></div>}<div><span>Updated</span><strong>{dateTime(order.statusHistory[order.statusHistory.length-1]?.at||order.createdAt,settings.timezone)}</strong></div></div>
     <section className="update-items" aria-label="Items ordered"><h3>Items ordered</h3>{order.lines.map((line,index)=><div className="update-item" key={`${line.itemId}-${index}`}><div><strong>{line.quantity}× {line.name}</strong>{line.flavors?.length?<small>Flavors: {line.flavors.join(', ')}</small>:null}</div><b>{money(line.unitPrice*line.quantity,currency)}</b></div>)}</section>
     <div className="update-totals"><div><span>Subtotal</span><strong>{money(order.subtotal,currency)}</strong></div>{order.discount>0&&<div><span>Discount</span><strong>−{money(order.discount,currency)}</strong></div>}{order.type==='delivery'&&<div><span>Delivery fee</span><strong>{money(order.deliveryFee,currency)}</strong></div>}<div className="update-grand-total"><span>Total</span><strong>{money(order.total,currency)}</strong></div></div>
     <div className="update-payment"><div><span>Payment status</span><span className={`payment-badge ${payment.toLowerCase().replaceAll(' ','-')}`}>{payment.toUpperCase()}</span></div><div><span>Amount collected</span><strong>{money(collected(order),currency)}</strong></div><div><span>Remaining balance</span><strong>{money(balance(order),currency)}</strong></div></div>
     <footer>Thank you for choosing {settings.businessName}.</footer>
    </div>
   </div>
   <div className="modal-actions update-modal-actions"><button className="outline" onClick={onClose}>Close</button>{onEdit&&<><button className="outline" disabled={!!editUnavailableReason} title={editUnavailableReason||undefined} onClick={onEdit}><Pencil size={16}/>{editUnavailableReason?'Edit unavailable':'Edit'}</button>{editUnavailableReason&&<small className="edit-lock-note">{editUnavailableReason}</small>}</>}<button className="primary" onClick={download} disabled={busy}><Download size={17}/>{busy?'Preparing image…':'Download PNG'}</button></div>
  </div>
 </div>
}
