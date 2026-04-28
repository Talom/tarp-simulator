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
}

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
}));
