import { AnchorPoint, Pole, Rope, PresetType } from '../store/simulatorStore';

let _id = 100;
const uid = () => `${_id++}`;

export interface PresetConfig {
  anchorPoints: AnchorPoint[];
  poles: Pole[];
  ropes: Rope[];
}

// Helper: build the 9 anchor-point grid from explicit [x,y,z] world positions.
// positions[row][col] where row 0 = front (v=0), row 2 = back (v=1).
function makeAnchors(positions: [number, number, number][][]): AnchorPoint[] {
  const pts: AnchorPoint[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      pts.push({
        id: `r${row}c${col}`,
        uvPosition: [col * 0.5, row * 0.5],
        position: positions[row][col],
      });
    }
  }
  return pts;
}

// ─── A-Frame ────────────────────────────────────────────────────────────────
// Symmetric ridge along Z. Fabric is fully tensioned: each side slants from
// pole top down to a ground stake at distance cx from the centre, where the
// slant length exactly matches half the tarp width (no over-/under-stretch).
//
//   slant = w/2     →     H² + cx² = (w/2)²
function buildAFrame(w: number, l: number): PresetConfig {
  const slant = w / 2;
  // Choose H ≈ 70% of slant (≈ 45° pitch); cap at 1.5m so head-room is sane
  const H = Math.min(slant * 0.7071, 1.5);
  const cx = Math.sqrt(slant * slant - H * H);
  const hl = l / 2;

  const anchorPoints = makeAnchors([
    [[-cx, 0, hl],  [0, H, hl],  [cx, 0, hl]],   // front
    [[-cx, 0, 0],   [0, H, 0],   [cx, 0, 0]],    // middle
    [[-cx, 0, -hl], [0, H, -hl], [cx, 0, -hl]],  // back
  ]);

  const pFront: Pole = { id: uid(), basePosition: [0,  hl], height: H };
  const pBack:  Pole = { id: uid(), basePosition: [0, -hl], height: H };

  const ropes: Rope[] = [
    { id: uid(), from: { type: 'pole_top', id: pFront.id }, to: { type: 'pole_top', id: pBack.id } },
    // Guy-out lines extending each corner outward
    { id: uid(), from: { type: 'anchor', id: 'r0c0' }, to: { type: 'position', position: [-cx - 0.7, 0,  hl + 0.7] } },
    { id: uid(), from: { type: 'anchor', id: 'r0c2' }, to: { type: 'position', position: [ cx + 0.7, 0,  hl + 0.7] } },
    { id: uid(), from: { type: 'anchor', id: 'r2c0' }, to: { type: 'position', position: [-cx - 0.7, 0, -hl - 0.7] } },
    { id: uid(), from: { type: 'anchor', id: 'r2c2' }, to: { type: 'position', position: [ cx + 0.7, 0, -hl - 0.7] } },
  ];

  return { anchorPoints, poles: [pFront, pBack], ropes };
}

// ─── Lean-To ────────────────────────────────────────────────────────────────
// Back edge raised on two poles, front edge pegged to ground. Slope length
// equals the tarp length:   H² + (2·hh)² = l²
function buildLeanTo(w: number, l: number): PresetConfig {
  const H = Math.min(l * 0.5, 1.5);             // ≈ 30° lean, capped
  const hh = Math.sqrt(l * l - H * H) / 2;      // half horizontal projection
  const hw = w / 2;

  const anchorPoints = makeAnchors([
    [[-hw, 0,    hh],  [0, 0,    hh],  [hw, 0,    hh]],   // front (ground)
    [[-hw, H/2,  0],   [0, H/2,  0],   [hw, H/2,  0]],    // middle (slope)
    [[-hw, H,   -hh],  [0, H,   -hh],  [hw, H,   -hh]],   // back   (poles)
  ]);

  const pLeft:  Pole = { id: uid(), basePosition: [-hw, -hh], height: H };
  const pRight: Pole = { id: uid(), basePosition: [ hw, -hh], height: H };

  const ropes: Rope[] = [
    { id: uid(), from: { type: 'pole_top', id: pLeft.id }, to: { type: 'pole_top', id: pRight.id } },
    // Front ground pegs (rope length 0 → already-pegged corners)
    { id: uid(), from: { type: 'anchor', id: 'r0c0' }, to: { type: 'position', position: [-hw, 0, hh] } },
    { id: uid(), from: { type: 'anchor', id: 'r0c2' }, to: { type: 'position', position: [ hw, 0, hh] } },
    // Back guy-outs to keep poles braced
    { id: uid(), from: { type: 'anchor', id: 'r2c0' }, to: { type: 'position', position: [-hw - 0.7, 0, -hh - 0.5] } },
    { id: uid(), from: { type: 'anchor', id: 'r2c2' }, to: { type: 'position', position: [ hw + 0.7, 0, -hh - 0.5] } },
  ];

  return { anchorPoints, poles: [pLeft, pRight], ropes };
}

// ─── Diamond ────────────────────────────────────────────────────────────────
// Classical "diamond pitch" (a.k.a. plough point):
//   • r0c0  (one tarp corner) is hoisted on a single pole
//   • r0c2, r2c0, r2c2  – the three other corners are pegged to the ground
// Viewed from above the four corners trace a diamond outline.
//
// Closed-form geometry for a square tarp (edge length W, pole height H):
//     denom = √(2W² − H²)
//     b = W² / denom            ← back-peg z-distance
//     a = (W² − H²) / denom     ← forward z-offset of the lifted corner
//     c = W·√(W² − H²) / denom  ← side-peg x-distance
//     z_c = (c² − b²) / (2b)
//     y_c = (b² − c²)(a + b) / (2Hb)
// All four fabric edges and the long diagonal end up at exact rest length.
//
// For non-square tarps the closed form is no longer exact – we fall back to
// using min(w, l) and let the cloth solver absorb the small mismatch.
function buildDiamond(w: number, l: number): PresetConfig {
  const W = Math.min(w, l);
  const H = W * 0.5;

  const denom = Math.sqrt(2 * W * W - H * H);
  const b = (W * W) / denom;
  const a = (W * W - H * H) / denom;
  const c = W * Math.sqrt(W * W - H * H) / denom;

  const z_c = (c * c - b * b) / (2 * b);
  const y_c = ((b * b - c * c) * (a + b)) / (2 * H * b);

  const anchorPoints = makeAnchors([
    [
      [0,    H,   a    ],   // r0c0  lifted corner (pole top)
      [c/2,  H/2, a/2  ],   // r0c1
      [c,    0,   0    ],   // r0c2  right ground peg
    ],
    [
      [-c/2, H/2, a/2  ],   // r1c0
      [0,    y_c, z_c  ],   // r1c1  centre saddle
      [c/2,  0,  -b/2  ],   // r1c2
    ],
    [
      [-c,   0,   0    ],   // r2c0  left ground peg
      [-c/2, 0,  -b/2  ],   // r2c1
      [0,    0,  -b    ],   // r2c2  back ground peg
    ],
  ]);

  const pole: Pole = { id: uid(), basePosition: [0, a], height: H };

  const ropes: Rope[] = [
    // Visual loop from the lifted corner to the pole top (≈ zero length)
    { id: uid(), from: { type: 'anchor', id: 'r0c0' }, to: { type: 'pole_top', id: pole.id } },
    // Forward guy line off the pole top for stability
    { id: uid(), from: { type: 'pole_top', id: pole.id }, to: { type: 'position', position: [0, 0, a + 1.2] } },
    // Guy-outs from the three ground corners
    { id: uid(), from: { type: 'anchor', id: 'r0c2' }, to: { type: 'position', position: [ c + 0.5, 0,  0.4] } },
    { id: uid(), from: { type: 'anchor', id: 'r2c0' }, to: { type: 'position', position: [-c - 0.5, 0, -0.4] } },
    { id: uid(), from: { type: 'anchor', id: 'r2c2' }, to: { type: 'position', position: [0,        0, -b - 0.7] } },
  ];

  return { anchorPoints, poles: [pole], ropes };
}

export function buildPreset(preset: PresetType, width: number, length: number): PresetConfig {
  _id = 100; // reset to predictable IDs on each preset call
  switch (preset) {
    case 'a-frame': return buildAFrame(width, length);
    case 'lean-to': return buildLeanTo(width, length);
    case 'diamond': return buildDiamond(width, length);
  }
}
