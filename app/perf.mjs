import * as A from '../vendor/box2d-original/main.js';
import * as B from '../vendor/box2d-fixed/main.js';
import { SCENES, buildWorld, stepWorld } from './scenes.js';
const F = 600, R = 5, res = {};
function run(api, k) {
  const n = SCENES[k].build().dyn.length, w = buildWorld(api, k, Array.from({ length: n }, (_, i) => i));
  const t = performance.now(); for (let f = 0; f < F; f++) stepWorld(api, w); return (performance.now() - t) / F;
}
for (const k of Object.keys(SCENES)) { run(A, k); run(B, k); res[k] = { o: [], p: [] }; }   // warmup
for (let r = 0; r < R; r++) for (const k of Object.keys(SCENES)) { res[k].o.push(run(A, k)); res[k].p.push(run(B, k)); }
const mean = (a) => a.reduce((x, y) => x + y) / a.length; let so = 0, sp = 0;
for (const k of Object.keys(res)) { const o = mean(res[k].o), p = mean(res[k].p); so += o; sp += p;
  console.log(`${k.padEnd(9)} original ${o.toFixed(3)} ms/step  patched ${p.toFixed(3)} ms/step  ${((p / o - 1) * 100).toFixed(1)}%`); }
console.log(`AVERAGE   original ${(so/4).toFixed(3)}  patched ${(sp/4).toFixed(3)}  ${((sp / so - 1) * 100).toFixed(1)}%`);
