import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export const pesos=(n:number)=>(n/100).toFixed(2);
export const cents=(value:string)=>{const amount=Number(value);return Number.isFinite(amount)?Math.max(0,Math.round(amount*100)):0};
export const csv=(name:string,rows:(string|number)[][])=>{const body=rows.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\r\n');const a=document.createElement('a');const url=URL.createObjectURL(new Blob(['\uFEFF'+body],{type:'text/csv;charset=utf-8'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
export function Modal({title,onClose,children,wide=false,actions}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean;actions?:ReactNode}){
 const backdropRef=useRef<HTMLDivElement>(null),dialogRef=useRef<HTMLDivElement>(null),closeRef=useRef(onClose);closeRef.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const dialog=dialogRef.current;
  const first=dialog?.querySelector<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])');
  first?.focus({preventScroll:true});
  const handleKeyDown=(event:KeyboardEvent)=>{
   const backdrops=document.querySelectorAll('.modal-backdrop');
   if(backdrops[backdrops.length-1]!==backdropRef.current)return;
   if(event.key==='Escape'){event.preventDefault();closeRef.current();return}
   if(event.key==='Tab'&&dialog){
    const focusable=[...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(node=>node.offsetParent!==null);
    if(!focusable.length){event.preventDefault();dialog.focus();return}
    const firstFocusable=focusable[0],lastFocusable=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===firstFocusable){event.preventDefault();lastFocusable.focus()}
    else if(!event.shiftKey&&document.activeElement===lastFocusable){event.preventDefault();firstFocusable.focus()}
   }
  };
  document.addEventListener('keydown',handleKeyDown);
  return()=>{document.removeEventListener('keydown',handleKeyDown);previous?.focus({preventScroll:true})};
 },[]);
 return <div ref={backdropRef} className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div ref={dialogRef} className={`modal ${wide?'':'compact'}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}><div className="modal-head"><h2>{title}</h2><button className="icon-btn" aria-label="Close" onClick={onClose}><X/></button></div><div className="modal-body">{children}</div>{actions&&<div className="modal-actions">{actions}</div>}</div></div>
}
export const StatusBadge=({value}:{value:string})=><span className={`badge ${value.toLowerCase().replaceAll(' ','-')}`}>{value}</span>;
