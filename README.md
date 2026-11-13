# box2d-order-determinism

**Live demo: https://OWNER.github.io/box2d-order-determinism/**

Box2D is only deterministic if shapes are added in the same order. Two worlds with identical shapes
that were added in a different order drift apart. This repo shows that desync side by side and
contains a patch that removes it.

Built on [`phaser-box2d`](https://www.npmjs.com/package/phaser-box2d) 1.1.0, a pure-JS port of Box2D v3.

## The demo

Four simulations run in a 2×2 grid:

| | Order A | Order B (shuffled) |
|---|---|---|
| **Original box2d** (`vendor/box2d-original/`) | reference | desyncs |
| **Patched box2d** (`vendor/box2d-fixed/`) | reference | stays in sync |

Bodies more than 5 cm away from their counterpart in the reference world turn red. Each panel shows
how many bodies are off and the maximum drift. Scenes: Pachinko (default, shows it best), Tumbler,
Bowl, Pyramid. Pick a scene, shuffle seed and speed in the header.

## What the patch does

The JS port puts every contact into one list and solves them one after another, in creation order.
Creation order comes from body/shape/contact ids, which come from the order shapes were added, and
solving order changes floating-point results. The patch makes the order depend only on shape
properties:

- `canonical_c.js` (new): `b2CanonHash()` hashes a shape's own properties to a 53-bit number;
  `b2SortOverflowContacts()` orders contacts by the hashes of their two shapes.
- `body_c.js`: each body gets `canonHash` from its definition (type, position, rotation, velocities, damping...).
- `shape_c.js`: each shape gets `canonHash` from its body hash, type, geometry, material and filter.
- `contact_c.js`: same-type pairs are oriented A/B by hash instead of by shape id.
- `solver_c.js`: contacts are sorted into hash order before each solve (skipped if already sorted).

Every patched line is marked `// PATCH`. Limits: shapes with exactly identical properties share a hash
(swapping them gives the same simulation anyway), and joints are not reordered yet.

## Results

- 4 scenes × 7 shuffle seeds × 1800 frames: the patched copy matched bit for bit every time; the original drifted up to ~34 m.
- Average step time over 4 scenes: about 18–20% faster patched, mostly because the patched run puts bodies to sleep sooner
  (Pachinko, frame 450: 29 awake bodies vs 272). Scenes that never sleep (Tumbler): roughly neutral (+0.4% to +7.7%, noisy).
- Patched same-order runs are not bit-identical to the original's, so old replays would not carry over.

## Run locally

```
node server.mjs      # http://localhost:9001
node app/bench.mjs pachinko 1,2,3 1800   # headless desync check
node app/perf.mjs                        # timing, original vs patched
```

## Enable GitHub Pages

Settings → Pages → Deploy from a branch → `main` / `(root)`. The root `index.html` redirects to the demo.
