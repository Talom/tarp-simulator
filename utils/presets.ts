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
// Ridge runs along Z (length). Two poles at front/back edge centres.
function buildAFrame(w: number, l: number): PresetConfig {
  const H = Math.max(1.5, Math.min(w, l) * 0.67); // ridge height
  const hw = w / 2;
  const hl = l / 2;

  const anchorPoints = makeAnchors([
    [[-hw, 0, hl],  [0, H, hl],  [hw, 0, hl]],   // front row (v=0)
    [[-hw, 0, 0],   [0, H, 0],   [hw, 0, 0]],    // middle row (v=0.5)
    [[-hw, 0, -hl], [0, H, -hl], [hw, 0, -hl]],  // back row (v=1)
  ]);

  const pFront: Pole = { id: uid(), basePosition: [0, hl], height: H };
  const pBack: Pole  = { id: uid(), basePosition: [0, -hl], height: H };

  const ropes: Rope[] = [
    // Ridge rope (pole tops connected through the ridge anchors)
    { id: uid(), from: { type: 'pole_top', id: pFront.id }, to: { type: 'pole_top', id: pBack.id } },
    // Front guy ropes
    { id: uid(), from: { type: 'anchor', id: 'r0c0' }, to: { type: 'position', position: [-hw - 1, 0, hl + 1] } },
    { id: uid(), from: { type: 'anchor', id: 'r0c2' }, to: { type: 'position', position: [hw + 1, 0, hl + 1] } },
    // Back guy ropes
    { id: uid(), from: { type: 'anchor', id: 'r2c0' }, to: { type: 'position', position: [-hw - 1, 0, -hl - 1] } },
    { id: uid(), from: { type: 'anchor', id: 'r2c2' }, to: { type: 'position', position: [hw + 1, 0, -hl - 1] } },
  ];

  return { anchorPoints, poles: [pFront, pBack], ropes };
}

// ─── Lean-To ────────────────────────────────────────────────────────────────
// Back edge high (two poles), front edge on ground.
function buildLeanTo(w: number, l: number): PresetConfig {
  const H = Math.max(1.5, Math.min(w, l) * 0.67);
  const hw = w / 2;
  const hl = l / 2;

  const anchorPoints = makeAnchors([
    [[-hw, 0, hl],   [0, 0, hl],   [hw, 0, hl]],           // front row – ground
    [[-hw, H / 2, 0], [0, H / 2, 0], [hw, H / 2, 0]],      // middle row – mid height
    [[-hw, H, -hl],  [0, H, -hl],  [hw, H, -hl]],           // back row – full height
  ]);

  const pLeft:  Pole = { id: uid(), basePosition: [-hw, -hl], height: H };
  const pRight: Pole = { id: uid(), basePosition: [hw, -hl], height: H };

  const ropes: Rope[] = [
    // Ridge rope along back
    { id: uid(), from: { type: 'pole_top', id: pLeft.id }, to: { type: 'pole_top', id: pRight.id } },
    // Front ground pegs
    { id: uid(), from: { type: 'anchor', id: 'r0c0' }, to: { type: 'position', position: [-hw, 0, hl] } },
    { id: uid(), from: { type: 'anchor', id: 'r0c2' }, to: { type: 'position', position: [hw, 0, hl] } },
    // Side guy ropes from back corners
    { id: uid(), from: { type: 'anchor', id: 'r2c0' }, to: { type: 'position', position: [-hw - 1, 0, -hl - 0.5] } },
    { id: uid(), from: { type: 'anchor', id: 'r2c2' }, to: { type: 'position', position: [hw + 1, 0, -hl - 0.5] } },
  ];

  return { anchorPoints, poles: [pLeft, pRight], ropes };
}

// ─── Diamond ────────────────────────────────────────────────────────────────
// Single centre pole lifts the tarp centre. 4 cardinal edge points as guy anchors.
function buildDiamond(w: number, l: number): PresetConfig {
  const H = Math.max(1.5, Math.min(w, l) * 0.67);
  const hw = w / 2;
  const hl = l / 2;
  // Diagonal half-extents for the "diamond" points
  const d = Math.sqrt(hw * hw + hl * hl);

  const anchorPoints = makeAnchors([
    [[-hw * 0.7, 0.3, hl * 0.7],  [0, 0, d],             [hw * 0.7, 0.3, hl * 0.7]],
    [[-d, 0.6, 0],                 [0, H, 0],             [d, 0.6, 0]],
    [[-hw * 0.7, 0.3, -hl * 0.7], [0, 0.3, -d],          [hw * 0.7, 0.3, -hl * 0.7]],
  ]);

  const pole: Pole = { id: uid(), basePosition: [0, 0], height: H };

  const ropes: Rope[] = [
    // Centre anchor to pole top
    { id: uid(), from: { type: 'anchor', id: 'r1c1' }, to: { type: 'pole_top', id: pole.id } },
    // 4 cardinal edge points as guy ropes to ground stakes
    { id: uid(), from: { type: 'anchor', id: 'r0c1' }, to: { type: 'position', position: [0, 0, d + 1] } },
    { id: uid(), from: { type: 'anchor', id: 'r2c1' }, to: { type: 'position', position: [0, 0, -d - 1] } },
    { id: uid(), from: { type: 'anchor', id: 'r1c0' }, to: { type: 'position', position: [-d - 1, 0, 0] } },
    { id: uid(), from: { type: 'anchor', id: 'r1c2' }, to: { type: 'position', position: [d + 1, 0, 0] } },
  ];

  return { anchorPoints, poles: [pole], ropes };
}

export function buildPreset(preset: PresetType, width: number, length: number): PresetConfig {
  _id = 100; // reset to predictable IDs on each preset call
  switch (preset) {
    case 'a-frame': return buildAFrame(width, length);
    case 'lean-to': return buildLeanTo(width, length);
    case 'diamond':  return buildDiamond(width, length);
  }
}
