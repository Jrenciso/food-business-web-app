import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({entryPoints:['src/operations.ts'],bundle:true,platform:'node',format:'esm',write:false});
const ops = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const day='2026-10-25';
const order=(id,status='New',sample=true)=>({id,number:id,createdAt:`${day}T01:00:00Z`,businessDate:day,
 type:'pickup',status,sample,total:10000,discount:0,payments:[],statusHistory:[{status,at:`${day}T01:00:00Z`}],lines:[]});
const db={settings:{dataMode:'sample',timezone:'Asia/Manila',businessDayCutoff:'00:00',modules:ops.defaultModules()},
 orders:[order('1001'),order('1002','Cancelled'),order('1003','Picked up')],businessDays:[],cashMovements:[]};
assert.deepEqual(ops.cashPayment(10000,15000),{applied:10000,change:5000,balanceAfter:0});
assert.deepEqual(ops.cashPayment(10000,4000),{applied:4000,change:0,balanceAfter:6000});
assert.equal(ops.canAcceptOrders(db),true);
db.settings.modules.register=true;
assert.equal(ops.canAcceptOrders(db),false);
const settled=ops.settleSampleOrders(db,new Date(`${day}T02:00:00Z`));
assert.equal(settled.paymentsAdded,2);
assert.equal(settled.data.orders[0].status,'Completed');
assert.equal(settled.data.orders[0].payments[0].isTest,true);
assert.equal(settled.data.orders[1].status,'Cancelled');
assert.equal(settled.data.orders[1].payments.length,0);
assert.equal(settled.data.orders[2].status,'Completed');
assert.equal(ops.settleSampleOrders(settled.data,new Date(`${day}T03:00:00Z`)).paymentsAdded,0);
assert.throws(()=>ops.settleSampleOrders({...db,settings:{...db.settings,dataMode:'live'}}),/Sample/);
const businessDay={id:'day1',businessDate:day,openedAt:`${day}T00:00:00Z`,registerSessionId:'session1',openingFloat:2000};
const summary=ops.businessDaySummary({...settled.data,businessDays:[businessDay]},businessDay);
assert.equal(summary.collections,0,'test settlements stay out of the default report');
assert.equal(summary.expectedCash,2000);
assert.equal(ops.businessDaySummary(settled.data,businessDay,true).collections,20000);
const mixedLive={...db,settings:{...db.settings,dataMode:'live'},orders:[
 {...order('marked','Completed',false),testDataSeed:'live-order-module-50-20261022',payments:[{amount:10000,kind:'payment',method:'cash',custody:'rider',receivedById:'rider1',at:`${day}T02:00:00Z`}]},
 {...order('real','Completed',false),payments:[{amount:10000,kind:'payment',method:'cash',custody:'register',at:`${day}T02:00:00Z`,registerSessionId:'session1'}]},
]};
const liveSummary=ops.businessDaySummary(mixedLive,businessDay);
assert.equal(liveSummary.sales,10000,'seed-tagged orders are excluded from real sales');
assert.equal(liveSummary.collections,10000,'seed-tagged collections are excluded from real receipts');
assert.equal(ops.riderCashHeld(mixedLive,'rider1'),0,'seed-tagged rider cash is not real custody');
const csv=ops.closeCsv(settled.data,businessDay,true);
assert.ok(csv.startsWith('\uFEFF'));
assert.ok(csv.includes('MOCK-SETTLEMENT-1001'));
console.log('Business-day, cash, and sample settlement checks passed');
