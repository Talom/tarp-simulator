import { create } from 'zustand';
import { buildPreset } from '../utils/presets';

export type ColorVariant = 'olive' | 'sand' | 'flecktarn';
export type CameraView = 'front' | 'back' | 'left' | 'right' | 'top' | 'free';
export type PresetType = 'a-frame' | 'lean-to' | 'diamond' | 'pyramid' | 'flat-roof' | 'adirondack';

export interface AnchorPoint {
  id: string;
  uvPosition: [number, number]; // [u, v] ∈ [0,1]²
  position: [number, number, number]; // world [x, y, z] in metres
}

export interface Pole {
  id: string;
  basePosition: [number, number]; // [x, z]
  height: number; // metres
}

export type RopeEndpoint =
  | { type: 'anchor'; id: string }
  | { type: 'pole_top'; id: string }
  | { type: 'position'; position: [number, number, number] };

export interface Rope {
  id: string;
  from: RopeEndpoint;
  to: RopeEndpoint;
}

export interface TarpConfig {
  width: number;   // metres (X axis)
  length: number;  // metres (Z axis)
  color: ColorVariant;
}

export type ContextMenuTarget =
  | { type: 'anchor'; id: string }
  | { type: 'pole';   id: string };

export interface ContextMenuState {
  target: ContextMenuTarget;
  x: number; // viewport pixels
  y: number;
}

export interface SimulatorState {
  tarp: TarpConfig;
  anchorPoints: AnchorPoint[];
  poles: Pole[];
  ropes: Rope[];
  cameraView: CameraView;
  controlPanelOpen: boolean;
  selectedPreset: PresetType | null;
  draggingAnchorId: string | null;
  draggingPoleId: string | null;
  snapGrid: number; // metres
  // Increments when the cloth state should be re-initialised from scratch
  // (preset apply, dimension change, JSON import). Tarp.tsx watches this.
  physicsVersion: number;
  contextMenu: ContextMenuState | null;

  // Actions
  setTarpConfig: (cfg: Partial<TarpConfig>) => void;
  setAnchorPosition: (id: string, pos: [number, number, number]) => void;
  setPoleHeight: (id: string, h: number) => void;
  setPoleBase: (id: string, base: [number, number]) => void;
  addPole: (pole: Omit<Pole, 'id'>) => void;
  removePole: (id: string) => void;
  addRope: (rope: Omit<Rope, 'id'>) => void;
  removeRope: (id: string) => void;
  setCameraView: (v: CameraView) => void;
  toggleControlPanel: () => void;
  applyPreset: (preset: PresetType) => void;
  setDraggingAnchor: (id: string | null) => void;
  setDraggingPole: (id: string | null) => void;
  exportJSON: () => string;
  importJSON: (json: string) => void;
  openContextMenu: (target: ContextMenuTarget, x: number, y: number) => void;
  closeContextMenu: () => void;
  attachAnchorToNearestFixpoint: (anchorId: string) => void;
  detachAnchorFromFixpoint: (anchorId: string) => void;
  attachNearestAnchorToPole: (poleId: string) => void;
  detachAnchorsFromPole: (poleId: string) => void;
}

// Vertical lift used for "detach" – needs to be larger than PIN_EPS (0.02 m)
// so the anchor leaves the fixpoint unambiguously and the cloth solver
// takes over.
const DETACH_LIFT = 0.5;

let nextId = 1;
const uid = () => `${nextId++}`;

// 9 anchor points in a 3×3 UV grid for a flat tarp
function defaultAnchors(width: number, length: number): AnchorPoint[] {
  const pts: AnchorPoint[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const u = col * 0.5;
      const v = row * 0.5;
      pts.push({
        id: `r${row}c${col}`,
        uvPosition: [u, v],
        position: [
          (u - 0.5) * width,
          0,
          (0.5 - v) * length,
        ],
      });
    }
  }
  return pts;
}

export const useSimStore = create<SimulatorState>((set, get) => ({
  tarp: { width: 3, length: 3, color: 'olive' },
  anchorPoints: defaultAnchors(3, 3),
  poles: [],
  ropes: [],
  cameraView: 'free',
  controlPanelOpen: true,
  selectedPreset: null,
  draggingAnchorId: null,
  draggingPoleId: null,
  snapGrid: 0.25,
  physicsVersion: 0,
  contextMenu: null,

  setTarpConfig: (cfg) =>
    set((s) => {
      const next = { ...s.tarp, ...cfg };
      // Rescale anchor positions if dimensions changed
      const scaleX = next.width / s.tarp.width;
      const scaleZ = next.length / s.tarp.length;
      const anchors = s.anchorPoints.map((a) => ({
        ...a,
        position: [a.position[0] * scaleX, a.position[1], a.position[2] * scaleZ] as [number, number, number],
      }));
      return { tarp: next, anchorPoints: anchors, physicsVersion: s.physicsVersion + 1 };
    }),

  setAnchorPosition: (id, pos) =>
    set((s) => ({
      anchorPoints: s.anchorPoints.map((a) => (a.id === id ? { ...a, position: pos } : a)),
    })),

  setPoleHeight: (id, h) =>
    set((s) => ({
      poles: s.poles.map((p) => (p.id === id ? { ...p, height: h } : p)),
    })),

  setPoleBase: (id, base) =>
    set((s) => ({
      poles: s.poles.map((p) => (p.id === id ? { ...p, basePosition: base } : p)),
    })),

  addPole: (pole) =>
    set((s) => ({ poles: [...s.poles, { ...pole, id: uid() }] })),

  removePole: (id) =>
    set((s) => ({
      poles: s.poles.filter((p) => p.id !== id),
      ropes: s.ropes.filter(
        (r) =>
          !(r.from.type === 'pole_top' && r.from.id === id) &&
          !(r.to.type === 'pole_top' && r.to.id === id)
      ),
    })),

  addRope: (rope) =>
    set((s) => ({ ropes: [...s.ropes, { ...rope, id: uid() }] })),

  removeRope: (id) =>
    set((s) => ({ ropes: s.ropes.filter((r) => r.id !== id) })),

  setCameraView: (v) => set({ cameraView: v }),

  toggleControlPanel: () => set((s) => ({ controlPanelOpen: !s.controlPanelOpen })),

  applyPreset: (preset) => {
    const { tarp, physicsVersion } = get();
    const { anchorPoints, poles, ropes } = buildPreset(preset, tarp.width, tarp.length);
    set({ anchorPoints, poles, ropes, selectedPreset: preset, physicsVersion: physicsVersion + 1 });
  },

  setDraggingAnchor: (id) => set({ draggingAnchorId: id }),
  setDraggingPole: (id) => set({ draggingPoleId: id }),

  exportJSON: () => {
    const { tarp, anchorPoints, poles, ropes } = get();
    return JSON.stringify({ tarp, anchorPoints, poles, ropes }, null, 2);
  },

  importJSON: (json) => {
    try {
      const data = JSON.parse(json);
      set((s) => ({
        tarp: data.tarp,
        anchorPoints: data.anchorPoints,
        poles: data.poles,
        ropes: data.ropes,
        selectedPreset: null,
        physicsVersion: s.physicsVersion + 1,
      }));
    } catch {
      console.error('Invalid JSON');
    }
  },

  openContextMenu: (target, x, y) => set({ contextMenu: { target, x, y } }),
  closeContextMenu: () => set({ contextMenu: null }),

  // Snap an anchor to its nearest fixpoint: either the ground (Y=0 at the
  // anchor's current X,Z) or the top of the closest pole, whichever is
  // closer in 3D space. The cloth solver will pin the anchor there on the
  // next setPinnedPositions pass.
  attachAnchorToNearestFixpoint: (anchorId) =>
    set((s) => {
      const anchor = s.anchorPoints.find((a) => a.id === anchorId);
      if (!anchor) return {};
      const [ax, ay, az] = anchor.position;

      const candidates: { pos: [number, number, number]; dist2: number }[] = [];

      // Ground projection at the same X,Z
      {
        const dy = ay - 0;
        candidates.push({ pos: [ax, 0, az], dist2: dy * dy });
      }

      // Each pole top
      for (const p of s.poles) {
        const px = p.basePosition[0];
        const pz = p.basePosition[1];
        const py = p.height;
        const dx = ax - px;
        const dy = ay - py;
        const dz = az - pz;
        candidates.push({ pos: [px, py, pz], dist2: dx * dx + dy * dy + dz * dz });
      }

      let best = candidates[0];
      for (const c of candidates) if (c.dist2 < best.dist2) best = c;

      return {
        anchorPoints: s.anchorPoints.map((a) =>
          a.id === anchorId ? { ...a, position: best.pos } : a,
        ),
      };
    }),

  // Lift the anchor off whatever fixpoint it sits on so isAnchorPinPoint
  // returns false and the cloth solver decides where it ends up.
  detachAnchorFromFixpoint: (anchorId) =>
    set((s) => ({
      anchorPoints: s.anchorPoints.map((a) =>
        a.id === anchorId
          ? {
              ...a,
              position: [a.position[0], a.position[1] + DETACH_LIFT, a.position[2]],
            }
          : a,
      ),
    })),

  // Find the closest anchor (by 3D distance to the pole top) and snap it
  // to the pole top. Anchors already pinned to this pole are skipped.
  attachNearestAnchorToPole: (poleId) =>
    set((s) => {
      const pole = s.poles.find((p) => p.id === poleId);
      if (!pole) return {};
      const top: [number, number, number] = [pole.basePosition[0], pole.height, pole.basePosition[1]];

      let bestId: string | null = null;
      let bestDist2 = Infinity;
      for (const a of s.anchorPoints) {
        const dx = a.position[0] - top[0];
        const dy = a.position[1] - top[1];
        const dz = a.position[2] - top[2];
        const d2 = dx * dx + dy * dy + dz * dz;
        // Skip if already at this pole top
        if (d2 < 1e-6) continue;
        if (d2 < bestDist2) {
          bestDist2 = d2;
          bestId = a.id;
        }
      }
      if (!bestId) return {};

      return {
        anchorPoints: s.anchorPoints.map((a) =>
          a.id === bestId ? { ...a, position: top } : a,
        ),
      };
    }),

  // Lift every anchor currently pinned to this pole top off, so the pole
  // is "free" again.
  detachAnchorsFromPole: (poleId) =>
    set((s) => {
      const pole = s.poles.find((p) => p.id === poleId);
      if (!pole) return {};
      const top: [number, number, number] = [pole.basePosition[0], pole.height, pole.basePosition[1]];
      return {
        anchorPoints: s.anchorPoints.map((a) => {
          const dx = a.position[0] - top[0];
          const dy = a.position[1] - top[1];
          const dz = a.position[2] - top[2];
          // Within ~1 cm of the pole top counts as "attached" here.
          if (dx * dx + dy * dy + dz * dz > 1e-4) return a;
          return {
            ...a,
            position: [a.position[0], a.position[1] + DETACH_LIFT, a.position[2]] as [number, number, number],
          };
        }),
      };
    }),
}));
