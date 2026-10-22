import assert from 'node:assert/strict';
import { build } from 'esbuild';

const output = await build({ entryPoints:['src/accounting.ts'],bundle:true,platform:'node',format:'esm',write:false });
const { accounting } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
const payment = (id,amount,kind,at,receivedByRole,receivedByName,method='cash') =>
 ({id,amount,kind,at,receivedByRole,receivedByName,method,methodLabel:method,reference:'ref'});
const order = (number,createdAt,total,status,payments=[]) =>
 ({id:number,number,createdAt,total,status,type:'delivery',deliveryAreaLabel:'North',payments});
const data = {settings:{timezone:'Asia/Manila'},orders:[
 order('1001','2026-10-21T16:30:00Z',10000,'Completed',[
  payment('a',4000,'payment','2026-10-21T16:45:00Z','rider','Rider A'),
  payment('b',3000,'payment','2026-10-22T02:00:00Z','owner','Owner'),
  payment('c',1000,'refund','2026-10-22T03:00:00Z','owner','Owner')]),
 order('1002','2026-10-22T05:00:00Z',5000,'Cancelled',[]),
 order('1003','2026-10-22T10:00:00Z',8000,'New',[
  payment('d',2000,'payment','2026-10-22T11:00:00Z','rider','Rider B','gcash')]),
 order('1004','2026-10-22T16:30:00Z',9000,'New',[]),
]};
const day = accounting(data,'2026-10-22','2026-10-22');
assert.equal(day.salesBooked,18000);
assert.equal(day.paymentsReceived,9000);
assert.equal(day.refunds,1000);
assert.equal(day.netCollected,8000);
assert.equal(day.riderCollections,6000);
assert.equal(day.otherCollections,3000);
assert.equal(day.outstanding,10000);
assert.equal(day.rows.filter(row=>row.transaction==='sale').length,2);
assert.ok(day.rows.every(row=>!('address' in row)));
assert.equal(day.riderGroups.length,2);
console.log('Accounting reconciliation passed');
