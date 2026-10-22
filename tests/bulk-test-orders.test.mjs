import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result=await build({entryPoints:['src/data.ts','src/bulkTestOrders.ts'],bundle:true,platform:'node',format:'esm',outdir:'out',write:false});
const modules={};
for(const file of result.outputFiles){
 const name=file.path.toLowerCase().includes('bulktestorders')?'generator':'data';
 modules[name]=await import(`data:text/javascript;base64,${Buffer.from(file.text).toString('base64')}`);
}
const {seed,db}=modules.data;
const {enabledFixtureTypes,makeBulkTestOrderBatch,removeBulkTestOrders}=modules.generator;
const original=seed(),owner=original.team.find(member=>member.role==='owner');
const now=Date.parse('2026-10-22T12:00:00.000Z'),generationId='test-generation';
const orders=makeBulkTestOrderBatch(original,250,'run-alpha',0,original.nextTicket,generationId,now);
assert.equal(orders.length,250);
assert.equal(new Set(orders.map(order=>order.id)).size,250);
assert.equal(new Set(orders.map(order=>order.number)).size,250);
assert.deepEqual(orders,makeBulkTestOrderBatch(original,250,'run-alpha',0,original.nextTicket,generationId,now),'same seed and inputs should produce repeatable data');
assert.ok(orders.every(order=>order.testData==='bulk-order-generator'&&order.sample&&order.customer.startsWith('TEST-')&&order.contact.startsWith('TEST-')));
assert.deepEqual(new Set(orders.map(order=>order.type)),new Set(enabledFixtureTypes(original)));
const statuses=new Set(orders.map(order=>order.status));
for(const status of ['New','Preparing','Ready','Picked up','Out for delivery','Completed','Cancelled'])assert.ok(statuses.has(status),`fixture batch should cover ${status}`);
assert.ok(orders.every(order=>Date.parse(order.createdAt)<now&&Date.parse(order.createdAt)>=now-30*24*60*60*1000));
assert.ok(orders.some(order=>order.status==='New')&&orders.some(order=>order.status==='Preparing')&&orders.some(order=>order.status==='Ready'));
for(const order of orders){
 const itemsTotal=order.lines.reduce((sum,line)=>sum+line.unitPrice*line.quantity,0);
 assert.equal(itemsTotal,order.subtotal);
 assert.equal(order.total,order.subtotal+order.deliveryFee-order.discount);
 assert.ok(order.payments.reduce((sum,payment)=>sum+payment.amount,0)<=order.total);
 if(order.type==='delivery')assert.ok(order.deliveryAreaId&&order.riderId&&order.address.startsWith('TEST DELIVERY'));
 else assert.equal(Boolean(order.deliveryFee||order.deliveryAreaId||order.riderId||order.address||order.landmark),false);
 if(order.status==='Cancelled')assert.equal(order.payments.length,0);
 assert.ok(order.statusHistory.every((event,index,history)=>index===0||Date.parse(event.at)>Date.parse(history[index-1].at)));
}
const paymentCoverage=new Set(orders.map(order=>{const paid=order.payments.reduce((sum,payment)=>sum+payment.amount,0);return paid===0?'unpaid':paid===order.total?'paid':'partial'}));
assert.deepEqual(paymentCoverage,new Set(['unpaid','partial','paid']));

const persisted=db.prepareMutation(original,'owner','test-data',draft=>{draft.orders=[...orders,...draft.orders];draft.nextTicket=original.nextTicket+orders.length},owner);
assert.equal(persisted.orders.length,250);
assert.equal(persisted.nextTicket,1251);
assert.throws(()=>db.prepareMutation(original,'chef','test-data',()=>{},original.team.find(member=>member.role==='chef')),/Role is not allowed/);
const live=structuredClone(original);live.settings.dataMode='live';
assert.throws(()=>db.prepareMutation(live,'owner','test-data',()=>{},owner),/Sample \/ Test workspace/);

const regular=structuredClone(orders[0]);regular.id='legacy-sample-ticket';regular.number='1000';delete regular.testData;delete regular.testDataSeed;
const withOrdinarySample={...original,orders:[regular,...orders],nextTicket:1251};
const cleanup=removeBulkTestOrders(withOrdinarySample);
assert.equal(cleanup.removed,250);
assert.deepEqual(cleanup.orders,[regular]);
const cleaned=db.prepareMutation(withOrdinarySample,'owner','test-data',draft=>{draft.orders=cleanup.orders},owner);
assert.deepEqual(cleaned.orders,[regular]);
assert.equal(cleaned.nextTicket,1251,'cleanup must not rewind ticket numbers');

const disabled={...original,settings:{...original.settings,newOrderDisplay:{...original.settings.newOrderDisplay,enabledOrderTypes:['pickup']}}};
assert.ok(makeBulkTestOrderBatch(disabled,30,'pickup-only',0,disabled.nextTicket,'disabled-check',now).every(order=>order.type==='pickup'));
const malformed=structuredClone(orders[0]);malformed.type='courier';
assert.throws(()=>db.prepareMutation(original,'owner','test-data',draft=>{draft.orders=[malformed];draft.nextTicket=original.nextTicket+1},owner),/disabled or unsupported order type/);
const deletion=structuredClone(original);deletion.orders=[{...structuredClone(orders[0]),id:'not-generated',number:'1001'}];
assert.throws(()=>db.prepareMutation({...original,orders:[regular]},'owner','test-data',draft=>{draft.orders=deletion.orders;draft.nextTicket=1002},owner),/Only generated bulk test orders can be removed/);
console.log('Bulk test-order generation, validation, and safe cleanup passed');
