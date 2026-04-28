import * as THREE from 'three';
import { AnchorPoint } from '../store/simulatorStore';

// Bilinear interpolation between four 3-D corners
// c00=bottom-left, c10=bottom-right, c01=top-left, c11=top-right in local UV [0,1]
function bilerp(
  c00: [number, number, number],
  c10: [number, number, number],
  c01: [number, number, number],
  c11: [number, number, number],
  u: number,
  v: number,
): [number, number, number] {
  const w00 = (1 - u) * (1 - v);
  const w10 = u * (1 - v);
  const w01 = (1 - u) * v;
  const w11 = u * v;
  return [
    w00 * c00[0] + w10 * c10[0] + w01 * c01[0] + w11 * c11[0],
    w00 * c00[1] + w10 * c10[1] + w01 * c01[1] + w11 * c11[1],
    w00 * c00[2] + w10 * c10[2] + w01 * c01[2] + w11 * c11[2],
  ];
}

// Build a 3×3 positional grid from the anchor-point array.
// anchorPoints must contain ids r0c0…r2c2.
function buildGrid(anchorPoints: AnchorPoint[]): [number, number, number][][] {
  const grid: [number, number, number][][] = [
    [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  ];
  for (const a of anchorPoints) {
    const m = a.id.match(/^r(\d)c(\d)$/);
    if (!m) continue;
    const row = parseInt(m[1]);
    const col = parseInt(m[2]);
    grid[row][col] = a.position;
  }
  return grid;
}

// Compute the world position for UV (u,v) ∈ [0,1]² using bilinear
// interpolation within the appropriate quadrant of the 3×3 grid.
export function positionAtUV(
  u: number,
  v: number,
  grid: [number, number, number][][],
): [number, number, number] {
  const col = u <= 0.5 ? 0 : 1;
  const row = v <= 0.5 ? 0 : 1;
  const lu = col === 0 ? u / 0.5 : (u - 0.5) / 0.5;
  const lv = row === 0 ? v / 0.5 : (v - 0.5) / 0.5;
  return bilerp(grid[row][col], grid[row][col + 1], grid[row + 1][col], grid[row + 1][col + 1], lu, lv);
}

export const SUBDIVISIONS = 24; // 24×24 quads

export function createTarpGeometry(subdivisions = SUBDIVISIONS): THREE.BufferGeometry {
  const N = subdivisions;
  const vCount = (N + 1) * (N + 1);
  const positions = new Float32Array(vCount * 3);
  const uvs = new Float32Array(vCount * 2);
  const indices: number[] = [];

  let vi = 0;
  let ui = 0;
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      positions[vi++] = 0;
      positions[vi++] = 0;
      positions[vi++] = 0;
      uvs[ui++] = i / N;
      uvs[ui++] = j / N;
    }
  }

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i;
      const b = a + 1;
      const c = a + (N + 1);
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

export function updateTarpGeometry(geo: THREE.BufferGeometry, anchorPoints: AnchorPoint[], subdivisions = SUBDIVISIONS): void {
  const N = subdivisions;
  const grid = buildGrid(anchorPoints);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute;

  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const idx = j * (N + 1) + i;
      const u = uvAttr.getX(idx);
      const v = uvAttr.getY(idx);
      const [x, y, z] = positionAtUV(u, v, grid);
      pos.setXYZ(idx, x, y, z);
    }
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

export function snapToGrid(value: number, grid = 0.25): number {
  return Math.round(value / grid) * grid;
}

export function ropeLength(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2);
}

export function tiltAngleDeg(from: [number, number, number], to: [number, number, number]): number {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const dy = to[1] - from[1];
  return Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)) * (180 / Math.PI);
}
