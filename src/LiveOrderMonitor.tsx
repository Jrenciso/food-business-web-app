import { useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { useApp } from './AppContext';
import { cloud, type LiveMonitorSnapshot, type MonitorOrder } from './cloud';
import { dateTime } from './data';
import { currentOperatingDate, moduleEnabled, openBusinessDay } from './operations';
import { calculateMonitorSummary, elapsedMilliseconds, formatElapsed, monitorBusinessDate, monitorStages } from './monitor';

const stages=monitorStages;
const stageInfo:Record<string,string>={New:'Awaiting kitchen',Preparing:'In the kitchen',Ready:'Ready for handoff','Picked up':'Picked up','Out for delivery':'Rider on route'};
const orderLabel=(type:MonitorOrder['type'])=>type==='pickup'?'Pickup':type==='take-out'?'Take-out':type==='dine-in'?'Dine-in':'Delivery';
function Metric({label,value,detail}:{label:string;value:string;detail?:string}){return <div className="monitor-metric"><span>{label}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}</div>}
function Ticket({order,riders,now}:{order:MonitorOrder;riders:Map<string,string>;now:number}){
 const currentStageAt=[...order.statusHistory].reverse().find(x=>x.status===order.status)?.at;
 const elapsed=elapsedMilliseconds(order.status==='New'?order.createdAt:currentStageAt,now);
 const age=elapsedMilliseconds(order.createdAt,now);
 const units=order.lines.reduce((sum,l)=>sum+(Number(l.quantity)||0),0),preview=order.lines.slice(0,3),remaining=Math.max(0,order.lines.length-preview.length);
 return <article className="monitor-ticket" aria-label={`Ticket #${order.number}, ${order.status} lane, ${orderLabel(order.type)}`}>
  <div className="monitor-ticket-head"><span className="monitor-ticket-number">#{order.number}</span><span className={`monitor-type monitor-type-${order.type}`}>{orderLabel(order.type)}</span></div>
  <div className="monitor-wait">{order.status==='New'?'Waiting':'In stage'} · {formatElapsed(elapsed)}</div>
  {order.status!=='New'&&<div className="monitor-order-age">Total order age · {formatElapsed(age)}</div>}
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
 const dateOf=(o:MonitorOrder,at=o.createdAt)=>monitorBusinessDate({...o,createdAt:at},zone,cutoff)||'Date unavailable';
 const computed=useMemo(()=>calculateMonitorSummary(orders,date,zone,cutoff),[orders,date,zone,cutoff]);
 const avg=computed.turnarounds.length?formatElapsed(computed.turnarounds.reduce((sum,v)=>sum+v,0)/computed.turnarounds.length):'—';
 const stale=cloudMode&&lastSuccess!==null&&localNow-lastSuccess>45000;
 const connection=cloudMode?requestError?(stale?'Stale · reconnecting':lastSuccess===null?'Unavailable · retrying':'Refresh delayed'):stale?'Stale · reconnecting':lastSuccess===null?'Connecting…':'Live · auto refresh':data.settings.dataMode==='sample'?'Sample / test view':'Live local view';
 if(!accessAllowed||!enabled)return <section className="monitor-unavailable"><h1>Live Order Monitor unavailable</h1><p>{enabled?'This account does not have access to the monitor.':'The owner has turned off Live Order Monitor.'}</p></section>;
 const clock=new Intl.DateTimeFormat(undefined,{timeZone:zone,hour:'numeric',minute:'2-digit',second:'2-digit'}).format(now);
 return <section className={`live-order-monitor theme-${data.settings.theme}`} aria-label="Live Order Monitor">
  <header className="monitor-header"><div><div className="eyebrow">{serverData?.businessName||data.settings.businessName} · OPERATIONS</div><h1>Live Order Monitor</h1><p>Read-only fulfillment queue · {date}</p></div><div className="monitor-clock"><span className={`monitor-live-dot ${stale||requestError?'is-stale':''}`} aria-hidden="true"/><strong>{clock}</strong><small>{zone} · {connection}{lastSuccess?` · updated ${dateTime(new Date(lastSuccess).toISOString(),zone)}`:''}</small></div></header>
  {cloudMode&&requestError&&<div className="monitor-refresh-error" role="status"><RefreshCw size={16}/><span>{stale?'Showing the last confirmed snapshot. ':''}{requestError}</span></div>}
  <div className="monitor-metrics">
   <Metric label={role==='rider'?'Assigned today':'Orders received today'} value={String(computed.receivedToday.length)} detail={`${computed.cancelledToday} cancelled · business date ${date}`}/>
   <Metric label="Orders in line" value={String(computed.activeToday.length+computed.carryover.length+computed.futureActive.length+computed.unscopedActive.length)} detail={`Today ${computed.activeToday.length} · Carryover ${computed.carryover.length} · Future ${computed.futureActive.length} · Date unavailable ${computed.unscopedActive.length}`}/>
   <Metric label="Carryover active" value={String(computed.carryover.length)} detail="Unfinished from earlier business dates"/>
   <Metric label="Future-dated active" value={String(computed.futureActive.length)} detail="Outside the current business date"/>
   <Metric label="Completed today" value={String(computed.completedToday.length)} detail="By completion time and business timezone"/>
   <Metric label="Average turnaround today" value={avg} detail={computed.turnarounds.length?`Same-day tickets · ${computed.turnarounds.length} completed`:'No same-day completed sample'}/>
   <Metric label="Oldest active order" value={computed.oldest?`#${computed.oldest.number}`:'—'} detail={computed.oldest?`${formatElapsed(elapsedMilliseconds(computed.oldest.createdAt,now))} waiting`:'No active tickets'}/>
   <Metric label="Wait-time target" value="Not configured" detail="Elapsed times shown without an SLA target"/>
  </div>
  <div className="monitor-board-heading"><div><h2>Active queue</h2><p>Today’s active lanes; carryover and future-dated tickets are listed separately. Ticket times update live.</p></div><span className="monitor-readonly"><Activity size={15}/> Read only</span></div>
  {cloudMode&&serverData===null&&!requestError?<div className="monitor-empty">Loading authorized order queue…</div>:null}
  {cloudMode&&serverData===null&&requestError?<div className="monitor-empty">The live queue could not be loaded. {requestError}</div>:null}
  <div className="monitor-stage-tabs" role="group" aria-label="Choose an order status lane">{stages.map(stage=><button type="button" key={stage} aria-label={`${stage}, ${stageInfo[stage]}, ${computed.laneCounts[stage]} tickets`} aria-pressed={selectedStage===stage} onClick={()=>setSelectedStage(stage)}>{stage}<b>{computed.laneCounts[stage]}</b></button>)}</div>
  <div className="monitor-lanes" data-stage={selectedStage}>{stages.map(stage=>{const stageOrders=computed.activeToday.filter(o=>o.status===stage).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));return <section className={`monitor-lane lane-${stage.toLowerCase().replaceAll(' ','-')}`} key={stage} aria-label={`${stage} status lane, ${stageOrders.length} tickets`}><header><div><h3>{stage}</h3><span>{stageInfo[stage]}</span></div><b>{stageOrders.length}</b></header><div className="monitor-lane-list">{stageOrders.length?stageOrders.map(o=><Ticket key={o.id} order={o} riders={riders} now={now}/>):<p className="monitor-lane-empty">No tickets in this stage</p>}</div></section>})}</div>
  {computed.carryover.length>0&&<section className="monitor-carryover"><header><div><h2>Carryover · unfinished tickets</h2><p>Active tickets from earlier business dates</p></div><b>{computed.carryover.length}</b></header><div className="monitor-carryover-grid">{computed.carryover.map(o=><div key={o.id} className="monitor-carryover-card"><span>#{o.number} · {o.status}</span><strong>{orderLabel(o.type)} · {formatElapsed(elapsedMilliseconds(o.createdAt,now))} old</strong><small>Business date {dateOf(o)}</small></div>)}</div></section>}
  {computed.futureActive.length>0&&<section className="monitor-carryover monitor-future-orders"><header><div><h2>Future-dated active tickets</h2><p>Tickets assigned to later business dates</p></div><b>{computed.futureActive.length}</b></header><div className="monitor-carryover-grid">{computed.futureActive.map(o=><div key={o.id} className="monitor-carryover-card"><span>#{o.number} · {o.status}</span><strong>{orderLabel(o.type)}</strong><small>Business date {dateOf(o)}</small></div>)}</div></section>}
  {computed.unscopedActive.length>0&&<section className="monitor-carryover monitor-unscoped-orders"><header><div><h2>Active tickets · date unavailable</h2><p>Creation timestamps need review; tickets remain visible here.</p></div><b>{computed.unscopedActive.length}</b></header><div className="monitor-carryover-grid">{computed.unscopedActive.map(o=><div key={o.id} className="monitor-carryover-card"><span>#{o.number} · {o.status}</span><strong>{orderLabel(o.type)}</strong><small>Elapsed time unavailable</small></div>)}</div></section>}
  {computed.completedToday.length>0&&<section className="monitor-completed"><header><div><h2>Completed today</h2><p>Completed during business date {date}</p></div><b>{computed.completedToday.length}</b></header><div className="monitor-completed-list">{computed.completedToday.slice(0,8).map(o=><div key={o.id}><strong>#{o.number}</strong><span>{orderLabel(o.type)}</span><small>{dateTime([...o.statusHistory].reverse().find(x=>x.status==='Completed')!.at,zone)}</small></div>)}{computed.completedToday.length>8&&<small>+ {computed.completedToday.length-8} more completed today</small>}</div></section>}
  <footer className="monitor-footer">No customer contact, delivery address, payment, or financial details are shown.</footer>
 </section>
}
