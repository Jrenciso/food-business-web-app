import assert from 'node:assert/strict';
import { build } from 'esbuild';

const output = await build({ entryPoints:['src/orderRules.ts'],bundle:true,platform:'node',format:'esm',write:false });
const { nextOrderStatuses } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
const order = (status,type='delivery',riderId='rider-1') => ({status,type,riderId});

for (const role of ['chef','kitchen']) {
  assert.deepEqual(nextOrderStatuses(order('New'),role,'staff-1'),['Preparing']);
  assert.deepEqual(nextOrderStatuses(order('Preparing'),role,'staff-1'),['Ready']);
  assert.deepEqual(nextOrderStatuses(order('Ready','pickup'),role,'staff-1'),['Picked up']);
  assert.deepEqual(nextOrderStatuses(order('Ready','dine-in'),role,'staff-1'),[]);
  assert.deepEqual(nextOrderStatuses(order('Ready','delivery'),role,'staff-1'),['Picked up']);
  assert.deepEqual(nextOrderStatuses(order('Picked up'),role,'staff-1'),[]);
  assert.deepEqual(nextOrderStatuses(order('Out for delivery'),role,'staff-1'),[]);
}

assert.deepEqual(nextOrderStatuses(order('Ready'), 'rider','rider-1'),['Picked up']);
assert.deepEqual(nextOrderStatuses(order('Picked up'), 'rider','rider-1'),['Out for delivery']);
assert.deepEqual(nextOrderStatuses(order('Out for delivery'), 'rider','rider-1'),['Completed']);
assert.deepEqual(nextOrderStatuses(order('Ready','delivery','rider-2'), 'rider','rider-1'),[]);
assert.deepEqual(nextOrderStatuses(order('Ready','pickup'), 'rider','rider-1'),[]);
assert.deepEqual(nextOrderStatuses(order('New'), 'rider','rider-1'),[]);
assert.deepEqual(nextOrderStatuses(order('Cancelled'), 'rider','rider-1'),[]);

assert.deepEqual(nextOrderStatuses(order('Ready','delivery'), 'owner','owner-1'),['Picked up','Cancelled']);
assert.deepEqual(nextOrderStatuses(order('Ready','dine-in'), 'owner','owner-1'),['Completed','Cancelled']);
assert.deepEqual(nextOrderStatuses(order('Picked up','dine-in'), 'owner','owner-1'),[]);
assert.deepEqual(nextOrderStatuses(order('Out for delivery'), 'owner','owner-1'),['Completed','Cancelled']);
console.log('Order role and status permissions passed');
