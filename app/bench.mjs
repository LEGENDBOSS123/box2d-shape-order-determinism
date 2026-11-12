import * as A from '../vendor/box2d-original/main.js';
import * as B from '../vendor/box2d-fixed/main.js';
import { SCENES, buildWorld, stepWorld, positions, shuffled } from './scenes.js';
const keys = process.argv[2] ? [process.argv[2]] : Object.keys(SCENES);
const seeds = (process.argv[3] || '1234').split(',').map(Number), F = +process.argv[4] || 900;
const drift = (m, p, q, n) => { let mx = 0, c = 0; for (let i = 0; i < n; i++) { const d = Math.hypot(p[i*3]-q[i*3], p[i*3+1]-q[i*3+1]); mx = Math.max(mx, d); if (d > 0) c++; } return [mx, c]; };
for (const k of keys) for (const seed of seeds) {
  const n = SCENES[k].build().dyn.length, id = Array.from({ length: n }, (_, i) => i), sh = shuffled(n, seed);
  const oa = buildWorld(A, k, id), ob = buildWorld(A, k, sh), fa = buildWorld(B, k, id), fb = buildWorld(B, k, sh);
  const out = [];
  for (let f = 1; f <= F; f++) {
    stepWorld(A, oa); stepWorld(A, ob); stepWorld(B, fa); stepWorld(B, fb);
    if (f % (F / 3) === 0) {
      const [m1, c1] = drift(0, positions(A, oa), positions(A, ob), n), [m2, c2] = drift(0, positions(B, fa), positions(B, fb), n);
      out.push(`f${f}: original max=${m1.toFixed(3)} (${c1}/${n} differ) | patched max=${m2.toExponential(1)} (${c2}/${n} differ)`);
    }
  }
  console.log(`== ${k} seed=${seed}\n` + out.join('\n'));
}
