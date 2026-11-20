import * as THREE from 'three';

export interface RawStar {
  id: number;
  hip: number | null;
  name: string;
  mag: number;
  ci: number;
  dist: number;
  x: number;
  y: number;
  z: number;
}

export interface RawLine {
  s1_id: number;
  s2_id: number;
  p1: [number, number, number];
  p2: [number, number, number];
}

export interface ConstellationArtAffine {
  p0: [number, number, number];
  du: [number, number, number];
  dv: [number, number, number];
}

export interface ConstellationArtAnchor {
  hip: number;
  name: string;
  pos: [number, number];
  uv: [number, number];
  ray: [number, number, number];
}

export interface ConstellationArtSvgMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface ConstellationArtMeta {
  filename: string;
  url: string;
  note?: string | null;
  width?: number;
  height?: number;
  affine?: ConstellationArtAffine;
  anchors?: ConstellationArtAnchor[];
  svgMatrix?: ConstellationArtSvgMatrix;
}

export interface RawConstellation {
  id: string;
  name: string;
  english: string;
  lore: string;
  direction: [number, number, number];
  brightestStar: {
    name: string;
    mag: number;
    dist: number;
  };
  distMin: number;
  distMax: number;
  starCount: number;
  lines: RawLine[];
  stars: RawStar[];
  art?: ConstellationArtMeta;
}

export interface NormalizedStar {
  id: number;
  name: string;
  mag: number;
  ci: number;
  dist: number;
  rawPos: THREE.Vector3;
  unitRay: THREE.Vector3;
  normalizedPos: THREE.Vector3;
  proj2D: { x: number; y: number };
}

export interface NormalizedLine {
  s1_id: number;
  s2_id: number;
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  proj2D_p1: { x: number; y: number };
  proj2D_p2: { x: number; y: number };
}

export interface NormalizedConstellation {
  id: string;
  name: string;
  english: string;
  lore: string;
  brightestStar: {
    name: string;
    mag: number;
    dist: number;
  };
  distMin: number;
  distMax: number;
  starCount: number;
  art?: ConstellationArtMeta;
  bounds2D?: {
    spanU: number;
    spanV: number;
    maxSpan: number;
    centerU: number;
    centerV: number;
  };
  pivot: THREE.Vector3; // C = u_C * 100
  pivotDir: THREE.Vector3; // u_C
  basis: {
    f: THREE.Vector3; // forward = -u_C
    r: THREE.Vector3; // right
    v: THREE.Vector3; // up
  };
  stars: NormalizedStar[];
  lines: NormalizedLine[];
  starPositionsArray: Float32Array;
  starColorsArray: Float32Array;
  starSizesArray: Float32Array;
  linePositionsArray: Float32Array;
}

export interface AnimatedConstellationLineData {
  startPositions: Float32Array;
  endPositions: Float32Array;
  isEnds: Float32Array;
  startTimes: Float32Array;
  durations: Float32Array;
  colors: Float32Array;
  vertexCount: number;
}

export const ORBIT_RADIUS = 100.0;

class StarDataManager {
  private rawConstellations: Record<string, RawConstellation> = {};
  private rawStarfield: Float32Array | null = null;
  private normalizedCache: Map<string, NormalizedConstellation> = new Map();
  private allAnimatedLinesCache: AnimatedConstellationLineData | null = null;
  private loaded: boolean = false;
  private loadPromise: Promise<void> | null = null;

  public async loadData(): Promise<void> {
    if (this.loaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const [constRes, starsRes] = await Promise.all([
          fetch('/data/constellations.json'),
          fetch('/data/stars.json'),
        ]);

        if (!constRes.ok) throw new Error(`Failed to load constellations: ${constRes.statusText}`);
        if (!starsRes.ok) throw new Error(`Failed to load stars: ${starsRes.statusText}`);

        this.rawConstellations = await constRes.json();
        const starsFlat: number[] = await starsRes.json();
        this.rawStarfield = new Float32Array(starsFlat);
        this.loaded = true;
      } catch (err) {
        console.error('Error loading astronomical data:', err);
        throw err;
      }
    })();

    return this.loadPromise;
  }

  public getRawStarfield(): Float32Array | null {
    return this.rawStarfield;
  }

  public getAllConstellations(): RawConstellation[] {
    return Object.values(this.rawConstellations);
  }

  public getConstellationList(): Array<{
    id: string;
    name: string;
    english: string;
    starCount: number;
    brightestStar: string;
  }> {
    return Object.values(this.rawConstellations).map((c) => ({
      id: c.id,
      name: c.name,
      english: c.english,
      starCount: c.starCount,
      brightestStar: c.brightestStar?.name || 'Unknown',
    }));
  }

  public getNormalizedConstellation(id: string): NormalizedConstellation | null {
    if (this.normalizedCache.has(id)) {
      return this.normalizedCache.get(id)!;
    }

    const raw = this.rawConstellations[id];
    if (!raw || !raw.stars || raw.stars.length === 0) return null;

    const normalized = this.computeRayPreservingNormalization(raw);
    this.normalizedCache.set(id, normalized);
    return normalized;
  }

  public getAllNormalizedConstellations(): NormalizedConstellation[] {
    const list: NormalizedConstellation[] = [];
    for (const id of Object.keys(this.rawConstellations)) {
      const norm = this.getNormalizedConstellation(id);
      if (norm) list.push(norm);
    }
    return list;
  }

  /**
   * Precomputes progressive wave graph traversal animated lines for all 88 constellations.
   * Animation propagates from the brightest anchor star of each constellation component simultaneously outwards.
   */
  public getAllConstellationAnimatedLines(): AnimatedConstellationLineData {
    if (this.allAnimatedLinesCache) {
      return this.allAnimatedLinesCache;
    }

    const startPosList: number[] = [];
    const endPosList: number[] = [];
    const isEndList: number[] = [];
    const startTimeList: number[] = [];
    const durationList: number[] = [];
    const colorList: number[] = [];

    const constellations = Object.values(this.rawConstellations);

    for (const c of constellations) {
      if (!c.lines || c.lines.length === 0 || !c.stars || c.stars.length === 0) continue;

      // 1. Map star positions on celestial sphere of radius ORBIT_RADIUS
      const starPosMap = new Map<number, THREE.Vector3>();
      for (const s of c.stars) {
        const u = new THREE.Vector3(s.x, s.y, s.z).normalize().multiplyScalar(ORBIT_RADIUS);
        starPosMap.set(s.id, u);
      }

      // 2. Build adjacency list of star connections
      const adj = new Map<number, number[]>();
      for (const s of c.stars) {
        adj.set(s.id, []);
      }
      for (const l of c.lines) {
        if (!starPosMap.has(l.s1_id) || !starPosMap.has(l.s2_id)) continue;
        adj.get(l.s1_id)?.push(l.s2_id);
        adj.get(l.s2_id)?.push(l.s1_id);
      }

      // 3. Find connected components & run BFS starting from brightest star (min mag)
      const visited = new Set<number>();
      const depth = new Map<number, number>();

      // Sort stars by apparent magnitude (lowest mag = brightest)
      const sortedStars = [...c.stars].sort((a, b) => (a.mag ?? 10) - (b.mag ?? 10));

      for (const rootStar of sortedStars) {
        if (visited.has(rootStar.id)) continue;

        // BFS traversal for this connected component
        const queue: number[] = [rootStar.id];
        visited.add(rootStar.id);
        depth.set(rootStar.id, 0);

        while (queue.length > 0) {
          const curr = queue.shift()!;
          const currDist = depth.get(curr)!;
          const neighbors = adj.get(curr) || [];

          for (const nxt of neighbors) {
            if (!visited.has(nxt)) {
              visited.add(nxt);
              depth.set(nxt, currDist + 1);
              queue.push(nxt);
            }
          }
        }
      }

      // 4. Compute max depth for this constellation and dynamic wave hop duration
      let maxD = 1;
      depth.forEach((d) => {
        if (d > maxD) maxD = d;
      });

      // Synchronized wave duration: between 0.18s and 0.40s per hop
      const hopDuration = Math.min(0.40, 2.6 / Math.max(1, maxD));

      // Luminous celestial violet starlight palette: (0.66, 0.38, 0.98)
      const colR = 0.66;
      const colG = 0.38;
      const colB = 0.98;

      const addSegment = (pA: THREE.Vector3, pB: THREE.Vector3, sTime: number, dur: number) => {
        // Vertex 1 (start of line)
        startPosList.push(pA.x, pA.y, pA.z);
        endPosList.push(pB.x, pB.y, pB.z);
        isEndList.push(0.0);
        startTimeList.push(sTime);
        durationList.push(dur);
        colorList.push(colR, colG, colB);

        // Vertex 2 (end of line)
        startPosList.push(pA.x, pA.y, pA.z);
        endPosList.push(pB.x, pB.y, pB.z);
        isEndList.push(1.0);
        startTimeList.push(sTime);
        durationList.push(dur);
        colorList.push(colR, colG, colB);
      };

      // 5. For each line, animate from root-wards to branch-wards
      for (const l of c.lines) {
        const p1 = starPosMap.get(l.s1_id);
        const p2 = starPosMap.get(l.s2_id);
        if (!p1 || !p2) continue;

        const d1 = depth.get(l.s1_id) ?? 0;
        const d2 = depth.get(l.s2_id) ?? 0;

        if (d1 < d2) {
          // Line starts forming from s1 simultaneously towards s2
          addSegment(p1, p2, d1 * hopDuration, (d2 - d1) * hopDuration);
        } else if (d2 < d1) {
          // Line starts forming from s2 simultaneously towards s1
          addSegment(p2, p1, d2 * hopDuration, (d1 - d2) * hopDuration);
        } else {
          // Both stars reached at the same wave level: split into two halves meeting at midpoint!
          const mid = p1.clone().add(p2).multiplyScalar(0.5);
          addSegment(p1, mid, d1 * hopDuration, hopDuration);
          addSegment(p2, mid, d2 * hopDuration, hopDuration);
        }
      }
    }

    const vertexCount = isEndList.length;
    this.allAnimatedLinesCache = {
      startPositions: new Float32Array(startPosList),
      endPositions: new Float32Array(endPosList),
      isEnds: new Float32Array(isEndList),
      startTimes: new Float32Array(startTimeList),
      durations: new Float32Array(durationList),
      colors: new Float32Array(colorList),
      vertexCount,
    };

    return this.allAnimatedLinesCache;
  }

  private computeRayPreservingNormalization(raw: RawConstellation): NormalizedConstellation {
    const rawStars = raw.stars;
    const count = rawStars.length;

    // Step 1: Unit Earth Rays
    const starRays: Array<{
      raw: RawStar;
      rawPos: THREE.Vector3;
      unitRay: THREE.Vector3;
      dist: number;
    }> = [];

    const sumRay = new THREE.Vector3(0, 0, 0);
    const distances: number[] = [];

    for (let i = 0; i < count; i++) {
      const s = rawStars[i];
      const pos = new THREE.Vector3(s.x, s.y, s.z);
      const d = pos.length() || (s.dist > 0 ? s.dist : 100.0);
      const u = pos.clone().normalize();

      starRays.push({
        raw: s,
        rawPos: pos,
        unitRay: u,
        dist: d,
      });

      sumRay.add(u);
      distances.push(d);
    }

    // Step 2: Constellation Pivot Center C = u_C * 100
    const pivotDir = sumRay.normalize();
    const pivot = pivotDir.clone().multiplyScalar(ORBIT_RADIUS);

    // Step 3: Orthonormal Basis
    // Forward axis f = -u_C (from C looking back at Earth 0,0,0)
    const f = pivotDir.clone().negate().normalize();

    // Up axis v = normalize(N_pole - (N_pole . f) * f)
    let nPole = new THREE.Vector3(0, 0, 1);
    if (Math.abs(nPole.dot(f)) > 0.98) {
      nPole = new THREE.Vector3(0, 1, 0);
    }
    const dotPoleF = nPole.dot(f);
    const v = nPole.clone().sub(f.clone().multiplyScalar(dotPoleF)).normalize();

    // Right axis r = pivotDir x v (Observer's right on screen looking towards constellation, points West)
    const r = new THREE.Vector3().crossVectors(pivotDir, v).normalize();

    // Step 4: Bounded Depth Mapping Delta d_i in [-30, +30]
    const meanD = distances.reduce((a, b) => a + b, 0) / count;
    const variance = distances.reduce((acc, d) => acc + (d - meanD) ** 2, 0) / count;
    const sigmaD = Math.sqrt(variance);
    const distMin = Math.min(...distances);
    const distMax = Math.max(...distances);
    const distRange = distMax - distMin;

    const starMap = new Map<number, NormalizedStar>();
    const normalizedStars: NormalizedStar[] = [];

    // Precalculate 2D projected coordinates for silhouette normalization
    const projected2D: Array<{ u2d: number; v2d: number }> = [];

    for (let i = 0; i < count; i++) {
      const { raw: s, rawPos, unitRay, dist } = starRays[i];
      let deltaD = 0;

      if (sigmaD > 0.05 && distRange > 0.5) {
        const spread = Math.max(sigmaD, distRange / 3.5);
        const z = (dist - meanD) / spread;
        deltaD = Math.max(-30.0, Math.min(30.0, z * 24.0));
      } else {
        // Deterministic pseudo-random offset seeded by star ID
        const hash = ((s.id * 9301 + 49297) % 233280) / 233280.0;
        deltaD = (hash - 0.5) * 50.0; // [-25, +25]
      }

      // Ray-locked puzzle coordinates: P'_i = u_i * (R_orbit + Delta d_i)
      const normalizedPos = unitRay.clone().multiplyScalar(ORBIT_RADIUS + deltaD);

      // Project unit ray onto Earth's view plane basis (r, v)
      const u2d = unitRay.dot(r);
      const v2d = unitRay.dot(v);
      projected2D.push({ u2d, v2d });

      const normStar: NormalizedStar = {
        id: s.id,
        name: s.name || `HIP ${s.hip || s.id}`,
        mag: s.mag,
        ci: s.ci,
        dist: s.dist,
        rawPos,
        unitRay,
        normalizedPos,
        proj2D: { x: 0, y: 0 }, // Assigned after normalization below
      };

      starMap.set(s.id, normStar);
      normalizedStars.push(normStar);
    }

    // Normalize 2D projection into [0.1, 0.9] box for reference silhouette
    let minU = Infinity,
      maxU = -Infinity,
      minV = Infinity,
      maxV = -Infinity;

    projected2D.forEach(({ u2d, v2d }) => {
      if (u2d < minU) minU = u2d;
      if (u2d > maxU) maxU = u2d;
      if (v2d < minV) minV = v2d;
      if (v2d > maxV) maxV = v2d;
    });

    const spanU = Math.max(0.001, maxU - minU);
    const spanV = Math.max(0.001, maxV - minV);
    const maxSpan = Math.max(spanU, spanV);
    const centerU = (minU + maxU) / 2;
    const centerV = (minV + maxV) / 2;

    normalizedStars.forEach((star, idx) => {
      const { u2d, v2d } = projected2D[idx];
      // Map to [-0.38, 0.38] then +0.5 => [0.12, 0.88]
      const nx = 0.5 + ((u2d - centerU) / maxSpan) * 0.76;
      // Invert Y for standard 2D canvas/SVG (0 top, 1 bottom)
      const ny = 0.5 - ((v2d - centerV) / maxSpan) * 0.76;
      star.proj2D = { x: nx, y: ny };
    });

    // Step 5: Construct Dynamic 3D Lines using normalized star positions
    const normalizedLines: NormalizedLine[] = [];
    const linePositions: number[] = [];

    raw.lines.forEach((l) => {
      const s1 = starMap.get(l.s1_id);
      const s2 = starMap.get(l.s2_id);
      if (s1 && s2) {
        normalizedLines.push({
          s1_id: s1.id,
          s2_id: s2.id,
          p1: s1.normalizedPos.clone(),
          p2: s2.normalizedPos.clone(),
          proj2D_p1: { ...s1.proj2D },
          proj2D_p2: { ...s2.proj2D },
        });

        linePositions.push(
          s1.normalizedPos.x,
          s1.normalizedPos.y,
          s1.normalizedPos.z,
          s2.normalizedPos.x,
          s2.normalizedPos.y,
          s2.normalizedPos.z
        );
      }
    });

    // Step 6: Star buffer arrays for WebGL rendering
    const starPositionsArray = new Float32Array(count * 3);
    const starColorsArray = new Float32Array(count * 3);
    const starSizesArray = new Float32Array(count);

    normalizedStars.forEach((s, idx) => {
      starPositionsArray[idx * 3] = s.normalizedPos.x;
      starPositionsArray[idx * 3 + 1] = s.normalizedPos.y;
      starPositionsArray[idx * 3 + 2] = s.normalizedPos.z;

      // Realistic stellar color from B-V index
      const color = bvToRgb(s.ci);
      starColorsArray[idx * 3] = color.r;
      starColorsArray[idx * 3 + 1] = color.g;
      starColorsArray[idx * 3 + 2] = color.b;

      // Inverse magnitude sizing
      starSizesArray[idx] = Math.max(16.0, (7.0 - s.mag) * 7.5);
    });

    return {
      id: raw.id,
      name: raw.name,
      english: raw.english,
      lore: raw.lore,
      brightestStar: raw.brightestStar,
      distMin: raw.distMin,
      distMax: raw.distMax,
      starCount: count,
      art: raw.art || {
        filename: `${raw.name.toLowerCase().replace(/ /g, '_')}.png`,
        url: `/sky_art-1/${raw.name.toLowerCase().replace(/ /g, '_')}.png`,
      },
      bounds2D: {
        spanU,
        spanV,
        maxSpan,
        centerU,
        centerV,
      },
      pivot,
      pivotDir,
      basis: { f, r, v },
      stars: normalizedStars,
      lines: normalizedLines,
      starPositionsArray,
      starColorsArray,
      starSizesArray,
      linePositionsArray: new Float32Array(linePositions),
    };
  }
}

/**
 * Realistic B-V color index to RGB temperature conversion
 */
export function bvToRgb(bv: number): { r: number; g: number; b: number } {
  const clampBv = Math.max(-0.4, Math.min(2.0, bv));

  // Temperature approximation based on Ballesteros (2012)
  let r = 1.0;
  let g = 1.0;
  let b = 1.0;

  if (clampBv < 0.0) {
    // Hot blue star (e.g. O/B type: Spica, Rigel)
    r = 0.62 + 0.38 * (clampBv + 0.4) / 0.4;
    g = 0.72 + 0.28 * (clampBv + 0.4) / 0.4;
    b = 1.0;
  } else if (clampBv < 0.4) {
    // Blue-white to white (A type: Vega, Sirius, Deneb)
    const t = clampBv / 0.4;
    r = 0.82 + 0.18 * t;
    g = 0.88 + 0.12 * t;
    b = 1.0;
  } else if (clampBv < 0.8) {
    // Yellow-white (F/G type: Sun, Capella)
    const t = (clampBv - 0.4) / 0.4;
    r = 1.0;
    g = 1.0 - 0.15 * t;
    b = 0.95 - 0.35 * t;
  } else if (clampBv < 1.4) {
    // Orange (K type: Arcturus, Aldebaran)
    const t = (clampBv - 0.8) / 0.6;
    r = 1.0;
    g = 0.85 - 0.3 * t;
    b = 0.6 - 0.35 * t;
  } else {
    // Red supergiant (M type: Betelgeuse, Antares)
    const t = (clampBv - 1.4) / 0.6;
    r = 1.0;
    g = 0.55 - 0.15 * t;
    b = 0.25 - 0.1 * t;
  }

  return { r, g, b };
}

export const starDataManager = new StarDataManager();
