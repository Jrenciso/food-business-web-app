import type { ReactNode } from 'react';
import { X } from 'lucide-react';
export const pesos=(n:number)=>(n/100).toFixed(2);
export const cents=(value:string)=>{const amount=Number(value);return Number.isFinite(amount)?Math.max(0,Math.round(amount*100)):0};
export const csv=(name:string,rows:(string|number)[][])=>{const body=rows.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\r\n');const a=document.createElement('a');const url=URL.createObjectURL(new Blob(['\uFEFF'+body],{type:'text/csv;charset=utf-8'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
export function Modal({title,onClose,children,wide=false,actions}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean;actions?:ReactNode}){return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className={`modal ${wide?'':'compact'}`}><div className="modal-head"><h2>{title}</h2><button className="icon-btn" aria-label="Close" onClick={onClose}><X/></button></div><div className="modal-body">{children}</div>{actions&&<div className="modal-actions">{actions}</div>}</div></div>}
export const StatusBadge=({value}:{value:string})=><span className={`badge ${value.toLowerCase().replaceAll(' ','-')}`}>{value}</span>;
