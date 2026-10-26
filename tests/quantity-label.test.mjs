import assert from 'node:assert/strict';
import { build } from 'esbuild';

const output = await build({ entryPoints: ['src/data.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const data = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);

assert.equal(data.quantityItemLabel(1, 'Oriental Soup'), '1 × Oriental Soup');
assert.equal(data.quantityItemLabel(12, 'Kare-Kareng Bagnet'), '12 × Kare-Kareng Bagnet');
assert.equal(data.quantityPrefix(3), '3 ×');
console.log('Quantity labels preserve counts and item names');
