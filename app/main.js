import * as ORIG from '../vendor/box2d-original/main.js';
import * as FIXED from '../vendor/box2d-fixed/main.js';
import { SCENES, buildWorld, stepWorld, positions, shuffled } from './scenes.js';

const $ = (id) => document.getElementById(id);
const DESYNC = 0.05; // metres: a body is "desynced" if >5cm from its counterpart
const q = new URLSearchParams(location.search);
const sceneSel = $('scene');
for (const [k, v] of Object.entries(SCENES)) sceneSel.add(new Option(v.name, k));
sceneSel.value = q.get('scene') || "pachinko";
if (q.get('seed')) $('seed').value = q.get('seed');

let sims, frame, paused = false, firstDesync = [null, null], acc = 0, last = performance.now();
const canvases = [0, 1, 2, 3].map((i) => $('c' + i));
const ctxs = canvases.map((c) => c.getContext('2d'));

function reset() {
  const key = sceneSel.value, n = SCENES[key].build().dyn.length;
  const A = Array.from({ length: n }, (_, i) => i), B = shuffled(n, +$('seed').value || 1);
  sims = [
    { b2: ORIG, ...buildWorld(ORIG, key, A) }, { b2: ORIG, ...buildWorld(ORIG, key, B) },
    { b2: FIXED, ...buildWorld(FIXED, key, A) }, { b2: FIXED, ...buildWorld(FIXED, key, B) },
  ];
  frame = 0; firstDesync = [null, null]; acc = 0;
}

function compare(refSim, sim) {
  const a = positions(refSim.b2, refSim), b = positions(sim.b2, sim), bad = new Uint8Array(a.length / 3);
  let n = 0, mx = 0;
  for (let i = 0; i < bad.length; i++) {
    const d = Math.hypot(a[i * 3] - b[i * 3], a[i * 3 + 1] - b[i * 3 + 1]);
    if (d > DESYNC) { bad[i] = 1; n++; } if (d > mx) mx = d;
  }
  return { bad, n, mx };
}

function draw(i, sim, cmp) {
  const cv = canvases[i], ctx = ctxs[i], dpr = devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const sc = sim.scene, s = Math.min(w, h) / sc.view;
  ctx.setTransform(dpr * s, 0, 0, -dpr * s, dpr * (w / 2 - sc.cx * s), dpr * (h / 2 + sc.cy * s));
  ctx.lineWidth = 1 / s;
  const b2 = sim.b2;
  ctx.fillStyle = '#5b6370';
  for (const st of sim.statics) {
    ctx.save(); ctx.translate(st.x, st.y); if (st.angle) ctx.rotate(st.angle);
    ctx.beginPath(); if (st.shape === 'circle') ctx.arc(0, 0, st.r, 0, 7); else ctx.rect(-st.hw, -st.hh, st.hw * 2, st.hh * 2);
    ctx.fill(); ctx.restore();
  }
  if (sim.kin) {
    const p = b2.b2Body_GetPosition(sim.kinId), ang = b2.b2Rot_GetAngle(b2.b2Body_GetRotation(sim.kinId));
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
    for (const k of sim.kin.parts) ctx.fillRect(k.x - k.hw, k.y - k.hh, k.hw * 2, k.hh * 2);
    ctx.restore();
  }
  sim.dyn.forEach((d, idx) => {
    const id = sim.bodies[idx], p = b2.b2Body_GetPosition(id), a = b2.b2Rot_GetAngle(b2.b2Body_GetRotation(id));
    const bad = cmp && cmp.bad[idx];
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
    ctx.globalAlpha = bad ? 1 : 0.9; ctx.fillStyle = bad ? '#ff4d4f' : d.color;
    ctx.beginPath(); if (d.shape === 'circle') ctx.arc(0, 0, d.r, 0, 7); else ctx.rect(-d.hw, -d.hh, d.hw * 2, d.hh * 2);
    ctx.fill();
    if (d.shape === 'circle') { ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(d.r, 0); ctx.stroke(); }
    ctx.restore();
  });
}

function statHtml(cmp, who) {
  if (!who) return '<span class="ok">reference</span>';
  const n = sims[0].bodies.length, ok = cmp.n === 0;
  return `<span class="${ok ? 'ok' : 'bad'}">${ok ? 'IN SYNC' : 'DESYNC'}</span><br>${cmp.n}/${n} bodies off &gt;5cm<br>max drift ${cmp.mx.toFixed(2)} m`;
}

function tick(now) {
  const speed = +$('speed').value; acc += Math.min(now - last, 100) * speed; last = now;
  while (!paused && acc >= 1000 / 60) { acc -= 1000 / 60; for (const s of sims) stepWorld(s.b2, s); frame++; }
  const c1 = compare(sims[0], sims[1]), c3 = compare(sims[2], sims[3]);
  if (c1.n && firstDesync[0] == null) firstDesync[0] = frame;
  if (c3.n && firstDesync[1] == null) firstDesync[1] = frame;
  draw(0, sims[0], null); draw(1, sims[1], c1); draw(2, sims[2], null); draw(3, sims[3], c3);
  $('s0').innerHTML = statHtml(null, false); $('s2').innerHTML = statHtml(null, false);
  $('s1').innerHTML = statHtml(c1, true) + (firstDesync[0] != null ? `<br>first at frame ${firstDesync[0]}` : '');
  $('s3').innerHTML = statHtml(c3, true) + (firstDesync[1] != null ? `<br>first at frame ${firstDesync[1]}` : '');
  $('frame').textContent = `frame ${frame} (${(frame / 60).toFixed(1)}s) · ${sims[0].bodies.length} bodies · red = >5cm from reference`;
  requestAnimationFrame(tick);
}

$('reset').onclick = reset; sceneSel.onchange = reset; $('seed').onchange = reset;
$('pause').onclick = () => { paused = !paused; $('pause').textContent = paused ? 'Resume' : 'Pause'; };
window.__sims = () => sims; window.__frame = () => frame;
reset();
for (let i = 0, w = +q.get('warp') || 0; i < w; i++) { for (const s of sims) stepWorld(s.b2, s); frame++; } // ?warp=N pre-steps N frames
requestAnimationFrame(tick);
