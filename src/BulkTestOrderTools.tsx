import { useMemo, useState } from 'react';
import { useApp } from './AppContext';
import { enabledFixtureTypes, makeBulkTestOrderBatch, removeBulkTestOrders } from './bulkTestOrders';
import { Modal } from './ui';

const PRESETS=[50,100,250] as const;
const pause=()=>new Promise<void>(resolve=>window.setTimeout(resolve,0));

export default function BulkTestOrders(){
 const {data,user,role,workspace,cloudMode,commit,notify}=useApp();
 const [count,setCount]=useState<number>(50),[seed,setSeed]=useState('sample-run-1');
 const [confirm,setConfirm]=useState<'generate'|'cleanup'|null>(null),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0);
 const generatedCount=useMemo(()=>data.orders.filter(order=>order.testData==='bulk-order-generator').length,[data.orders]);
 if(cloudMode||workspace!=='sample'||role!=='owner'||user.role!=='owner')return null;
 const availableTypes=enabledFixtureTypes(data);
 const create=async()=>{
  if(!availableTypes.length)return notify('Enable an order type in New order settings before generating test orders.','error');
  if(!data.items.some(item=>item.available))return notify('Add an available menu item before generating test orders.','error');
  const safeSeed=seed.trim();if(!safeSeed)return notify('Enter a seed label for this test-data batch.','error');
  const firstTicket=Math.max(data.nextTicket,...data.orders.map(order=>Number(order.number)+1).filter(Number.isSafeInteger));
  const generationId=crypto.randomUUID(),referenceTime=Date.now();const staged=[] as ReturnType<typeof makeBulkTestOrderBatch>;
  setBusy(true);setProgress(0);
  try{
   for(let offset=0;offset<count;offset+=25){
    staged.push(...makeBulkTestOrderBatch(data,Math.min(25,count-offset),safeSeed,offset,firstTicket,generationId,referenceTime));
    setProgress(staged.length);if(staged.length<count)await pause();
   }
   const ok=await commit('test-data',draft=>{draft.orders=[...staged,...draft.orders];draft.nextTicket=firstTicket+staged.length});
   if(ok){setConfirm(null);notify(`Generated ${staged.length} sample test orders.`)}
  }catch(error){notify(error instanceof Error?error.message:'Could not prepare test orders. No records were saved.','error')}
  finally{setBusy(false)}
 };
 const cleanup=async()=>{
  const {orders,removed}=removeBulkTestOrders(data);if(!removed){setConfirm(null);return}
  const ok=await commit('test-data',draft=>{draft.orders=orders});if(ok){setConfirm(null);notify(`Removed ${removed} generated test orders.`)}
 };
 return <>
  <section className="surface bulk-test-tools" aria-labelledby="bulk-test-title">
   <div><h3 id="bulk-test-title">Sample / Test orders</h3><p>Create clearly labeled sample tickets for checking order volume and reports. These records stay in this browser’s Sample / Test workspace and never enter the shared workspace.</p></div>
   <div className="bulk-test-controls">
    <label>Number of orders<select value={count} disabled={busy} onChange={event=>setCount(Number(event.target.value))}>{PRESETS.map(value=><option key={value} value={value}>{value} orders</option>)}</select></label>
    <label>Seed label<input value={seed} disabled={busy} maxLength={48} onChange={event=>setSeed(event.target.value)} /></label>
    <button className="primary" disabled={busy||!availableTypes.length||!data.items.some(item=>item.available)} onClick={()=>setConfirm('generate')}>{busy?`Preparing ${progress} / ${count}…`:'Generate test orders'}</button>
    {generatedCount>0&&<button className="outline danger-text" disabled={busy} onClick={()=>setConfirm('cleanup')}>Remove generated orders ({generatedCount})</button>}
   </div>
   <small className="bulk-test-note">Enabled order types: {availableTypes.length?availableTypes.map(type=>type==='pickup'?'Pickup':type==='take-out'?'Take-out':type==='dine-in'?'Dine-in':'Delivery').join(', '):'None available'} · Other sample orders are preserved when you clean up.</small>
  </section>
  {confirm==='generate'&&<Modal title="Generate sample test orders?" onClose={()=>!busy&&setConfirm(null)} actions={<><button className="outline" disabled={busy} onClick={()=>setConfirm(null)}>Cancel</button><button className="primary" disabled={busy} onClick={()=>void create()}>{busy?`Preparing ${progress} / ${count}…`:`Generate ${count} orders`}</button></>}><p>This adds {count} clearly labeled TEST orders to the local Sample / Test workspace, using seed “{seed.trim()||'—'}”. Existing sample tickets and shared production data are left untouched.</p><p>Types included: {availableTypes.map(type=>type==='pickup'?'Pickup':type==='take-out'?'Take-out':type==='dine-in'?'Dine-in':'Delivery').join(', ')||'none'}.</p>{busy&&<progress className="bulk-test-progress" max={count} value={progress}/>}</Modal>}
  {confirm==='cleanup'&&<Modal title="Remove generated test orders?" onClose={()=>setConfirm(null)} actions={<><button className="outline" onClick={()=>setConfirm(null)}>Cancel</button><button className="primary" onClick={()=>void cleanup()}>Remove {generatedCount} generated orders</button></>}><p>This removes only the {generatedCount} orders created by this generator. All other sample records, payments, status histories, and ticket numbers remain as they are.</p></Modal>}
 </>;
}
