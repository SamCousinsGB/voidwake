export const STAR_LAYERS = [
  { count: 2700, depth: 0.035, size: 1.3, opacity: 0.48, z: -750 },
  { count: 1500, depth: 0.12, size: 2.0, opacity: 0.64, z: -650 },
  { count: 700, depth: 0.30, size: 3.2, opacity: 0.78, z: -550 },
  { count: 140, depth: 0.62, size: 5.2, opacity: 0.90, z: -450 },
];
export const parallaxOffset = (camera: number, depth: number) => camera * (1 - depth);
