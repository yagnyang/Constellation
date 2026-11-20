import * as THREE from 'three';
import { TIFFLoader } from 'three/examples/jsm/loaders/TIFFLoader.js';
import {
  NormalizedConstellation,
  bvToRgb,
  AnimatedConstellationLineData,
} from '../core/StarDataManager';
import { GameState } from '../core/OrbitalCameraController';
import {
  BACKGROUND_STAR_VERTEX_SHADER,
  BACKGROUND_STAR_FRAGMENT_SHADER,
  ACTIVE_POINT_STAR_VERTEX_SHADER,
  ACTIVE_POINT_STAR_FRAGMENT_SHADER,
  STAR_SPHERE_SURFACE_VERTEX_SHADER,
  STAR_SPHERE_SURFACE_FRAGMENT_SHADER,
  STAR_SPHERE_CORONA_VERTEX_SHADER,
  STAR_SPHERE_CORONA_FRAGMENT_SHADER,
  CONSTELLATION_LINE_VERTEX_SHADER,
  CONSTELLATION_LINE_FRAGMENT_SHADER,
  ALL_CONSTELLATION_LINES_VERTEX_SHADER,
  ALL_CONSTELLATION_LINES_FRAGMENT_SHADER,
  GHOST_GUIDE_LINE_VERTEX_SHADER,
  GHOST_GUIDE_LINE_FRAGMENT_SHADER,
} from './StarShaders';

interface StarSphereItem {
  surfaceMesh: THREE.Mesh;
  coronaMesh: THREE.Mesh;
  surfaceMat: THREE.ShaderMaterial;
  coronaMat: THREE.ShaderMaterial;
  baseRadius: number;
}

export class CelestialScene {
  private container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  // High-resolution realistic 360-degree celestial sky panorama
  private backgroundSkyMesh: THREE.Mesh | null = null;
  private backgroundSkyMat: THREE.MeshBasicMaterial | null = null;
  private backgroundTexture: THREE.Texture | null = null;
  private backgroundSkyVisible: boolean = true;

  // Background starfield (Points mesh)
  private backgroundStarsMesh: THREE.Points | null = null;
  private backgroundStarsMat: THREE.ShaderMaterial | null = null;

  // Active constellation puzzle objects
  // 1. Point stars (used in Earth Hub and preview when observing from Earth)
  private activeStarsMesh: THREE.Points | null = null;
  private activeStarsMat: THREE.ShaderMaterial | null = null;

  // 2. 3D Star Spheres (used ONLY when solving in 3D orbit)
  private starSpheresGroup: THREE.Group;
  private starSphereItems: StarSphereItem[] = [];
  private sharedSphereGeo: THREE.SphereGeometry;
  private sharedCoronaGeo: THREE.SphereGeometry;

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

  // 6. Constellation Art Textured Meshes on Celestial Sphere
  private constellationArtGroup: THREE.Group;
  private allArtMeshes: Map<string, THREE.Mesh> = new Map();
  private textureLoader: THREE.TextureLoader = new THREE.TextureLoader();
  private activeConstellationId: string | null = null;
  private allArtVisible: boolean = false;
  private allArtOpacity: number = 0;

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

    // Shared sphere geometry for maximum GPU performance
    this.sharedSphereGeo = new THREE.SphereGeometry(1, 24, 24);
    this.sharedCoronaGeo = new THREE.SphereGeometry(1, 24, 24);
  }

  /**
   * Initializes the realistic 360-degree celestial sphere background panorama
   * using the high-quality TIFF image (with progressive instant preview & fallback).
   */
  public initBackgroundPanorama(imagePath: string = '/bg-image.tif') {
    if (this.backgroundSkyMesh) {
      this.scene.remove(this.backgroundSkyMesh);
      this.backgroundSkyMesh.geometry.dispose();
      this.backgroundSkyMat?.dispose();
      this.backgroundTexture?.dispose();
      this.backgroundSkyMesh = null;
      this.backgroundSkyMat = null;
      this.backgroundTexture = null;
    }

    // Outer celestial sphere (radius 25000, inside far plane 50000, outside all stars)
    const sphereGeo = new THREE.SphereGeometry(25000, 64, 48);

    this.backgroundSkyMat = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
      fog: false,
    });

    this.backgroundSkyMesh = new THREE.Mesh(sphereGeo, this.backgroundSkyMat);
    this.backgroundSkyMesh.renderOrder = -1000; // Render first before foreground stars & lines

    // Astronomical Galactic -> Equatorial (ICRS) alignment:
    // Local +X = Galactic Center (Sgr A*)
    // Local +Y = North Galactic Pole (Coma Berenices)
    // Local +Z = Galactic l = 270 deg (right-handed cross product)
    const gc = new THREE.Vector3(-0.05487566, -0.87343705, -0.48383507);
    const ngp = new THREE.Vector3(-0.86766614, -0.19807634, 0.45598381);
    const z = new THREE.Vector3().crossVectors(gc, ngp);
    const basisMat = new THREE.Matrix4().makeBasis(gc, ngp, z);
    this.backgroundSkyMesh.setRotationFromMatrix(basisMat);

    this.scene.add(this.backgroundSkyMesh);

    const applyTexture = (texture: THREE.Texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;

      this.backgroundTexture = texture;
      if (this.backgroundSkyMat) {
        this.backgroundSkyMat.map = texture;
        this.backgroundSkyMat.needsUpdate = true;
      }
    };

    // 1. Progressive load: show instant web preview so there is zero delay
    const texLoader = new THREE.TextureLoader();
    texLoader.load(
      '/bg-image.webp',
      (tex) => {
        if (!this.backgroundSkyMat?.map) {
          applyTexture(tex);
        }
      },
      undefined,
      () => {
        texLoader.load('/bg-image.jpg', (tex) => {
          if (!this.backgroundSkyMat?.map) {
            applyTexture(tex);
          }
        });
      }
    );

    // 2. Load the high-quality TIFF image directly with TIFFLoader
    const isTiff = imagePath.toLowerCase().endsWith('.tif') || imagePath.toLowerCase().endsWith('.tiff');
    if (isTiff) {
      const tiffLoader = new TIFFLoader();
      tiffLoader.load(
        imagePath,
        (tiffTex) => {
          applyTexture(tiffTex);
        },
        undefined,
        (err) => {
          console.warn('TIFFLoader error, keeping web texture fallback:', err);
        }
      );
    } else {
      texLoader.load(imagePath, (tex) => applyTexture(tex));
    }
  }

  public setBackgroundSkyVisible(visible: boolean) {
    this.backgroundSkyVisible = visible;
    if (this.backgroundSkyMesh) {
      this.backgroundSkyMesh.visible = visible;
    }
  }

  public isBackgroundSkyVisible(): boolean {
    return this.backgroundSkyVisible;
  }

  /**
   * Builds the realistic HYG background starfield points mesh
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

      // Apparent magnitude scaling with enhanced brightness dynamic range
      sizes[i] = Math.max(1.4, (7.8 - mag) * 2.2);
      alphas[i] = Math.max(0.48, Math.min(1.0, 1.0 - (mag - 0.5) / 7.2));
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
   * Sets up the active constellation:
   * 1. Realistic point stars (for Earth Hub & Sky View when NOT solving)
   * 2. 3D Star Spheres with solar plasma & corona (activated ONLY when solving in 3D orbit!)
   * 3. Geometric connection lines
   */
  public setActiveConstellation(constellation: NormalizedConstellation) {
    this.activeConstellationId = constellation.id;

    // 1. Clean up previous 3D star spheres
    this.clearStarSpheres();

    // 2. Active constellation point stars (Sky view)
    if (this.activeStarsMesh) {
      this.scene.remove(this.activeStarsMesh);
      this.activeStarsMesh.geometry.dispose();
      this.activeStarsMat?.dispose();
      this.activeStarsMesh = null;
    }

    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute('position', new THREE.BufferAttribute(constellation.starPositionsArray, 3));
    starsGeo.setAttribute('aColor', new THREE.BufferAttribute(constellation.starColorsArray, 3));
    starsGeo.setAttribute('aSize', new THREE.BufferAttribute(constellation.starSizesArray, 1));

    this.activeStarsMat = new THREE.ShaderMaterial({
      vertexShader: ACTIVE_POINT_STAR_VERTEX_SHADER,
      fragmentShader: ACTIVE_POINT_STAR_FRAGMENT_SHADER,
      uniforms: {
        uPixelRatio: { value: this.pixelRatio },
        uTime: { value: 0.0 },
        uOpacity: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.activeStarsMesh = new THREE.Points(starsGeo, this.activeStarsMat);
    this.scene.add(this.activeStarsMesh);

    // 3. Create 3D Star Spheres for solving mode
    constellation.stars.forEach((star) => {
      const rgb = bvToRgb(star.ci);
      const starColor = new THREE.Color(rgb.r, rgb.g, rgb.b);

      // Realistic 3D radius based on apparent magnitude and luminosity
      // Giants (e.g. mag <= 1.0) ~ 2.4 to 2.8 units; fainter stars ~ 1.0 to 1.5 units
      const baseRadius = Math.max(1.0, 2.7 - (star.mag - 0.5) * 0.42);

      // Photosphere surface mesh
      const surfaceMat = new THREE.ShaderMaterial({
        vertexShader: STAR_SPHERE_SURFACE_VERTEX_SHADER,
        fragmentShader: STAR_SPHERE_SURFACE_FRAGMENT_SHADER,
        uniforms: {
          uColor: { value: starColor },
          uTime: { value: 0.0 },
        },
        depthWrite: true,
      });

      const surfaceMesh = new THREE.Mesh(this.sharedSphereGeo, surfaceMat);
      surfaceMesh.position.copy(star.normalizedPos);
      surfaceMesh.scale.setScalar(baseRadius);

      // Corona volumetric glow shell (broad radiant halo)
      const coronaMat = new THREE.ShaderMaterial({
        vertexShader: STAR_SPHERE_CORONA_VERTEX_SHADER,
        fragmentShader: STAR_SPHERE_CORONA_FRAGMENT_SHADER,
        uniforms: {
          uColor: { value: starColor },
          uTime: { value: 0.0 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide,
      });

      const coronaMesh = new THREE.Mesh(this.sharedCoronaGeo, coronaMat);
      coronaMesh.position.copy(star.normalizedPos);
      coronaMesh.scale.setScalar(baseRadius * 3.2);

      this.starSpheresGroup.add(surfaceMesh);
      this.starSpheresGroup.add(coronaMesh);

      this.starSphereItems.push({
        surfaceMesh,
        coronaMesh,
        surfaceMat,
        coronaMat,
        baseRadius,
      });
    });

    // Start with spheres hidden; they will be shown ONLY when entering solving mode
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
    if (restartAnimation || (visible && this.allLinesAnimTime === 0)) {
      this.allLinesAnimTime = 0.0;
    }
  }

  public setAllConstellationArtVisible(visible: boolean) {
    this.allArtVisible = visible;
  }

  public isAllConstellationArtVisible(): boolean {
    return this.allArtVisible;
  }

  /**
   * Initializes textured 3D artwork plates for all 88 constellations on the celestial sphere
   */
  public initAllConstellationArt(constellations: NormalizedConstellation[]) {
    // Clear any previous meshes
    this.allArtMeshes.forEach((mesh) => {
      this.constellationArtGroup.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    this.allArtMeshes.clear();

    const R = 98.2; // Positioned right along the celestial sphere of radius 100

    for (const c of constellations) {
      const artUrl = c.art?.url || `/sky_art-1/${c.name.toLowerCase().replace(/ /g, '_')}.png`;
      const texture = this.textureLoader.load(artUrl);
      texture.colorSpace = THREE.SRGBColorSpace;

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
        map: texture,
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
      this.starSpheresGroup.remove(item.surfaceMesh);
      this.starSpheresGroup.remove(item.coronaMesh);
      item.surfaceMat.dispose();
      item.coronaMat.dispose();
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

    // 0. Update background sky panorama sphere
    if (this.backgroundSkyMesh) {
      this.backgroundSkyMesh.position.copy(this.camera.position);
      if (this.backgroundSkyMat) {
        this.backgroundSkyMat.opacity = this.backgroundSkyVisible
          ? Math.max(0.20, dimFactor * 0.95)
          : 0.0;
      }
    }

    // 1. Update background starfield
    if (this.backgroundStarsMat) {
      this.backgroundStarsMat.uniforms.uCamPos.value.copy(this.camera.position);
      this.backgroundStarsMat.uniforms.uDimFactor.value = dimFactor;
      this.backgroundStarsMat.uniforms.uPixelRatio.value = this.pixelRatio;
      this.backgroundStarsMat.uniforms.uTime.value = elapsedTime;
    }

    // 2. State-dependent star sphere vs point rendering
    const isSolving = gameState === 'ALIGN_PUZZLE' || gameState === 'RESOLVED';
    const isTransitioning = gameState === 'DISPLACE';

    if (isSolving) {
      // SOLVING MODE: Active 3D Star Spheres are visible; points are hidden
      this.starSpheresGroup.visible = true;
      if (this.activeStarsMesh) {
        this.activeStarsMesh.visible = false;
      }

      // Update full size and animation on spheres
      this.starSphereItems.forEach((item) => {
        item.surfaceMesh.scale.setScalar(item.baseRadius);
        item.coronaMesh.scale.setScalar(item.baseRadius * 3.2);
        item.surfaceMat.uniforms.uTime.value = elapsedTime;
        item.coronaMat.uniforms.uTime.value = elapsedTime;
      });
    } else if (isTransitioning) {
      // TRANSITIONING TO ORBIT: Crossfade points to 3D star spheres
      this.starSpheresGroup.visible = true;
      const t = Math.max(0.0, Math.min(1.0, displaceProgress));

      // Ease-in scale for spheres
      const easeT = t * t * (3.0 - 2.0 * t);
      this.starSphereItems.forEach((item) => {
        const curRadius = item.baseRadius * easeT;
        item.surfaceMesh.scale.setScalar(curRadius);
        item.coronaMesh.scale.setScalar(curRadius * 3.2);
        item.surfaceMat.uniforms.uTime.value = elapsedTime;
        item.coronaMat.uniforms.uTime.value = elapsedTime;
      });

      // Fade out points
      if (this.activeStarsMesh && this.activeStarsMat) {
        this.activeStarsMesh.visible = t < 0.95;
        this.activeStarsMat.uniforms.uOpacity.value = Math.max(0.0, 1.0 - t * 1.5);
        this.activeStarsMat.uniforms.uTime.value = elapsedTime;
        this.activeStarsMat.uniforms.uPixelRatio.value = this.pixelRatio;
      }
    } else {
      // SKY VIEW (EARTH_HUB / PREVIEW): Star spheres are completely hidden!
      // Only realistic points in the celestial sky!
      this.starSpheresGroup.visible = false;

      if (this.activeStarsMesh && this.activeStarsMat) {
        this.activeStarsMesh.visible = true;
        this.activeStarsMat.uniforms.uOpacity.value = 1.0;
        this.activeStarsMat.uniforms.uTime.value = elapsedTime;
        this.activeStarsMat.uniforms.uPixelRatio.value = this.pixelRatio;
      }
    }

    // 3. Update active puzzle lines
    if (this.activeLinesMat) {
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

    // In deep space puzzle, hide other solved constellations so only target constellation stands out
    const isDeepSpace = dimFactor < 0.5;
    this.solvedGroup.visible = !isDeepSpace;

    // 6. Update Constellation Artwork Plates in Celestial Sky
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
          mesh.visible = true;
          const mat = mesh.material as THREE.MeshBasicMaterial;
          if (id === this.activeConstellationId) {
            mat.opacity = Math.max(this.allArtOpacity * 1.5, 0.88);
            mat.color.setHex(0xc084fc); // Brilliant radiant violet
          } else {
            mat.opacity = this.allArtOpacity;
            mat.color.setHex(0x9370db);
          }
        });
      }
    } else if (gameState === 'PREVIEW' || gameState === 'RESOLVED') {
      // In preview or celebration modal, show the active constellation's artwork in the sky
      this.constellationArtGroup.visible = !isDeepSpace;
      this.allArtMeshes.forEach((mesh, id) => {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        if (id === this.activeConstellationId) {
          mesh.visible = true;
          mat.opacity = gameState === 'RESOLVED' ? 0.92 : 0.70;
          mat.color.setHex(gameState === 'RESOLVED' ? 0xd8b4fe : 0xc084fc);
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
        if (id === this.activeConstellationId) {
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

  public resize(width: number, height: number) {
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height);

    if (this.backgroundStarsMat) {
      this.backgroundStarsMat.uniforms.uPixelRatio.value = this.pixelRatio;
    }
    if (this.activeStarsMat) {
      this.activeStarsMat.uniforms.uPixelRatio.value = this.pixelRatio;
    }
  }

  public dispose() {
    if (this.backgroundSkyMesh) {
      this.scene.remove(this.backgroundSkyMesh);
      this.backgroundSkyMesh.geometry.dispose();
      this.backgroundSkyMat?.dispose();
      this.backgroundTexture?.dispose();
      this.backgroundSkyMesh = null;
      this.backgroundSkyMat = null;
      this.backgroundTexture = null;
    }
    if (this.backgroundStarsMesh) {
      this.scene.remove(this.backgroundStarsMesh);
      this.backgroundStarsMesh.geometry.dispose();
      this.backgroundStarsMat?.dispose();
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
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    this.allArtMeshes.clear();
    if (this.ghostGuideMesh) {
      this.camera.remove(this.ghostGuideMesh);
      this.ghostGuideMesh.geometry.dispose();
      this.ghostGuideMat?.dispose();
    }

    this.clearStarSpheres();
    this.sharedSphereGeo.dispose();
    this.sharedCoronaGeo.dispose();

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
