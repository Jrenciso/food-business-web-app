import assert from 'node:assert/strict';
import { build } from 'esbuild';

const output = await build({ entryPoints:['src/data.ts'],bundle:true,platform:'node',format:'esm',write:false });
const module = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
const { canCreateOrders, defaultNewOrderDisplaySettings, normalizeNewOrderDisplaySettings, validateNewOrderFields } = module;
const settings = { newOrderDisplay: defaultNewOrderDisplaySettings() };

assert.deepEqual(settings.newOrderDisplay.orderCreationRoles,['owner','chef','kitchen']);
assert.equal(canCreateOrders('owner',settings),true);
assert.equal(canCreateOrders('chef',settings),true);
assert.equal(canCreateOrders('kitchen',settings),true);
assert.equal(canCreateOrders('rider',settings),false);
assert.equal(canCreateOrders('rider',{newOrderDisplay:{enabledOrderTypes:['pickup','delivery']}}),false);
assert.equal(normalizeNewOrderDisplaySettings({enabledOrderTypes:['pickup']}).fieldRules['dine-in'].contact,'hidden');
assert.equal(normalizeNewOrderDisplaySettings({fieldRules:{'dine-in':{contact:'required'}}}).fieldRules['dine-in'].contact,'hidden');

const order = (type, fields={}) => ({type,customer:'Customer',contact:'',deliveryAreaId:'',address:'',landmark:'',riderId:'',dineInReference:'',notes:'',...fields});
assert.doesNotThrow(()=>validateNewOrderFields(order('dine-in'),settings));
assert.doesNotThrow(()=>validateNewOrderFields(order('pickup'),settings));
assert.throws(()=>validateNewOrderFields(order('delivery',{deliveryAreaId:'area-1',address:'Street',riderId:'rider-1'}),settings),/contact number is required/i);
assert.doesNotThrow(()=>validateNewOrderFields(order('delivery',{contact:'09170000000',deliveryAreaId:'area-1',address:'Street',riderId:'rider-1'}),settings));
assert.throws(()=>validateNewOrderFields(order('dine-in',{contact:'09170000000'}),settings),/must be cleared/i);

const riderEnabled={newOrderDisplay:{...defaultNewOrderDisplaySettings(),orderCreationRoles:['owner','rider']}};
assert.equal(canCreateOrders('rider',riderEnabled),true);
console.log('New-order role and field settings passed');
