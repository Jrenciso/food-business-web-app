import assert from 'node:assert/strict';
import { build } from 'esbuild';

const output=await build({entryPoints:['src/monitor.ts'],bundle:true,platform:'node',format:'esm',write:false});
const monitor=await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
const make=(id,status,createdAt,businessDate,statusHistory)=>({
  id,number:id,createdAt,businessDate,type:'delivery',status,statusHistory,lines:[],riderId:'r1',
});
const today='2026-10-26';
const orders=[
  make('new','New','2026-10-26T01:30:00Z',today,[{status:'New',at:'2026-10-26T01:30:00Z'}]),
  make('preparing','Preparing','2026-10-26T00:00:00Z',today,[
    {status:'New',at:'2026-10-26T00:00:00Z'},{status:'Preparing',at:'2026-10-26T01:00:00Z'},
  ]),
  make('done-today','Completed','2026-10-26T00:30:00Z',today,[
    {status:'New',at:'2026-10-26T00:30:00Z'},{status:'Completed',at:'2026-10-26T01:30:00Z'},
  ]),
  make('carry','Completed','2026-10-25T12:00:00Z','2026-10-25',[
    {status:'New',at:'2026-10-25T12:00:00Z'},{status:'Completed',at:'2026-10-26T01:45:00Z'},
  ]),
  make('cancelled','Cancelled','2026-10-26T01:00:00Z',today,[
    {status:'New',at:'2026-10-26T01:00:00Z'},{status:'Cancelled',at:'2026-10-26T01:10:00Z'},
  ]),
];
const summary=monitor.calculateMonitorSummary(orders,today,'Asia/Manila','04:00');
assert.equal(summary.receivedToday.length,4,'today follows business-date metadata');
assert.equal(summary.cancelledToday,1);
assert.equal(summary.activeToday.length,2);
assert.equal(summary.laneCounts.New,1);
assert.equal(summary.laneCounts.Preparing,1);
assert.equal(Object.values(summary.laneCounts).reduce((a,b)=>a+b,0),summary.activeToday.length,'lane counts reconcile with today active queue');
assert.equal(summary.carryover.length,0,'a closed carryover ticket is not shown as active carryover');
assert.equal(summary.completedToday.length,2,'completion count follows completion timestamp, including a carried ticket completed today');
assert.deepEqual(summary.turnarounds,[60*60*1000],'same-day average excludes prior-business-day tickets');
assert.equal(monitor.formatElapsed(190*60*1000),'3h 10m');
assert.equal(monitor.formatElapsed(27*60*60*1000),'1d 3h');
assert.equal(monitor.elapsedMilliseconds(undefined,Date.now()),null,'missing persisted timestamp stays unavailable');
const future=monitor.calculateMonitorSummary([
  make('future','New','2026-10-26T01:00:00Z','2026-10-27',[{status:'New',at:'2026-10-26T01:00:00Z'}]),
],today,'Asia/Manila','04:00');
assert.equal(future.futureActive.length,1,'future-dated active tickets remain visible outside today lanes');
const empty=monitor.calculateMonitorSummary([],today,'Asia/Manila','04:00');
assert.equal(empty.receivedToday.length,0);
assert.equal(empty.activeToday.length,0);
assert.equal(empty.completedToday.length,0);
assert.equal(empty.turnarounds.length,0,'no-data turnaround is unavailable instead of a false zero');
const malformed=monitor.calculateMonitorSummary([
  make('bad-date','New','not-a-date',undefined,[{status:'New',at:'bad-timestamp'}]),
  make('bad-completion','Completed','2026-10-26T01:00:00Z',today,[{status:'Completed',at:'bad-timestamp'}]),
],today,'Asia/Manila','04:00');
assert.equal(malformed.unscopedActive.length,1,'active tickets with invalid creation timestamps stay visible for review');
assert.equal(malformed.completedToday.length,0,'invalid completion timestamps do not crash or enter today totals');

const carryover=monitor.calculateMonitorSummary([
  make('prior','Ready','2026-10-25T12:00:00Z','2026-10-25',[{status:'Ready',at:'2026-10-25T14:00:00Z'}]),
],today,'Asia/Manila','04:00');
assert.equal(carryover.carryover.length,1);
assert.equal(carryover.activeToday.length,0);
console.log('Live monitor business-day scope, lane counts, and elapsed-time checks passed');
