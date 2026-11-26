import * as THREE from 'three';

export type PixelStarVariant = 'blue' | 'yellow';

/**
 * 13x13 8-bit 4-point diamond star pattern (padded to 15x15 with 1px transparent margin):
 * - '.' : transparent
 * - 'O' : crisp dark pixel outline (#0c0e14)
 * - 'F' : primary star body color (cyan #00d4ff or gold #facc15)
 * - 'L' : bright inner highlight (#a5f3fc or #fef08a)
 * - 'W' : pure white center core (#ffffff)
 */
const PIXEL_STAR_GRID = [
  '......O......',
  '.....OFO.....',
  '.....OFO.....',
  '....OFFFO....',
  '...OOFLFOO...',
  '.OOFFFLFFFOO.',
  'OFFFLLWLLFFFO',
  '.OOFFFLFFFOO.',
  '...OOFLFOO...',
  '....OFFFO....',
  '.....OFO.....',
  '.....OFO.....',
  '......O......',
];

const PALETTES: Record<PixelStarVariant, Record<string, string>> = {
  blue: {
    O: '#0c0e14',
    F: '#00d4ff',
    L: '#a5f3fc',
    W: '#ffffff',
  },
  yellow: {
    O: '#0c0e14',
    F: '#facc15',
    L: '#fef08a',
    W: '#ffffff',
  },
};

/**
 * Generates a crisp nearest-neighbor 8-bit 4-point diamond star texture
 * matching the constellation poster pixel-art style.
 */
export function createPixelStarTexture(variant: PixelStarVariant): THREE.CanvasTexture {
  const size = 15; // 13x13 star + 1px transparent padding on each edge
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    const palette = PALETTES[variant];

    for (let y = 0; y < PIXEL_STAR_GRID.length; y++) {
      const row = PIXEL_STAR_GRID[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        const color = palette[ch];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x + 1, y + 1, 1, 1);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates a soft radial glow texture rendered behind crisp 3D pixel stars
 * so dark outlines remain distinct against deep space while keeping star radiance.
 */
export function createStarGlowTexture(variant: PixelStarVariant): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    const center = size / 2;
    const grad = ctx.createRadialGradient(center, center, 2, center, center, center);
    if (variant === 'yellow') {
      grad.addColorStop(0.0, 'rgba(254, 240, 138, 0.72)');
      grad.addColorStop(0.32, 'rgba(250, 204, 21, 0.36)');
      grad.addColorStop(0.68, 'rgba(245, 158, 11, 0.10)');
      grad.addColorStop(1.0, 'rgba(245, 158, 11, 0.0)');
    } else {
      grad.addColorStop(0.0, 'rgba(165, 243, 252, 0.65)');
      grad.addColorStop(0.32, 'rgba(0, 212, 255, 0.32)');
      grad.addColorStop(0.68, 'rgba(2, 132, 199, 0.10)');
      grad.addColorStop(1.0, 'rgba(2, 132, 199, 0.0)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
