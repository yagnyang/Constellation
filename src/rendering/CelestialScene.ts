import * as THREE from 'three';
import {
  NormalizedConstellation,
  bvToRgb,
  AnimatedConstellationLineData,
  AllConstellationStarData,
} from '../core/StarDataManager';
import { GameState } from '../core/OrbitalCameraController';
import {
  BACKGROUND_STAR_VERTEX_SHADER,
  BACKGROUND_STAR_FRAGMENT_SHADER,
  CONSTELLATION_PIXEL_STAR_VERTEX_SHADER,
  CONSTELLATION_PIXEL_STAR_FRAGMENT_SHADER,
  CONSTELLATION_LINE_VERTEX_SHADER,
  CONSTELLATION_LINE_FRAGMENT_SHADER,
  ALL_CONSTELLATION_LINES_VERTEX_SHADER,
  ALL_CONSTELLATION_LINES_FRAGMENT_SHADER,
  GHOST_GUIDE_LINE_VERTEX_SHADER,
  GHOST_GUIDE_LINE_FRAGMENT_SHADER,
} from './StarShaders';
import { createPixelStarTexture, createStarGlowTexture } from './PixelStarTextures';

interface StarNodeItem {
  pixelSprite: THREE.Sprite;
  glowSprite: THREE.Sprite;
  pixelMat: THREE.SpriteMaterial;
  glowMat: THREE.SpriteMaterial;
  baseScale: number;
  twinklePhase: number;
}

export class CelestialScene {
  private container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  // Background starfield (Points mesh)
  private backgroundStarsMesh: THREE.Points | null = null;
  private backgroundStarsMat: THREE.ShaderMaterial | null = null;

  // Pixel-art star textures (blue for Sky View, yellow for Puzzle/Preview)
  private blueStarTex: THREE.CanvasTexture;
  private yellowStarTex: THREE.CanvasTexture;
  private yellowGlowTex: THREE.CanvasTexture;

  // All 88 constellations' stars highlighted in blue in free Sky View
  private allConstellationStarsMesh: THREE.Points | null = null;
  private allConstellationStarsMat: THREE.ShaderMaterial | null = null;
  private allConstellationStarsOpacity: number = 1.0;

  // Active constellation puzzle objects
  // 1. Yellow pixel point stars (used in PREVIEW & crossfade into DISPLACE)
  private activeStarsMesh: THREE.Points | null = null;
  private activeStarsMat: THREE.ShaderMaterial | null = null;

  // 2. 3D Yellow Pixel Star Sprites (used ONLY when solving in 3D orbit)
  private starSpheresGroup: THREE.Group;
  private starSphereItems: StarNodeItem[] = [];

  // 3. Constellation puzzle lines
  private activeLinesMesh: THREE.LineSegments | null = null;
  private activeLinesMat: THREE.ShaderMaterial | null = null;

  // 4. All constellations sky view animated lines
  private allLinesMesh: THREE.LineSegments | null = null;
  private allLinesMat: THREE.ShaderMaterial | null = null;
  private allLinesVisible: boolean = false;
  private allLinesAnimTime: number = 0;
  private allLinesOpacity: number = 0;

  // 5. Quiz Target Alignment Ghost Guide lines (attached to camera)
  private ghostGuideMesh: THREE.LineSegments | null = null;
  private ghostGuideMat: THREE.ShaderMaterial | null = null;
  private showGhostGuide: boolean = false;

  // 6. Constellation Art Textured Meshes on Celestial Sphere (prioritized + background preloaded)
  private constellationArtGroup: THREE.Group;
  private allArtMeshes: Map<string, THREE.Mesh> = new Map();
  private allArtUrls: Map<string, string> = new Map();
  private loadedArtIds: Set<string> = new Set();
  private loadingArtIds: Set<string> = new Set();
  private preloadQueue: string[] = [];
  private preloadActiveCount: number = 0;
  private preloadTimerId: ReturnType<typeof setTimeout> | null = null;
  private isDisposed: boolean = false;
  private textureLoader: THREE.TextureLoader = new THREE.TextureLoader();
  private activeConstellationId: string | null = null;
  private allArtVisible: boolean = false;
  private allArtOpacity: number = 0;

  // Dynamic per-constellation camera FOV framing
  private readonly defaultHubFov: number = 60;
  private currentFov: number = 60;
  private activeBounds2D: {
    maxTanX: number;
    maxTanY: number;
    artMaxTanX?: number;
    artMaxTanY?: number;
  } | null = null;

  // Solved constellations permanent display in celestial sphere
  private solvedGroup: THREE.Group;
  private solvedConstellationsMap: Map<string, THREE.LineSegments> = new Map();

  private clock: THREE.Clock = new THREE.Clock();
  private lastRenderTime: number = 0;
  private pixelRatio: number = 1.0;

  constructor(container: HTMLElement) {
    this.container = container;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000104); // Deep cosmic void black for maximum star contrast

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 50000);
    this.camera.position.set(0, 0, 0);
    this.camera.up.set(0, 0, 1);
    this.scene.add(this.camera); // Add camera to scene so camera-parented guide lines render properly!

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.38; // Increased exposure for brilliant radiant stars

    this.container.appendChild(this.renderer.domElement);

    // Groups
    this.solvedGroup = new THREE.Group();
    this.scene.add(this.solvedGroup);

    this.starSpheresGroup = new THREE.Group();
    this.starSpheresGroup.visible = false; // Hidden by default, shown ONLY when solving!
    this.scene.add(this.starSpheresGroup);

    this.constellationArtGroup = new THREE.Group();
    this.constellationArtGroup.visible = false;
    this.scene.add(this.constellationArtGroup);

    // Crisp 8-bit 4-point diamond star textures (blue in free view, yellow in puzzle)
    this.blueStarTex = createPixelStarTexture('blue');
    this.yellowStarTex = createPixelStarTexture('yellow');
    this.yellowGlowTex = createStarGlowTexture('yellow');
  }

  /**
   * Builds the realistic HYG background starfield points mesh (crisp, bright pinpoint stars)
   */
  public initBackgroundStarfield(starfieldData: Float32Array) {
    if (this.backgroundStarsMesh) {
      this.scene.remove(this.backgroundStarsMesh);
      this.backgroundStarsMesh.geometry.dispose();
      this.backgroundStarsMesh = null;
    }

    const starCount = Math.floor(starfieldData.length / 5);
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const alphas = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const idx5 = i * 5;
      const x = starfieldData[idx5];
      const y = starfieldData[idx5 + 1];
      const z = starfieldData[idx5 + 2];
      const mag = starfieldData[idx5 + 3];
      const ci = starfieldData[idx5 + 4];

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const rgb = bvToRgb(ci);
      colors[i * 3] = rgb.r;
      colors[i * 3 + 1] = rgb.g;
      colors[i * 3 + 2] = rgb.b;

      // Compact pinpoint sizing with enhanced brightness across all naked-eye magnitudes
      sizes[i] = Math.max(1.2, (7.6 - mag) * 1.45);
      alphas[i] = Math.max(0.68, Math.min(1.0, 1.08 - (mag - 0.5) / 8.5));
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

    this.backgroundStarsMat = new THREE.ShaderMaterial({
      vertexShader: BACKGROUND_STAR_VERTEX_SHADER,
      fragmentShader: BACKGROUND_STAR_FRAGMENT_SHADER,
      uniforms: {
        uCamPos: { value: new THREE.Vector3() },
        uDimFactor: { value: 1.0 },
        uPixelRatio: { value: this.pixelRatio },
        uTime: { value: 0.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.backgroundStarsMesh = new THREE.Points(geo, this.backgroundStarsMat);
    this.scene.add(this.backgroundStarsMesh);
  }

  /**
   * Highlights the stars of all 88 constellations in free Sky View using crisp blue pixel stars.
   */
  public initAllConstellationStars(data: AllConstellationStarData) {
    if (this.allConstellationStarsMesh) {
      this.scene.remove(this.allConstellationStarsMesh);
      this.allConstellationStarsMesh.geometry.dispose();
      this.allConstellationStarsMat?.dispose();
      this.allConstellationStarsMesh = null;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(data.sizes, 1));

    this.allConstellationStarsMat = new THREE.ShaderMaterial({
      vertexShader: CONSTELLATION_PIXEL_STAR_VERTEX_SHADER,
      fragmentShader: CONSTELLATION_PIXEL_STAR_FRAGMENT_SHADER,
      uniforms: {
        uStarTex: { value: this.blueStarTex },
        uGlowColor: { value: new THREE.Color(0x00d4ff) },
        uPixelRatio: { value: this.pixelRatio },
        uTime: { value: 0.0 },
        uOpacity: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
    });

    this.allConstellationStarsMesh = new THREE.Points(geo, this.allConstellationStarsMat);
    this.allConstellationStarsMesh.renderOrder = 5;
    this.allConstellationStarsMesh.frustumCulled = false;
    this.scene.add(this.allConstellationStarsMesh);
  }

  /**
   * Sets up the active constellation:
   * 1. Yellow pixel point stars (used in PREVIEW & crossfade into DISPLACE)
   * 2. 3D Yellow Pixel Star Sprites (activated ONLY when solving in 3D orbit!)
   * 3. Geometric connection lines
   */
  public setActiveConstellation(constellation: NormalizedConstellation) {
    this.activeConstellationId = constellation.id;
    this.activeBounds2D = constellation.bounds2D
      ? {
          maxTanX: constellation.bounds2D.maxTanX,
          maxTanY: constellation.bounds2D.maxTanY,
          artMaxTanX: constellation.bounds2D.artMaxTanX,
          artMaxTanY: constellation.bounds2D.artMaxTanY,
        }
      : null;

    // Lazy-load active constellation art texture on demand
    this.ensureArtTextureLoaded(constellation.id);

    // 1. Clean up previous 3D star sprites
    this.clearStarSpheres();

    // 2. Active constellation yellow pixel stars (Preview & Displace crossfade)
    if (this.activeStarsMesh) {
      this.scene.remove(this.activeStarsMesh);
      this.activeStarsMesh.geometry.dispose();
      this.activeStarsMat?.dispose();
      this.activeStarsMesh = null;
    }

    const previewSizes = new Float32Array(constellation.stars.length);
    constellation.stars.forEach((star, idx) => {
      const mag = Number.isFinite(star.mag) ? star.mag : 4.0;
      previewSizes[idx] = Math.max(18.0, Math.min(34.0, (6.5 - mag) * 4.5 + 15.0));
    });

    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute('position', new THREE.BufferAttribute(constellation.starPositionsArray, 3));
    starsGeo.setAttribute('aSize', new THREE.BufferAttribute(previewSizes, 1));

    this.activeStarsMat = new THREE.ShaderMaterial({
      vertexShader: CONSTELLATION_PIXEL_STAR_VERTEX_SHADER,
      fragmentShader: CONSTELLATION_PIXEL_STAR_FRAGMENT_SHADER,
      uniforms: {
        uStarTex: { value: this.yellowStarTex },
        uGlowColor: { value: new THREE.Color(0xfacc15) },
        uPixelRatio: { value: this.pixelRatio },
        uTime: { value: 0.0 },
        uOpacity: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
    });

    this.activeStarsMesh = new THREE.Points(starsGeo, this.activeStarsMat);
    this.activeStarsMesh.renderOrder = 6;
    this.activeStarsMesh.frustumCulled = false;
    this.scene.add(this.activeStarsMesh);

    // 3. Create 3D Yellow Pixel Star Sprites for solving mode
    constellation.stars.forEach((star) => {
      const mag = Number.isFinite(star.mag) ? star.mag : 4.0;
      const baseScale = Math.max(2.8, Math.min(6.4, 6.0 - (mag - 0.5) * 0.85));

      const glowMat = new THREE.SpriteMaterial({
        map: this.yellowGlowTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
      });

      const glowSprite = new THREE.Sprite(glowMat);
      glowSprite.position.copy(star.normalizedPos);
      glowSprite.scale.setScalar(baseScale * 1.9);
      glowSprite.renderOrder = 6;

      const pixelMat = new THREE.SpriteMaterial({
        map: this.yellowStarTex,
        color: 0xffffff,
        transparent: true,
        alphaTest: 0.5,
        depthWrite: true,
        depthTest: true,
        toneMapped: false,
      });

      const pixelSprite = new THREE.Sprite(pixelMat);
      pixelSprite.position.copy(star.normalizedPos);
      pixelSprite.scale.setScalar(baseScale);
      pixelSprite.renderOrder = 7;

      this.starSpheresGroup.add(glowSprite);
      this.starSpheresGroup.add(pixelSprite);

      this.starSphereItems.push({
        pixelSprite,
        glowSprite,
        pixelMat,
        glowMat,
        baseScale,
        twinklePhase: (star.id * 1.6180339) % (Math.PI * 2),
      });
    });

    // Start with puzzle star sprites hidden; shown ONLY when entering solving mode
    this.starSpheresGroup.visible = false;

    // 4. Active puzzle lines
    if (this.activeLinesMesh) {
      this.scene.remove(this.activeLinesMesh);
      this.activeLinesMesh.geometry.dispose();
      this.activeLinesMat?.dispose();
      this.activeLinesMesh = null;
    }

    const linesGeo = new THREE.BufferGeometry();
    linesGeo.setAttribute('position', new THREE.BufferAttribute(constellation.linePositionsArray, 3));

    this.activeLinesMat = new THREE.ShaderMaterial({
      vertexShader: CONSTELLATION_LINE_VERTEX_SHADER,
      fragmentShader: CONSTELLATION_LINE_FRAGMENT_SHADER,
      uniforms: {
        uColor: { value: new THREE.Color(0xa855f7) }, // Luminous celestial purple
        uLineOpacity: { value: 0.0 },
        uTime: { value: 0.0 },
        uAccuracy: { value: 0.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.activeLinesMesh = new THREE.LineSegments(linesGeo, this.activeLinesMat);
    this.activeLinesMesh.renderOrder = 4;
    this.scene.add(this.activeLinesMesh);

    // 5. Setup Quiz Target Ghost Guide Line Mesh (attached to camera)
    if (this.ghostGuideMesh) {
      this.camera.remove(this.ghostGuideMesh);
      this.ghostGuideMesh.geometry.dispose();
      this.ghostGuideMat?.dispose();
      this.ghostGuideMesh = null;
    }

    const { pivotDir, basis } = constellation;
    const D = 45.0; // Distance in front of camera
    const ghostPositions: number[] = [];
    const lineLengths: number[] = [];

    constellation.lines.forEach((l) => {
      const s1 = constellation.stars.find((s) => s.id === l.s1_id);
      const s2 = constellation.stars.find((s) => s.id === l.s2_id);
      if (s1 && s2) {
        const d1 = s1.unitRay.dot(pivotDir);
        const d2 = s2.unitRay.dot(pivotDir);
        if (d1 > 0.01 && d2 > 0.01) {
          const t1 = D / d1;
          const t2 = D / d2;
          const x1 = t1 * s1.unitRay.dot(basis.r);
          const y1 = t1 * s1.unitRay.dot(basis.v);
          const z1 = -D;

          const x2 = t2 * s2.unitRay.dot(basis.r);
          const y2 = t2 * s2.unitRay.dot(basis.v);
          const z2 = -D;

          ghostPositions.push(x1, y1, z1, x2, y2, z2);
          lineLengths.push(0.0, 1.0);
        }
      }
    });

    const ghostGeo = new THREE.BufferGeometry();
    ghostGeo.setAttribute('position', new THREE.Float32BufferAttribute(ghostPositions, 3));
    ghostGeo.setAttribute('aLineLength', new THREE.Float32BufferAttribute(lineLengths, 1));

    this.ghostGuideMat = new THREE.ShaderMaterial({
      vertexShader: GHOST_GUIDE_LINE_VERTEX_SHADER,
      fragmentShader: GHOST_GUIDE_LINE_FRAGMENT_SHADER,
      uniforms: {
        uColor: { value: new THREE.Color(0xa855f7) }, // Luminous celestial purple
        uOpacity: { value: 0.5 },
        uTime: { value: 0.0 },
        uAccuracy: { value: 0.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.ghostGuideMesh = new THREE.LineSegments(ghostGeo, this.ghostGuideMat);
    this.ghostGuideMesh.visible = false;
    this.camera.add(this.ghostGuideMesh);
  }

  /**
   * Initializes the animated lines for all 88 constellations across the celestial sky
   */
  public initAllConstellationLines(data: AnimatedConstellationLineData) {
    if (this.allLinesMesh) {
      this.scene.remove(this.allLinesMesh);
      this.allLinesMesh.geometry.dispose();
      this.allLinesMat?.dispose();
      this.allLinesMesh = null;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.startPositions, 3));
    geo.setAttribute('aStartPos', new THREE.BufferAttribute(data.startPositions, 3));
    geo.setAttribute('aEndPos', new THREE.BufferAttribute(data.endPositions, 3));
    geo.setAttribute('aIsEnd', new THREE.BufferAttribute(data.isEnds, 1));
    geo.setAttribute('aStartTime', new THREE.BufferAttribute(data.startTimes, 1));
    geo.setAttribute('aDuration', new THREE.BufferAttribute(data.durations, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(data.colors, 3));

    this.allLinesMat = new THREE.ShaderMaterial({
      vertexShader: ALL_CONSTELLATION_LINES_VERTEX_SHADER,
      fragmentShader: ALL_CONSTELLATION_LINES_FRAGMENT_SHADER,
      uniforms: {
        uAnimTime: { value: 0.0 },
        uGlobalOpacity: { value: 0.0 },
        uTime: { value: 0.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.allLinesMesh = new THREE.LineSegments(geo, this.allLinesMat);
    this.allLinesMesh.visible = false;
    this.scene.add(this.allLinesMesh);
  }

  public setAllConstellationLinesVisible(visible: boolean, restartAnimation: boolean = false) {
    this.allLinesVisible = visible;
    this.allArtVisible = visible; // Lines button also turns constellation artwork on
    if (visible) {
      this.ensureAllArtTexturesLoaded();
    }
    if (restartAnimation || (visible && this.allLinesAnimTime === 0)) {
      this.allLinesAnimTime = 0.0;
    }
  }

  public setAllConstellationArtVisible(visible: boolean) {
    this.allArtVisible = visible;
    if (visible) {
      this.ensureAllArtTexturesLoaded();
    }
  }

  private ensureArtTextureLoaded(id: string, onDone?: () => void) {
    if (this.isDisposed) {
      onDone?.();
      return;
    }
    if (this.loadedArtIds.has(id) || this.loadingArtIds.has(id)) {
      onDone?.();
      return;
    }
    const mesh = this.allArtMeshes.get(id);
    const url = this.allArtUrls.get(id);
    if (!mesh || !url) {
      onDone?.();
      return;
    }

    this.loadingArtIds.add(id);
    this.textureLoader.setCrossOrigin('anonymous');
    this.textureLoader.load(
      url,
      (texture) => {
        this.loadingArtIds.delete(id);
        if (this.isDisposed || !this.allArtMeshes.has(id)) {
          texture.dispose();
          onDone?.();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        if (mat.map && mat.map !== texture) {
          mat.map.dispose();
        }
        mat.map = texture;
        mat.needsUpdate = true;
        this.loadedArtIds.add(id);
        onDone?.();
      },
      undefined,
      () => {
        // Allow retry on subsequent selection or preload pass instead of permanently locking out
        this.loadingArtIds.delete(id);
        onDone?.();
      }
    );
  }

  /**
   * Immediately prioritizes loading one or more constellation artwork textures (e.g. upcoming arcade stages).
   */
  public preloadConstellationArt(ids: string[]) {
    for (const id of ids) {
      if (id && !this.loadedArtIds.has(id) && !this.loadingArtIds.has(id)) {
        this.ensureArtTextureLoaded(id);
      }
    }
  }

  private pumpPreloadQueue() {
    if (this.isDisposed) return;
    const MAX_CONCURRENT = 6;
    while (this.preloadActiveCount < MAX_CONCURRENT && this.preloadQueue.length > 0) {
      const nextId = this.preloadQueue.shift()!;
      if (this.loadedArtIds.has(nextId) || this.loadingArtIds.has(nextId)) {
        continue;
      }
      this.preloadActiveCount++;
      this.ensureArtTextureLoaded(nextId, () => {
        this.preloadActiveCount = Math.max(0, this.preloadActiveCount - 1);
        if (!this.isDisposed && this.preloadQueue.length > 0) {
          this.pumpPreloadQueue();
        }
      });
    }
  }

  private startBackgroundArtPreload() {
    if (this.preloadTimerId) {
      clearTimeout(this.preloadTimerId);
      this.preloadTimerId = null;
    }
    const ids = Array.from(this.allArtMeshes.keys()).filter(
      (id) => !this.loadedArtIds.has(id) && !this.loadingArtIds.has(id)
    );
    // Prioritize active constellation first if present
    if (this.activeConstellationId) {
      const idx = ids.indexOf(this.activeConstellationId);
      if (idx > 0) {
        ids.splice(idx, 1);
        ids.unshift(this.activeConstellationId);
      }
    }
    this.preloadQueue = ids;
    this.pumpPreloadQueue();
  }

  private ensureAllArtTexturesLoaded() {
    this.startBackgroundArtPreload();
  }

  public isAllConstellationArtVisible(): boolean {
    return this.allArtVisible;
  }

  /**
   * Initializes textured 3D artwork plates for all 88 constellations on the celestial sphere
   */
  public initAllConstellationArt(constellations: NormalizedConstellation[]) {
    // Clear any previous meshes and textures
    this.allArtMeshes.forEach((mesh) => {
      this.constellationArtGroup.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => {
          (m as THREE.MeshBasicMaterial).map?.dispose();
          m.dispose();
        });
      } else {
        (mesh.material as THREE.MeshBasicMaterial).map?.dispose();
        mesh.material.dispose();
      }
    });
    this.allArtMeshes.clear();
    this.allArtUrls.clear();
    this.loadedArtIds.clear();
    this.loadingArtIds.clear();
    this.preloadQueue = [];
    this.preloadActiveCount = 0;

    const R = 98.2; // Positioned right along the celestial sphere of radius 100

    for (const c of constellations) {
      const artUrl = c.art?.url || `/sky_art-1/${c.name.toLowerCase().replace(/ /g, '_')}.png`;
      this.allArtUrls.set(c.id, artUrl);

      let meshGeo: THREE.BufferGeometry;
      const meshPos = new THREE.Vector3(0, 0, 0);
      const meshQuat = new THREE.Quaternion();

      if (c.art?.affine) {
        // Mathematically exact alignment anchored to Stellarium reference stars
        meshGeo = this.createConstellationArtGeometry(c.art.affine, R, 8);
      } else {
        // Fallback to bounding box approximation
        const { pivotDir, basis, bounds2D } = c;
        const { r, v } = basis;

        const maxSpan = bounds2D ? bounds2D.maxSpan : 0.4;
        const centerU = bounds2D ? bounds2D.centerU : 0.0;
        const centerV = bounds2D ? bounds2D.centerV : 0.0;

        const planeSize = Math.max(16.0, maxSpan * R * 1.35);
        meshGeo = new THREE.PlaneGeometry(planeSize, planeSize);

        const centerDir = pivotDir.clone()
          .addScaledVector(r, centerU)
          .addScaledVector(v, centerV)
          .normalize();
        meshPos.copy(centerDir.clone().multiplyScalar(R));

        const N = centerDir.clone().negate().normalize();
        let nPole = new THREE.Vector3(0, 0, 1);
        if (Math.abs(nPole.dot(N)) > 0.98) {
          nPole = new THREE.Vector3(0, 1, 0);
        }
        const U = nPole.clone().sub(N.clone().multiplyScalar(nPole.dot(N))).normalize();
        const R_tan = new THREE.Vector3().crossVectors(centerDir, U).normalize();
        const rotMatrix = new THREE.Matrix4().makeBasis(R_tan, U, N);
        meshQuat.setFromRotationMatrix(rotMatrix);
      }

      const mat = new THREE.MeshBasicMaterial({
        map: null,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        color: new THREE.Color(0xa78bfa), // Celestial starlight violet
      });

      const mesh = new THREE.Mesh(meshGeo, mat);
      mesh.position.copy(meshPos);
      mesh.quaternion.copy(meshQuat);
      mesh.renderOrder = 2;

      this.constellationArtGroup.add(mesh);
      this.allArtMeshes.set(c.id, mesh);
    }

    if (this.activeConstellationId) {
      this.ensureArtTextureLoaded(this.activeConstellationId);
    }
    // Warm all 88 small (~24KB) constellation art textures in batched background chunks
    // so art is already cached before PREVIEW, ALIGN_PUZZLE, RESOLVED, or Art toggle.
    this.preloadTimerId = setTimeout(() => {
      this.preloadTimerId = null;
      this.startBackgroundArtPreload();
    }, 150);
  }

  /**
   * Generates a curved spherical quad mesh conforming to the celestial sphere of radius R,
   * mapped mathematically using the 3-anchor affine alignment from Stellarium.
   */
  private createConstellationArtGeometry(
    affine: { p0: [number, number, number]; du: [number, number, number]; dv: [number, number, number] },
    R: number = 98.2,
    segments: number = 8
  ): THREE.BufferGeometry {
    const p0 = new THREE.Vector3(...affine.p0);
    const du = new THREE.Vector3(...affine.du);
    const dv = new THREE.Vector3(...affine.dv);

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const N = segments;
    for (let j = 0; j <= N; j++) {
      const v = j / N;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        // Point on tangent affine plane
        const px = p0.x + u * du.x + v * dv.x;
        const py = p0.y + u * du.y + v * dv.y;
        const pz = p0.z + u * du.z + v * dv.z;
        const len = Math.sqrt(px * px + py * py + pz * pz) || 1.0;

        // Project directly onto celestial sphere of radius R
        positions.push((px / len) * R, (py / len) * R, (pz / len) * R);
        uvs.push(u, v);
      }
    }

    const rowStride = N + 1;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const v00 = j * rowStride + i;
        const v10 = j * rowStride + (i + 1);
        const v01 = (j + 1) * rowStride + i;
        const v11 = (j + 1) * rowStride + (i + 1);

        // Two triangles covering the quad cell
        indices.push(v00, v10, v11);
        indices.push(v00, v11, v01);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  public replayAllLinesAnimation() {
    this.allLinesVisible = true;
    this.allLinesAnimTime = 0.0;
  }

  public setShowGhostGuide(visible: boolean) {
    this.showGhostGuide = visible;
  }

  private clearStarSpheres() {
    this.starSphereItems.forEach((item) => {
      this.starSpheresGroup.remove(item.pixelSprite);
      this.starSpheresGroup.remove(item.glowSprite);
      item.pixelMat.dispose();
      item.glowMat.dispose();
    });
    this.starSphereItems = [];
  }

  /**
   * Adds or updates a solved constellation with permanent connection lines in the sky
   */
  public markConstellationSolved(constellation: NormalizedConstellation) {
    if (this.solvedConstellationsMap.has(constellation.id)) return;

    const linesGeo = new THREE.BufferGeometry();
    linesGeo.setAttribute('position', new THREE.BufferAttribute(constellation.linePositionsArray, 3));

    const lineMat = new THREE.LineBasicMaterial({
      color: 0x9333ea,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    const mesh = new THREE.LineSegments(linesGeo, lineMat);
    this.solvedGroup.add(mesh);
    this.solvedConstellationsMap.set(constellation.id, mesh);
  }

  /**
   * Render loop:
   * - In EARTH_HUB / PREVIEW (sky view): Star spheres are HIDDEN. Stars are rendered as realistic points.
   * - In DISPLACE: Smoothly crossfades points out while scaling 3D star spheres in.
   * - In ALIGN_PUZZLE / RESOLVED (solving it): 3D Star Spheres are active, points are hidden!
   */
  public render(
    dimFactor: number,
    lineOpacity: number,
    gameState: GameState = 'EARTH_HUB',
    displaceProgress: number = 0,
    accuracy: number = 0
  ) {
    const now = performance.now();
    const deltaSec = this.lastRenderTime > 0 ? Math.min(0.1, (now - this.lastRenderTime) / 1000) : 0.016;
    this.lastRenderTime = now;
    const elapsedTime = this.clock.getElapsedTime();

    // Dynamic per-constellation camera FOV framing (returns to 60 deg in Sky View)
    const targetFov = this.computeTargetFov(gameState);
    const fovLerp = 1.0 - Math.exp(-5.5 * deltaSec);
    this.currentFov += (targetFov - this.currentFov) * fovLerp;
    if (Math.abs(this.currentFov - this.camera.fov) > 0.02) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    // 1. Update background starfield
    if (this.backgroundStarsMat) {
      this.backgroundStarsMat.uniforms.uCamPos.value.copy(this.camera.position);
      this.backgroundStarsMat.uniforms.uDimFactor.value = dimFactor;
      this.backgroundStarsMat.uniforms.uPixelRatio.value = this.pixelRatio;
      this.backgroundStarsMat.uniforms.uTime.value = elapsedTime;
    }

    // 2. State-dependent pixel star rendering:
    // - EARTH_HUB (free view): all 88 constellations' stars highlighted as blue pixel stars.
    // - PREVIEW: target constellation turns into yellow pixel stars; blue sky stars fade out.
    // - DISPLACE: crossfade preview points out while scaling 3D yellow star sprites in.
    // - ALIGN_PUZZLE / RESOLVED: 3D yellow pixel star sprites active.
    if (this.allConstellationStarsMesh && this.allConstellationStarsMat) {
      if (gameState === 'EARTH_HUB') {
        this.allConstellationStarsOpacity = Math.min(1.0, this.allConstellationStarsOpacity + deltaSec * 4.5);
      } else {
        this.allConstellationStarsOpacity = Math.max(0.0, this.allConstellationStarsOpacity - deltaSec * 6.0);
      }
      this.allConstellationStarsMesh.visible = this.allConstellationStarsOpacity > 0.001;
      this.allConstellationStarsMat.uniforms.uOpacity.value = this.allConstellationStarsOpacity;
      this.allConstellationStarsMat.uniforms.uTime.value = elapsedTime;
      this.allConstellationStarsMat.uniforms.uPixelRatio.value = this.pixelRatio;
    }

    const isSolving = gameState === 'ALIGN_PUZZLE' || gameState === 'RESOLVED';
    const isTransitioning = gameState === 'DISPLACE';
    const fovRatio = Math.tan((this.currentFov * Math.PI) / 360) / Math.tan((60 * Math.PI) / 360);
    const fovScale = 0.35 + 0.65 * fovRatio;

    if (isSolving) {
      // SOLVING MODE: 3D Yellow Pixel Star Sprites are visible; point stars are hidden
      this.starSpheresGroup.visible = true;
      if (this.activeStarsMesh) {
        this.activeStarsMesh.visible = false;
      }

      this.starSphereItems.forEach((item) => {
        const pulse = 0.96 + 0.04 * Math.sin(elapsedTime * 3.0 + item.twinklePhase);
        const glowPulse = 0.94 + 0.08 * Math.sin(elapsedTime * 2.4 + item.twinklePhase);
        item.pixelSprite.scale.setScalar(item.baseScale * fovScale * pulse);
        item.glowSprite.scale.setScalar(item.baseScale * fovScale * 1.9 * glowPulse);
        item.glowMat.opacity = 0.38 + 0.12 * Math.sin(elapsedTime * 2.4 + item.twinklePhase);
      });
    } else if (isTransitioning) {
      // TRANSITIONING TO ORBIT: Crossfade preview yellow stars to 3D yellow star sprites
      this.starSpheresGroup.visible = true;
      const t = Math.max(0.0, Math.min(1.0, displaceProgress));
      const easeT = t * t * (3.0 - 2.0 * t);

      this.starSphereItems.forEach((item) => {
        const curScale = item.baseScale * fovScale * easeT;
        item.pixelSprite.scale.setScalar(Math.max(0.001, curScale));
        item.glowSprite.scale.setScalar(Math.max(0.001, curScale * 1.9));
        item.glowMat.opacity = 0.42 * easeT;
      });

      if (this.activeStarsMesh && this.activeStarsMat) {
        this.activeStarsMesh.visible = t < 0.95;
        this.activeStarsMat.uniforms.uOpacity.value = Math.max(0.0, 1.0 - t * 1.5);
        this.activeStarsMat.uniforms.uTime.value = elapsedTime;
        this.activeStarsMat.uniforms.uPixelRatio.value = this.pixelRatio;
      }
    } else if (gameState === 'PREVIEW') {
      // TARGET LOCK PREVIEW: Yellow pixel stars on Earth's vantage point
      this.starSpheresGroup.visible = false;

      if (this.activeStarsMesh && this.activeStarsMat) {
        this.activeStarsMesh.visible = true;
        this.activeStarsMat.uniforms.uOpacity.value = 1.0;
        this.activeStarsMat.uniforms.uTime.value = elapsedTime;
        this.activeStarsMat.uniforms.uPixelRatio.value = this.pixelRatio;
      }
    } else {
      // FREE SKY VIEW (EARTH_HUB): Only blue constellation stars + realistic background stars
      this.starSpheresGroup.visible = false;
      if (this.activeStarsMesh) {
        this.activeStarsMesh.visible = false;
      }
    }

    // 3. Update active puzzle lines
    if (this.activeLinesMesh && this.activeLinesMat) {
      this.activeLinesMesh.visible = lineOpacity > 0.001;
      this.activeLinesMat.uniforms.uLineOpacity.value = lineOpacity;
      this.activeLinesMat.uniforms.uTime.value = elapsedTime;
      this.activeLinesMat.uniforms.uAccuracy.value = accuracy;

      if (gameState === 'ALIGN_PUZZLE') {
        const alignRatio = Math.max(0, Math.min(1, accuracy / 100));
        // Dynamic alignment color: Transitions within purple shades from deep purple to brilliant luminous violet-purple
        this.activeLinesMat.uniforms.uColor.value.setRGB(
          0.66 + 0.20 * alignRatio,
          0.33 + 0.40 * alignRatio,
          0.97 + 0.02 * alignRatio
        );
      } else {
        this.activeLinesMat.uniforms.uColor.value.setHex(0xa855f7);
      }
    }

    // 4. Update All-Constellation Sky View lines
    if (this.allLinesMesh && this.allLinesMat) {
      if (gameState === 'EARTH_HUB') {
        if (this.allLinesVisible) {
          this.allLinesOpacity = Math.min(1.0, this.allLinesOpacity + deltaSec * 3.0);
          this.allLinesAnimTime += deltaSec;
        } else {
          this.allLinesOpacity = Math.max(0.0, this.allLinesOpacity - deltaSec * 3.0);
        }

        this.allLinesMesh.visible = this.allLinesOpacity > 0.001;
        this.allLinesMat.uniforms.uAnimTime.value = this.allLinesAnimTime;
        this.allLinesMat.uniforms.uGlobalOpacity.value = this.allLinesOpacity;
        this.allLinesMat.uniforms.uTime.value = elapsedTime;
      } else {
        this.allLinesMesh.visible = false;
      }
    }

    // 5. Update Target Ghost Guide Line Mesh (attached to camera)
    if (this.ghostGuideMesh && this.ghostGuideMat) {
      if (gameState === 'ALIGN_PUZZLE') {
        this.ghostGuideMesh.visible = this.showGhostGuide;
        this.ghostGuideMat.uniforms.uOpacity.value = 0.40 + 0.55 * (accuracy / 100);
        this.ghostGuideMat.uniforms.uTime.value = elapsedTime;
        this.ghostGuideMat.uniforms.uAccuracy.value = accuracy;
      } else {
        this.ghostGuideMesh.visible = false;
      }
    }

    // Solved constellation highlight lines: only show in Sky View when Lines are ON (fade smoothly with allLinesOpacity)
    const isDeepSpace = dimFactor < 0.5;
    const showSolvedLines = gameState === 'EARTH_HUB' && !isDeepSpace && this.allLinesOpacity > 0.001;
    this.solvedGroup.visible = showSolvedLines;
    if (showSolvedLines) {
      this.solvedConstellationsMap.forEach((mesh) => {
        const mat = mesh.material as THREE.LineBasicMaterial;
        mat.opacity = 0.85 * this.allLinesOpacity;
      });
    }

    // 6. Update Constellation Artwork Plates in Celestial Sky (only render plates whose texture has loaded)
    if (gameState === 'EARTH_HUB') {
      const shouldShowArt = this.allArtVisible;
      if (shouldShowArt) {
        this.allArtOpacity = Math.min(0.60, this.allArtOpacity + deltaSec * 2.5);
      } else {
        this.allArtOpacity = Math.max(0.0, this.allArtOpacity - deltaSec * 3.0);
      }

      const isArtVisible = this.allArtOpacity > 0.001;
      this.constellationArtGroup.visible = isArtVisible && !isDeepSpace;

      if (isArtVisible) {
        this.allArtMeshes.forEach((mesh, id) => {
          const mat = mesh.material as THREE.MeshBasicMaterial;
          mesh.visible = Boolean(mat.map);
          if (!mesh.visible) return;
          if (id === this.activeConstellationId) {
            mat.opacity = Math.min(0.88, this.allArtOpacity * 1.5);
            mat.color.setHex(0xc084fc); // Brilliant radiant violet
          } else {
            mat.opacity = this.allArtOpacity;
            mat.color.setHex(0x9370db);
          }
        });
      }
    } else if (gameState === 'PREVIEW' || gameState === 'RESOLVED') {
      // In preview or celebration modal, always show the active constellation's artwork in the sky
      this.constellationArtGroup.visible = true;
      this.allArtMeshes.forEach((mesh, id) => {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        if (id === this.activeConstellationId && mat.map) {
          mesh.visible = true;
          mat.opacity = gameState === 'RESOLVED' ? 0.92 : 0.72;
          mat.color.setHex(gameState === 'RESOLVED' ? 0xd8b4fe : 0xc084fc);
        } else {
          mesh.visible = false;
        }
      });
    } else if (gameState === 'DISPLACE') {
      // Smoothly transition active constellation artwork from preview into orbital alignment
      this.constellationArtGroup.visible = true;
      const t = Math.max(0.0, Math.min(1.0, displaceProgress));
      this.allArtMeshes.forEach((mesh, id) => {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        if (id === this.activeConstellationId && mat.map) {
          mesh.visible = true;
          mat.opacity = 0.72 * (1.0 - t) + 0.15 * t;
          mat.color.setHex(0xc084fc);
        } else {
          mesh.visible = false;
        }
      });
    } else if (gameState === 'ALIGN_PUZZLE') {
      // During puzzle alignment, display target constellation's ethereal art plate, brightening with accuracy
      this.constellationArtGroup.visible = true;
      const alignRatio = Math.max(0, Math.min(1, accuracy / 100));
      this.allArtMeshes.forEach((mesh, id) => {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        if (id === this.activeConstellationId && mat.map) {
          mesh.visible = true;
          mat.opacity = 0.15 + 0.55 * alignRatio;
          mat.color.setHex(alignRatio > 0.85 ? 0xd8b4fe : 0xc084fc);
        } else {
          mesh.visible = false;
        }
      });
    } else {
      this.constellationArtGroup.visible = false;
    }

    this.renderer.render(this.scene, this.camera);
  }

  private computeTargetFov(gameState: GameState): number {
    if (gameState === 'EARTH_HUB' || !this.activeBounds2D) {
      return this.defaultHubFov;
    }
    const aspect = Math.max(0.55, this.camera.aspect || 1.6);
    const { maxTanX, maxTanY, artMaxTanX = 0, artMaxTanY = 0 } = this.activeBounds2D;
    const starReqTan = Math.max(maxTanY, maxTanX / (aspect * 0.88)) * 1.45;
    const artReqTan =
      artMaxTanX > 0 || artMaxTanY > 0
        ? Math.max(artMaxTanY, artMaxTanX / (aspect * 0.90)) * 1.15
        : 0;
    const reqTan = Math.max(starReqTan, artReqTan);
    const reqFov = (2.0 * Math.atan(reqTan) * 180.0) / Math.PI;
    // Clamp between 32 deg (frames tiny constellations cleanly with 3D depth headroom) and 96 deg (frames wide constellations & artwork without heavy fisheye)
    return Math.max(32.0, Math.min(96.0, reqFov));
  }

  public resize(width: number, height: number) {
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height);

    if (this.backgroundStarsMat) {
      this.backgroundStarsMat.uniforms.uPixelRatio.value = this.pixelRatio;
    }
    if (this.allConstellationStarsMat) {
      this.allConstellationStarsMat.uniforms.uPixelRatio.value = this.pixelRatio;
    }
    if (this.activeStarsMat) {
      this.activeStarsMat.uniforms.uPixelRatio.value = this.pixelRatio;
    }
  }

  public dispose() {
    this.isDisposed = true;
    if (this.preloadTimerId) {
      clearTimeout(this.preloadTimerId);
      this.preloadTimerId = null;
    }
    if (this.backgroundStarsMesh) {
      this.scene.remove(this.backgroundStarsMesh);
      this.backgroundStarsMesh.geometry.dispose();
      this.backgroundStarsMat?.dispose();
    }
    if (this.allConstellationStarsMesh) {
      this.scene.remove(this.allConstellationStarsMesh);
      this.allConstellationStarsMesh.geometry.dispose();
      this.allConstellationStarsMat?.dispose();
    }
    if (this.activeStarsMesh) {
      this.scene.remove(this.activeStarsMesh);
      this.activeStarsMesh.geometry.dispose();
      this.activeStarsMat?.dispose();
    }
    if (this.activeLinesMesh) {
      this.scene.remove(this.activeLinesMesh);
      this.activeLinesMesh.geometry.dispose();
      this.activeLinesMat?.dispose();
    }
    if (this.allLinesMesh) {
      this.scene.remove(this.allLinesMesh);
      this.allLinesMesh.geometry.dispose();
      this.allLinesMat?.dispose();
    }
    this.allArtMeshes.forEach((mesh) => {
      this.constellationArtGroup.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => {
          (m as THREE.MeshBasicMaterial).map?.dispose();
          m.dispose();
        });
      } else {
        (mesh.material as THREE.MeshBasicMaterial).map?.dispose();
        mesh.material.dispose();
      }
    });
    this.allArtMeshes.clear();
    this.allArtUrls.clear();
    this.loadedArtIds.clear();
    this.loadingArtIds.clear();
    this.preloadQueue = [];
    this.preloadActiveCount = 0;
    if (this.ghostGuideMesh) {
      this.camera.remove(this.ghostGuideMesh);
      this.ghostGuideMesh.geometry.dispose();
      this.ghostGuideMat?.dispose();
    }

    this.clearStarSpheres();
    this.blueStarTex.dispose();
    this.yellowStarTex.dispose();
    this.yellowGlowTex.dispose();

    this.solvedConstellationsMap.forEach((mesh) => {
      this.solvedGroup.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    this.solvedConstellationsMap.clear();

    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
