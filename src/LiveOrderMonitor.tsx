import { useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { useApp } from './AppContext';
import { cloud, type LiveMonitorSnapshot, type MonitorOrder } from './cloud';
import { dateTime } from './data';
import { currentOperatingDate, moduleEnabled, openBusinessDay, operatingDate } from './operations';

const stages=['New','Preparing','Ready','Picked up','Out for delivery'] as const;
const stageInfo:Record<string,string>={New:'Awaiting kitchen',Preparing:'In the kitchen',Ready:'Ready for handoff','Picked up':'Picked up','Out for delivery':'Rider on route'};
const orderLabel=(type:MonitorOrder['type'])=>type==='pickup'?'Pickup':type==='take-out'?'Take-out':type==='dine-in'?'Dine-in':'Delivery';
const timeLabel=(ms:number)=>{const minutes=Math.max(0,Math.floor(ms/60000));if(minutes<60)return `${minutes}m`;const hours=Math.floor(minutes/60);return `${hours}h ${minutes%60}m`};
const completionTime=(o:MonitorOrder)=>[...o.statusHistory].reverse().find(x=>x.status==='Completed')?.at;
function elapsedFrom(iso:string,now:number){const parsed=Date.parse(iso);return Number.isFinite(parsed)?Math.max(0,now-parsed):0}
function Metric({label,value,detail}:{label:string;value:string;detail?:string}){return <div className="monitor-metric"><span>{label}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}</div>}
function Ticket({order,riders,now}:{order:MonitorOrder;riders:Map<string,string>;now:number}){
 const age=timeLabel(elapsedFrom(order.createdAt,now)),statusStart=[...order.statusHistory].reverse().find(x=>x.status===order.status)?.at||order.createdAt;
 const units=order.lines.reduce((sum,l)=>sum+(Number(l.quantity)||0),0),preview=order.lines.slice(0,3),remaining=Math.max(0,order.lines.length-preview.length);
 return <article className="monitor-ticket">
  <div className="monitor-ticket-head"><span className="monitor-ticket-number">#{order.number}</span><span className={`monitor-type monitor-type-${order.type}`}>{orderLabel(order.type)}</span></div>
  <div className="monitor-ticket-meta"><span>{order.status}</span><span title="Time since order was placed">Order age {age}</span></div>
  <div className="monitor-wait">{timeLabel(elapsedFrom(statusStart,now))} in this stage</div>
  <div className="monitor-items"><strong>{units} item{units===1?'':'s'}</strong>{preview.map((line,i)=><div key={`${line.name}-${i}`}><span>{line.quantity} ×</span> {line.name}</div>)}{remaining>0&&<details><summary>+{remaining} more item{remaining===1?'':'s'}</summary>{order.lines.slice(3).map((line,i)=><div key={`${line.name}-rest-${i}`}><span>{line.quantity} ×</span> {line.name}</div>)}</details>}</div>
  {order.type==='delivery'&&order.riderId&&<div className="monitor-rider">Rider · {riders.get(order.riderId)||'Assigned'}</div>}
 </article>
}

export default function LiveOrderMonitor(){
 const {data,user,role,cloudMode,cloudBusinessId}=useApp();
 const [serverData,setServerData]=useState<LiveMonitorSnapshot|null>(null),[lastSuccess,setLastSuccess]=useState<number|null>(null),[requestError,setRequestError]=useState(''),[localNow,setLocalNow]=useState(Date.now()),[serverOffset,setServerOffset]=useState(0),[selectedStage,setSelectedStage]=useState<string>('New');
 const now=localNow+serverOffset;
 const accessAllowed=['owner','chef','kitchen','rider'].includes(role),enabled=moduleEnabled(data,'liveOrderMonitor');
 useEffect(()=>{const id=window.setInterval(()=>setLocalNow(Date.now()),1000);return()=>window.clearInterval(id)},[]);
 useEffect(()=>{
  if(!cloudMode||!cloudBusinessId||!enabled||!accessAllowed)return;
  let alive=true,busy=false;
  setServerData(null);setLastSuccess(null);setRequestError('');
  const load=async()=>{if(busy)return;busy=true;try{const snapshot=await cloud.readLiveOrderMonitor(cloudBusinessId);if(alive){const receivedAt=Date.now();setServerData(snapshot);setServerOffset(Date.parse(snapshot.serverTime)-receivedAt);setLastSuccess(receivedAt);setRequestError('')}}catch(e){if(alive){const code=e&&typeof e==='object'&&'code' in e?String((e as {code?:unknown}).code||''):'';setRequestError(code==='PGRST202'?'The Live Order Monitor database migration has not been deployed yet.':'Could not refresh the authorized monitor data.')}}finally{busy=false}};
  void load();const id=window.setInterval(()=>void load(),12000);return()=>{alive=false;window.clearInterval(id)}
 },[cloudMode,cloudBusinessId,enabled,accessAllowed]);
 const zone=serverData?.timezone||data.settings.timezone||'Asia/Manila',cutoff=serverData?.businessDayCutoff||data.settings.businessDayCutoff||'00:00';
 const localDay=moduleEnabled(data,'register')?openBusinessDay(data):undefined;
 const date=serverData?.businessDate||(localDay?.businessDate||currentOperatingDate(data,new Date(now)));
 const orders:MonitorOrder[]=cloudMode?(serverData?.orders||[]):data.orders.filter(o=>role!=='rider'||o.type==='delivery'&&o.riderId===user.id).map(o=>({id:o.id,number:o.number,createdAt:o.createdAt,businessDate:o.businessDate,type:o.type,status:o.status,statusHistory:o.statusHistory,lines:o.lines.map(({name,quantity})=>({name,quantity})),riderId:o.riderId}));
 const riders=useMemo(()=>new Map((serverData?.riders||data.team.filter(m=>m.role==='rider').map(m=>({id:m.id,name:m.name}))).map(r=>[r.id,r.name])),[serverData?.riders,data.team]);
 const dateOf=(o:MonitorOrder,at=o.createdAt)=>o.businessDate||operatingDate(at,zone,cutoff);
 const computed=useMemo(()=>{
  const todayOrders=orders.filter(o=>dateOf(o)===date),todayCreated=todayOrders.length;
  const active=todayOrders.filter(o=>!['Completed','Cancelled'].includes(o.status));
  const carryover=orders.filter(o=>!['Completed','Cancelled'].includes(o.status)&&dateOf(o)!==date).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
  const completed=todayOrders.filter(o=>o.status==='Completed'&&completionTime(o)&&operatingDate(completionTime(o)!,zone,cutoff)===date).sort((a,b)=>Date.parse(completionTime(b)!) - Date.parse(completionTime(a)!));
  const turnarounds=completed.map(o=>Date.parse(completionTime(o)!)-Date.parse(o.createdAt)).filter(n=>Number.isFinite(n)&&n>=0);
  const oldest=[...active,...carryover].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt))[0];
  const cancelled=todayOrders.filter(o=>o.status==='Cancelled').length;
  return {todayOrders,todayCreated,active,carryover,completed,turnarounds,oldest,cancelled}
 },[orders,date,zone,cutoff]);
 const avg=computed.turnarounds.length?timeLabel(computed.turnarounds.reduce((sum,v)=>sum+v,0)/computed.turnarounds.length):'—';
 const stale=cloudMode&&lastSuccess!==null&&localNow-lastSuccess>45000;
 const connection=cloudMode?requestError?(stale?'Stale · reconnecting':'Refresh delayed'):stale?'Stale · reconnecting':lastSuccess===null?'Connecting…':'Live · auto refresh':data.settings.dataMode==='sample'?'Sample / test view':'Live local view';
 if(!accessAllowed||!enabled)return <section className="monitor-unavailable"><h1>Live Order Monitor unavailable</h1><p>{enabled?'This account does not have access to the monitor.':'The owner has turned off Live Order Monitor.'}</p></section>;
 const clock=new Intl.DateTimeFormat(undefined,{timeZone:zone,hour:'numeric',minute:'2-digit',second:'2-digit'}).format(now);
 return <section className={`live-order-monitor theme-${data.settings.theme}`} aria-label="Live Order Monitor">
  <header className="monitor-header"><div><div className="eyebrow">{serverData?.businessName||data.settings.businessName} · OPERATIONS</div><h1>Live Order Monitor</h1><p>Read-only fulfillment queue · {date}</p></div><div className="monitor-clock"><span className={`monitor-live-dot ${stale||requestError?'is-stale':''}`} aria-hidden="true"/><strong>{clock}</strong><small>{zone} · {connection}{lastSuccess?` · updated ${dateTime(new Date(lastSuccess).toISOString(),zone)}`:''}</small></div></header>
  {cloudMode&&requestError&&<div className="monitor-refresh-error" role="status"><RefreshCw size={16}/><span>{stale?'Showing the last confirmed snapshot. ':''}{requestError}</span></div>}
  <div className="monitor-metrics">
   <Metric label="Orders received today" value={String(computed.todayCreated)} detail={`${computed.cancelled} cancelled`}/>
   <Metric label="Orders in line" value={String(computed.active.length+computed.carryover.length)} detail={stages.map(s=>`${s} ${[...computed.active,...computed.carryover].filter(o=>o.status===s).length}`).join(' · ')}/>
   <Metric label="Completed today" value={String(computed.completed.length)}/>
   <Metric label="Average order turnaround" value={avg} detail={computed.turnarounds.length?`From ${computed.turnarounds.length} completed order${computed.turnarounds.length===1?'':'s'}`:'Not enough completed orders'}/>
   <Metric label="Oldest active order" value={computed.oldest?`#${computed.oldest.number}`:'—'} detail={computed.oldest?timeLabel(elapsedFrom(computed.oldest.createdAt,now))+' waiting':'No active tickets'}/>
   <Metric label="Wait-time target" value="Not configured" detail="Ticket ages are shown on each card"/>
  </div>
  <div className="monitor-board-heading"><div><h2>Active queue</h2><p>Ticket ages update automatically. Use Orders to change status.</p></div><span className="monitor-readonly"><Activity size={15}/> Read only</span></div>
  {cloudMode&&serverData===null&&!requestError?<div className="monitor-empty">Loading authorized order queue…</div>:null}
  {cloudMode&&serverData===null&&requestError?<div className="monitor-empty">The live queue could not be loaded. {requestError}</div>:null}
  <div className="monitor-stage-tabs" role="group" aria-label="Choose an order status lane">{stages.map(stage=><button type="button" key={stage} aria-pressed={selectedStage===stage} onClick={()=>setSelectedStage(stage)}>{stage}<b>{computed.active.filter(o=>o.status===stage).length}</b></button>)}</div>
  <div className="monitor-lanes" data-stage={selectedStage}>{stages.map(stage=>{const stageOrders=computed.active.filter(o=>o.status===stage).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));return <section className={`monitor-lane lane-${stage.toLowerCase().replaceAll(' ','-')}`} key={stage} aria-label={`${stage}, ${stageOrders.length} tickets`}><header><div><h3>{stage}</h3><span>{stageInfo[stage]}</span></div><b>{stageOrders.length}</b></header><div className="monitor-lane-list">{stageOrders.length?stageOrders.map(o=><Ticket key={o.id} order={o} riders={riders} now={now}/>):<p className="monitor-lane-empty">No tickets</p>}</div></section>})}</div>
  {computed.carryover.length>0&&<section className="monitor-carryover"><header><div><h2>Carryover</h2><p>Unfinished tickets from earlier business dates</p></div><b>{computed.carryover.length}</b></header><div className="monitor-carryover-grid">{computed.carryover.map(o=><div key={o.id} className="monitor-carryover-card"><span>#{o.number} · {o.status}</span><strong>{orderLabel(o.type)} · {timeLabel(elapsedFrom(o.createdAt,now))} old</strong><small>Business date {dateOf(o)}</small></div>)}</div></section>}
  {computed.completed.length>0&&<section className="monitor-completed"><header><div><h2>Completed today</h2><p>Completed during {date}</p></div><b>{computed.completed.length}</b></header><div className="monitor-completed-list">{computed.completed.slice(0,8).map(o=><div key={o.id}><strong>#{o.number}</strong><span>{orderLabel(o.type)}</span><small>{dateTime(completionTime(o)!,zone)}</small></div>)}{computed.completed.length>8&&<small>+ {computed.completed.length-8} more completed today</small>}</div></section>}
  <footer className="monitor-footer">No customer contact, delivery address, payment, or financial details are shown.</footer>
 </section>
}
