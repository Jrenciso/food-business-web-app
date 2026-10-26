import assert from 'node:assert/strict';
import { build } from 'esbuild';

const output=await build({entryPoints:['src/data.ts'],bundle:true,platform:'node',format:'esm',write:false});
const data=await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
const order=(payments=[],paidAmount)=>({id:'order',number:'1',total:10000,paidAmount,payments});

assert.equal(data.balance(order()),10000,'unpaid order keeps its full balance');
assert.equal(data.paymentState(order()),'Unpaid');
assert.equal(data.balance(order([{kind:'payment',amount:3500}])),6500,'partial payment reduces remaining balance');
assert.equal(data.paymentState(order([{kind:'payment',amount:3500}])), 'Partially paid');
assert.equal(data.balance(order([{kind:'payment',amount:10000}])),0,'exact settlement has no remaining balance');
assert.equal(data.paymentState(order([{kind:'payment',amount:10000}])), 'Paid');
assert.equal(data.balance(order([{kind:'payment',amount:10001}])),0,'legacy over-collected display is clamped to zero');
assert.equal(data.balance(order([],2500)),7500,'legacy paidAmount is used when no payment rows exist');
assert.equal(data.balance(order([{kind:'payment',amount:10000},{kind:'refund',amount:1000}])),1000,'refund restores the outstanding balance');
console.log('Canonical payment state and balance checks passed');
