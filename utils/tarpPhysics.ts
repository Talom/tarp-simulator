// Verlet-integration cloth simulation for the tarp surface.
// Anchor vertices that sit on the ground (y≈0) or exactly on a pole top are
// "pinned" – the user controls their position. Anchors that hover in the air
// without a physical attachment are left unpinned and the cloth simulation
// determines where they end up.
// All other (N+1)² − 9 vertices are always simulated with gravity + spring
// constraints; bend springs are symmetric to give the cloth bending stiffness.

import { AnchorPoint, Pole } from '../store/simulatorStore';
import { SUBDIVISIONS, positionAtUV } from './geometry';

// Tolerance for deciding whether an anchor sits exactly on the ground or on
// a pole top. The drag snap is 25 cm so 2 cm is a comfortable epsilon.
const PIN_EPS = 0.02;

const GRAVITY = -9.81;          // m / s²
const DAMPING = 0.985;          // velocity retention per step
// Constraint convergence on a 12-segment chain (anchor-to-anchor span) needs
// roughly N iterations with Gauss-Seidel PBD. We aim well past that so a
// fully-tensioned configuration (path length = chord length) settles to zero
// residual sag.
const ITERATIONS = 24;          // constraint relaxation passes per sub-step
const SUBSTEPS = 3;             // physics sub-steps per render frame
const STRUCT_STIFF = 1.0;
const SHEAR_STIFF  = 1.0;       // symmetric → in-plane shear stiffness
const BEND_STIFF   = 0.8;       // symmetric → out-of-plane bending stiffness

interface AnchorMapping {
  vertexIdx: number;
  id: string;
}

const ANCHOR_MAPPINGS: AnchorMapping[] = (() => {
  const N = SUBDIVISIONS;
  const M = N + 1;
  const half = N / 2;
  const out: AnchorMapping[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const j = r * half;
      const i = c * half;
      out.push({ vertexIdx: j * M + i, id: `r${r}c${c}` });
    }
  }
  return out;
})();

export interface TarpPhysicsState {
  width: number;
  length: number;
  positions: Float32Array;     // 3 floats per vertex, row-major (matches BufferGeometry)
  prevPositions: Float32Array;
  pinned: Uint8Array;
  structural: Uint32Array;     // pairs of vertex indices
  shear: Uint32Array;
  bend: Uint32Array;
  rest: {
    structural: Float32Array;
    shear: Float32Array;
    bend: Float32Array;
  };
}

export function createTarpPhysics(width: number, length: number): TarpPhysicsState {
  const N = SUBDIVISIONS;
  const M = N + 1;
  const total = M * M;

  const positions = new Float32Array(total * 3);
  const prevPositions = new Float32Array(total * 3);
  const pinned = new Uint8Array(total);

  // Natural rest layout: flat tarp on Y=0, centred at origin.
  // Rest spring lengths are derived from THIS configuration.
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const k = (j * M + i) * 3;
      positions[k]     = (i / N - 0.5) * width;
      positions[k + 1] = 0;
      positions[k + 2] = (0.5 - j / N) * length;
      prevPositions[k]     = positions[k];
      prevPositions[k + 1] = positions[k + 1];
      prevPositions[k + 2] = positions[k + 2];
    }
  }

  // Pin status is set later via setPinnedPositions(state, anchors, poles).
  // Default = unpinned.

  const structural: number[] = [];
  const shear: number[] = [];
  const bend: number[] = [];

  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const idx = j * M + i;
      if (i < N)              structural.push(idx, idx + 1);
      if (j < N)              structural.push(idx, idx + M);
      if (i < N && j < N)     shear.push(idx, idx + M + 1);
      if (i > 0 && j < N)     shear.push(idx, idx + M - 1);
      if (i < N - 1)          bend.push(idx, idx + 2);
      if (j < N - 1)          bend.push(idx, idx + 2 * M);
    }
  }

  const structuralArr = new Uint32Array(structural);
  const shearArr      = new Uint32Array(shear);
  const bendArr       = new Uint32Array(bend);

  return {
    width,
    length,
    positions,
    prevPositions,
    pinned,
    structural: structuralArr,
    shear:      shearArr,
    bend:       bendArr,
    rest: {
      structural: computeRestLengths(positions, structuralArr),
      shear:      computeRestLengths(positions, shearArr),
      bend:       computeRestLengths(positions, bendArr),
    },
  };
}

function computeRestLengths(positions: Float32Array, springs: Uint32Array): Float32Array {
  const out = new Float32Array(springs.length / 2);
  for (let s = 0, k = 0; s < springs.length; s += 2, k++) {
    const a = springs[s] * 3;
    const b = springs[s + 1] * 3;
    const dx = positions[a]     - positions[b];
    const dy = positions[a + 1] - positions[b + 1];
    const dz = positions[a + 2] - positions[b + 2];
    out[k] = Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return out;
}

// Returns true if the anchor sits at a real attachment point (ground or
// pole top). Only such anchors are pinned in the cloth simulation; "in-air"
// anchors are physics-driven and float to whatever position the cloth dictates.
export function isAnchorPinPoint(
  pos: [number, number, number],
  poles: Pole[],
): boolean {
  if (Math.abs(pos[1]) < PIN_EPS) return true;            // ground
  for (const p of poles) {
    if (
      Math.abs(p.basePosition[0] - pos[0]) < PIN_EPS &&
      Math.abs(p.basePosition[1] - pos[2]) < PIN_EPS &&
      Math.abs(p.height        - pos[1]) < PIN_EPS
    ) {
      return true;                                         // pole top
    }
  }
  return false;
}

// Vertex index in the BufferGeometry for a given anchor id ("r{row}c{col}").
export function vertexIndexForAnchor(anchorId: string): number {
  const m = anchorId.match(/^r(\d)c(\d)$/);
  if (!m) return -1;
  const r = parseInt(m[1], 10);
  const c = parseInt(m[2], 10);
  const N = SUBDIVISIONS;
  const half = N / 2;
  return (r * half) * (N + 1) + (c * half);
}

// Reconcile pin status & positions of the 9 anchors with the current store.
// Anchors at a valid attachment point (ground / pole top) are pinned and have
// their cloth vertex hard-set to the anchor world position.
// Anchors anywhere else are unpinned and their vertex is left to the solver.
// Sets prevPos = pos for pinned vertices so they contribute zero velocity.
export function setPinnedPositions(
  state: TarpPhysicsState,
  anchors: AnchorPoint[],
  poles: Pole[],
): void {
  const lookup = new Map(anchors.map((a) => [a.id, a.position]));
  for (const m of ANCHOR_MAPPINGS) {
    const p = lookup.get(m.id);
    if (!p) {
      state.pinned[m.vertexIdx] = 0;
      continue;
    }
    const pinned = isAnchorPinPoint(p, poles);
    state.pinned[m.vertexIdx] = pinned ? 1 : 0;
    if (pinned) {
      const k = m.vertexIdx * 3;
      state.positions[k]         = p[0];
      state.positions[k + 1]     = p[1];
      state.positions[k + 2]     = p[2];
      state.prevPositions[k]     = p[0];
      state.prevPositions[k + 1] = p[1];
      state.prevPositions[k + 2] = p[2];
    }
  }
}

// Seed all (pinned + non-pinned) particles from a bilinear interpolation of the
// 9 anchors. Used right after createTarpPhysics so the first rendered frame
// already shows a sensible "stretched" tarp – physics then adds sag on top.
export function bilinearInitialize(state: TarpPhysicsState, anchors: AnchorPoint[]): void {
  const N = SUBDIVISIONS;
  const M = N + 1;
  const grid: [number, number, number][][] = [
    [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  ];
  for (const a of anchors) {
    const m = a.id.match(/^r(\d)c(\d)$/);
    if (!m) continue;
    grid[parseInt(m[1])][parseInt(m[2])] = a.position;
  }
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const [x, y, z] = positionAtUV(i / N, j / N, grid);
      const k = (j * M + i) * 3;
      state.positions[k]         = x;
      state.positions[k + 1]     = y;
      state.positions[k + 2]     = z;
      state.prevPositions[k]     = x;
      state.prevPositions[k + 1] = y;
      state.prevPositions[k + 2] = z;
    }
  }
}

// Advance one physics step (called once per render frame).
// Sub-stepping with smaller dt drastically improves stability of constraint
// satisfaction → less residual sag from gravity on taut surfaces.
export function stepPhysics(state: TarpPhysicsState, dt: number): void {
  const subDt = dt / SUBSTEPS;
  for (let s = 0; s < SUBSTEPS; s++) stepOnce(state, subDt);
}

function stepOnce(state: TarpPhysicsState, dt: number): void {
  const { positions, prevPositions, pinned } = state;
  const dt2 = dt * dt;
  const total = positions.length / 3;

  // ── Verlet integration (gravity on Y) ───────────────────────────────────
  for (let i = 0; i < total; i++) {
    if (pinned[i]) continue;
    const xi = i * 3;
    const yi = xi + 1;
    const zi = xi + 2;

    const px = positions[xi], py = positions[yi], pz = positions[zi];
    const ox = prevPositions[xi], oy = prevPositions[yi], oz = prevPositions[zi];

    prevPositions[xi] = px;
    prevPositions[yi] = py;
    prevPositions[zi] = pz;

    positions[xi] = px + (px - ox) * DAMPING;
    positions[yi] = py + (py - oy) * DAMPING + GRAVITY * dt2;
    positions[zi] = pz + (pz - oz) * DAMPING;
  }

  // ── Constraint relaxation ──────────────────────────────────────────────
  // Structural & shear are asymmetric (rope-like): only resist stretching, so
  // the cloth folds freely when slack.
  // Bend is symmetric: it resists *both* stretch and compression → provides
  // bending stiffness, which prevents a taut surface from bowing under gravity
  // while still allowing gentle curvature over poles.
  for (let it = 0; it < ITERATIONS; it++) {
    // Structural: asymmetric so the cloth can fold/wrinkle when slack.
    relax(positions, pinned, state.structural, state.rest.structural, STRUCT_STIFF, false);
    // Shear: symmetric – diagonal distances are preserved by isometric folds
    // (proven by construction), so resisting both stretch *and* compression
    // adds in-plane stiffness without fighting the natural fold geometry.
    relax(positions, pinned, state.shear,      state.rest.shear,      SHEAR_STIFF,  true);
    // Bend: symmetric – the dominant force opposing gravity-induced sag.
    relax(positions, pinned, state.bend,       state.rest.bend,       BEND_STIFF,   true);
  }

  // ── Floor: clamp non-pinned vertices to Y ≥ 0 ───────────────────────────
  for (let i = 0; i < total; i++) {
    if (pinned[i]) continue;
    const yi = i * 3 + 1;
    if (positions[yi] < 0) {
      positions[yi] = 0;
      prevPositions[yi] = 0;
    }
  }
}

function relax(
  positions: Float32Array,
  pinned: Uint8Array,
  springs: Uint32Array,
  restLengths: Float32Array,
  stiffness: number,
  symmetric: boolean,
): void {
  const len = springs.length;
  for (let s = 0, k = 0; s < len; s += 2, k++) {
    const i = springs[s];
    const j = springs[s + 1];
    const ix = i * 3, iy = ix + 1, iz = ix + 2;
    const jx = j * 3, jy = jx + 1, jz = jx + 2;

    const dx = positions[jx] - positions[ix];
    const dy = positions[jy] - positions[iy];
    const dz = positions[jz] - positions[iz];
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq < 1e-12) continue;

    const dist = Math.sqrt(distSq);
    const restLen = restLengths[k];

    // Asymmetric: only resist stretch (allows folds when slack).
    // Symmetric: also resist compression (bending stiffness).
    if (!symmetric && dist <= restLen) continue;
    if (Math.abs(dist - restLen) < 1e-9) continue;

    const correction = ((dist - restLen) / dist) * stiffness;
    const fx = dx * correction;
    const fy = dy * correction;
    const fz = dz * correction;

    const pi = pinned[i];
    const pj = pinned[j];

    if (!pi && !pj) {
      const half = 0.5;
      positions[ix] += fx * half;
      positions[iy] += fy * half;
      positions[iz] += fz * half;
      positions[jx] -= fx * half;
      positions[jy] -= fy * half;
      positions[jz] -= fz * half;
    } else if (!pi && pj) {
      positions[ix] += fx;
      positions[iy] += fy;
      positions[iz] += fz;
    } else if (pi && !pj) {
      positions[jx] -= fx;
      positions[jy] -= fy;
      positions[jz] -= fz;
    }
  }
}
