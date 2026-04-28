// A module-level handle on the active TarpPhysicsState so non-Tarp components
// (specifically the AnchorPoint spheres for unpinned anchors) can read live
// vertex positions every frame without going through the Zustand store.
// The Tarp component owns the lifecycle; readers must guard against null.
import { TarpPhysicsState } from './tarpPhysics';

export const sharedPhysicsRef: { current: TarpPhysicsState | null } = { current: null };
