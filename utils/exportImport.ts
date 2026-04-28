import { AnchorPoint, Pole, Rope, TarpConfig } from '../store/simulatorStore';
import { ropeLength, tiltAngleDeg } from './geometry';

export interface ExportData {
  version: 1;
  tarp: TarpConfig;
  anchorPoints: AnchorPoint[];
  poles: Pole[];
  ropes: Array<Rope & { lengthM: number }>;
  tiltAngles: Record<string, number>; // anchorId → degrees from horizontal
}

export function buildExport(
  tarp: TarpConfig,
  anchorPoints: AnchorPoint[],
  poles: Pole[],
  ropes: Rope[],
): ExportData {
  const anchorMap = new Map(anchorPoints.map((a) => [a.id, a.position]));
  const poleTopMap = new Map(poles.map((p) => [p.id, [p.basePosition[0], p.height, p.basePosition[1]] as [number, number, number]]));

  function resolvePos(ep: Rope['from']): [number, number, number] | null {
    if (ep.type === 'anchor') return anchorMap.get(ep.id) ?? null;
    if (ep.type === 'pole_top') return poleTopMap.get(ep.id) ?? null;
    return ep.position;
  }

  const ropesWithLength = ropes.map((r) => {
    const a = resolvePos(r.from);
    const b = resolvePos(r.to);
    return { ...r, lengthM: a && b ? Math.round(ropeLength(a, b) * 100) / 100 : 0 };
  });

  // Compute tilt angles for each anchor pair that forms an edge
  const tiltAngles: Record<string, number> = {};
  const neighbours: [string, string][] = [
    ['r0c0','r0c1'],['r0c1','r0c2'],
    ['r1c0','r1c1'],['r1c1','r1c2'],
    ['r2c0','r2c1'],['r2c1','r2c2'],
    ['r0c0','r1c0'],['r1c0','r2c0'],
    ['r0c1','r1c1'],['r1c1','r2c1'],
    ['r0c2','r1c2'],['r1c2','r2c2'],
  ];
  for (const [a, b] of neighbours) {
    const pa = anchorMap.get(a);
    const pb = anchorMap.get(b);
    if (pa && pb) {
      const key = `${a}→${b}`;
      tiltAngles[key] = Math.round(tiltAngleDeg(pa, pb) * 10) / 10;
    }
  }

  return { version: 1, tarp, anchorPoints, poles, ropes: ropesWithLength, tiltAngles };
}

export function parseImport(json: string): {
  tarp: TarpConfig;
  anchorPoints: AnchorPoint[];
  poles: Pole[];
  ropes: Rope[];
} {
  const data = JSON.parse(json) as ExportData;
  return {
    tarp: data.tarp,
    anchorPoints: data.anchorPoints,
    poles: data.poles,
    ropes: data.ropes.map(({ lengthM: _l, ...r }) => r),
  };
}
