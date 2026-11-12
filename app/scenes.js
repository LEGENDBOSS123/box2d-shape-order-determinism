// Scenes are built from a fixed list of dynamic "specs". Each sim adds the SAME specs to its world,
// only the ORDER in which they're added differs. Statics are always added first, identically.

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled(n, seed) {
  const r = mulberry32(seed), idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}

// spec: {id, shape:'box'|'circle', x, y, hw, hh | r, color}
const PALETTE = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7'];

export const SCENES = {
  pyramid: {
    name: 'Pyramid (identical boxes)', view: 28, cx: 0, cy: 12, gravity: -10,
    build() {
      const statics = [{ shape: 'box', x: 0, y: -1, hw: 40, hh: 1 }];
      const dyn = []; const rows = 22, s = 0.5;
      for (let i = 0; i < rows; i++) for (let j = i; j < rows; j++) {
        dyn.push({ id: dyn.length, shape: 'box', hw: s, hh: s, x: (i * 0.5 + (j - i) - rows / 2 * 0.5 * 2 + rows * 0.5) * 1.05 - rows * 0.5 * 0.5 * 0, y: 0.5 + i * 1.0, color: PALETTE[i % 8] });
      }
      return { statics, dyn, kin: null };
    },
  },
  bowl: {
    name: 'Bowl of mixed shapes', view: 34, cx: 0, cy: 14, gravity: -10,
    build() {
      const statics = [
        { shape: 'box', x: 0, y: -1, hw: 14, hh: 1 }, { shape: 'box', x: -14, y: 14, hw: 1, hh: 16 }, { shape: 'box', x: 14, y: 14, hw: 1, hh: 16 },
        { shape: 'box', x: -7, y: 3, hw: 6, hh: 0.4, angle: -0.5 }, { shape: 'box', x: 7, y: 3, hw: 6, hh: 0.4, angle: 0.5 },
      ];
      const r = mulberry32(7), dyn = [];
      for (let i = 0; i < 15; i++) for (let j = 0; j < 12; j++) {
        const k = dyn.length, c = k % 2;
        dyn.push({ id: k, shape: c ? 'circle' : 'box', r: 0.45, hw: 0.4, hh: 0.4, x: -11 + i * 1.5 + r() * 0.4, y: 6 + j * 1.5, color: PALETTE[k % 8] });
      }
      return { statics, dyn, kin: null };
    },
  },
  tumbler: {
    name: 'Tumbler (rotating drum)', view: 46, cx: 0, cy: 0, gravity: -10,
    build() {
      const r = mulberry32(11), dyn = [], W = 15;
      for (let i = 0; i < 16; i++) for (let j = 0; j < 14; j++) {
        const k = dyn.length;
        dyn.push({ id: k, shape: k % 3 === 0 ? 'box' : 'circle', r: 0.42, hw: 0.4, hh: 0.4, x: -10 + i * 1.3 + r() * 0.2, y: -9 + j * 1.3 + r() * 0.2, color: PALETTE[k % 8] });
      }
      const kin = { x: 0, y: 0, w: W, omega: 0.5, parts: [{ x: 0, y: -W, hw: W, hh: 0.6 }, { x: 0, y: W, hw: W, hh: 0.6 }, { x: -W, y: 0, hw: 0.6, hh: W }, { x: W, y: 0, hw: 0.6, hh: W }] };
      return { statics: [], dyn, kin };
    },
  },
  pachinko: {
    name: 'Pachinko (pegs + drops)', view: 36, cx: 0, cy: 14, gravity: -10,
    build() {
      const statics = [{ shape: 'box', x: 0, y: -1, hw: 20, hh: 1 }, { shape: 'box', x: -17, y: 14, hw: 1, hh: 16 }, { shape: 'box', x: 17, y: 14, hw: 1, hh: 16 }];
      for (let row = 0; row < 14; row++) for (let c = 0; c < 15; c++) statics.push({ shape: 'circle', r: 0.28, x: -15 + c * 2.1 + (row % 2) * 1.05, y: 4 + row * 1.6 });
      const r = mulberry32(3), dyn = [];
      for (let i = 0; i < 300; i++) dyn.push({ id: i, shape: 'circle', r: 0.4, x: -15 + (i % 25) * 1.2 + r() * 0.1, y: 28 + Math.floor(i / 25) * 1.1, color: PALETTE[i % 8] });
      return { statics, dyn, kin: null };
    },
  },
};

// Build a world with box2d module `b2` (namespace import of main.js). `order` is a permutation of dyn indices.
export function buildWorld(b2, sceneKey, order) {
  const sc = SCENES[sceneKey], { statics, dyn, kin } = sc.build();
  const wd = b2.b2DefaultWorldDef(); wd.gravity = new b2.b2Vec2(0, sc.gravity);
  const { worldId } = b2.CreateWorld({ worldDef: wd });
  const addStatic = (s) => {
    if (s.shape === 'circle') b2.CreateCircle({ worldId, type: b2.STATIC, position: new b2.b2Vec2(s.x, s.y), radius: s.r, friction: 0.6 });
    else {
      const bd = b2.b2DefaultBodyDef(); bd.type = b2.STATIC; bd.position = new b2.b2Vec2(s.x, s.y); if (s.angle) bd.rotation = b2.b2MakeRot(s.angle);
      b2.CreateBoxPolygon({ worldId, bodyDef: bd, size: new b2.b2Vec2(s.hw, s.hh), friction: 0.6 });
    }
  };
  statics.forEach(addStatic);
  let kinId = null;
  if (kin) {
    const bd = b2.b2DefaultBodyDef(); bd.type = b2.KINEMATIC; bd.position = new b2.b2Vec2(kin.x, kin.y); bd.angularVelocity = kin.omega;
    kinId = b2.b2CreateBody(worldId, bd);
    for (const p of kin.parts) b2.CreateBoxPolygon({ worldId, bodyId: kinId, position: new b2.b2Vec2(p.x, p.y), size: new b2.b2Vec2(p.hw, p.hh), friction: 0.6 });
  }
  const bodies = new Array(dyn.length);
  for (const i of order) {
    const s = dyn[i];
    const o = s.shape === 'circle'
      ? b2.CreateCircle({ worldId, type: b2.DYNAMIC, position: new b2.b2Vec2(s.x, s.y), radius: s.r, density: 1, friction: 0.6, restitution: 0.1 })
      : b2.CreateBoxPolygon({ worldId, type: b2.DYNAMIC, position: new b2.b2Vec2(s.x, s.y), size: new b2.b2Vec2(s.hw, s.hh), density: 1, friction: 0.6, restitution: 0.1 });
    bodies[s.id] = o.bodyId;
  }
  return { worldId, bodies, dyn, statics, kinId, kin, scene: sc };
}

export function stepWorld(b2, sim, dt = 1 / 60, sub = 4) { b2.b2World_Step(sim.worldId, dt, sub); }

export function positions(b2, sim) {
  const out = new Float64Array(sim.bodies.length * 3);
  sim.bodies.forEach((id, i) => {
    const p = b2.b2Body_GetPosition(id), r = b2.b2Body_GetRotation(id);
    out[i * 3] = p.x; out[i * 3 + 1] = p.y; out[i * 3 + 2] = b2.b2Rot_GetAngle(r);
  });
  return out;
}
