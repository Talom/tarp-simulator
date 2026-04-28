import * as THREE from 'three';
import { ColorVariant } from '../store/simulatorStore';

// Seeded PRNG (mulberry32)
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return [canvas, canvas.getContext('2d')!];
}

function buildTexture(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

function generateOlive(size = 512): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size);
  const rng = mulberry32(1);

  ctx.fillStyle = '#5a6132';
  ctx.fillRect(0, 0, size, size);

  // Subtle texture variation
  ctx.fillStyle = '#4e5529';
  for (let i = 0; i < 200; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 3 + rng() * 8;
    ctx.globalAlpha = 0.25 + rng() * 0.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  return buildTexture(canvas, 2, 2);
}

function generateSand(size = 512): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size);
  const rng = mulberry32(2);

  ctx.fillStyle = '#c8a96e';
  ctx.fillRect(0, 0, size, size);

  // Grain texture
  for (let i = 0; i < 300; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 2 + rng() * 6;
    const lighter = rng() > 0.5;
    ctx.fillStyle = lighter ? '#dbb87a' : '#b8954f';
    ctx.globalAlpha = 0.2 + rng() * 0.25;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  return buildTexture(canvas, 2, 2);
}

function generateFlecktarn(size = 512): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size);
  const rng = mulberry32(42);

  // Bundeswehr Flecktarn palette
  const BASE   = '#6e7b50'; // Feldgrau (base green)
  const DKGRN  = '#3d5028'; // dark green blobs
  const BROWN  = '#7b5e3a'; // brown patches
  const DKBRN  = '#3c2b1e'; // dark brown dots
  const BLACK  = '#1a1a1a'; // black micro-dots

  // 1. Base
  ctx.fillStyle = BASE;
  ctx.fillRect(0, 0, size, size);

  // 2. Dark green large blobs
  ctx.fillStyle = DKGRN;
  for (let i = 0; i < 45; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = 18 + rng() * 28;
    const ry = 12 + rng() * 22;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rng() * Math.PI);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 3. Brown medium patches
  ctx.fillStyle = BROWN;
  for (let i = 0; i < 35; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = 12 + rng() * 18;
    const ry = 8 + rng() * 14;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rng() * Math.PI);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 4. Dark brown small spots
  ctx.fillStyle = DKBRN;
  for (let i = 0; i < 60; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 4 + rng() * 9;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. Black micro-dots
  ctx.fillStyle = BLACK;
  for (let i = 0; i < 100; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 2 + rng() * 4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return buildTexture(canvas, 1.5, 1.5);
}

const cache = new Map<ColorVariant, THREE.CanvasTexture>();

export function getTarpTexture(color: ColorVariant): THREE.CanvasTexture {
  if (cache.has(color)) return cache.get(color)!;
  let tex: THREE.CanvasTexture;
  switch (color) {
    case 'olive':     tex = generateOlive();     break;
    case 'sand':      tex = generateSand();      break;
    case 'flecktarn': tex = generateFlecktarn(); break;
  }
  cache.set(color, tex);
  return tex;
}

export function clearTextureCache() {
  cache.clear();
}
