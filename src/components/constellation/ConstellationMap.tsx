"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import {
  CONSTELLATION_LINE_COLORS,
  CONSTELLATION_LINE_OPACITY,
  DEFAULT_TOUR,
  DISTANCE_CAP_PC,
  constellationName,
  magToLum,
} from "./constants";
import { Button } from "./ui/button";
import { STAR_FRAGMENT_SHADER, STAR_VERTEX_SHADER, ACTIVE_STAR_VERTEX_SHADER, ACTIVE_STAR_FRAGMENT_SHADER, ACTIVE_STAR_GLOW_VERTEX_SHADER, ACTIVE_STAR_GLOW_FRAGMENT_SHADER } from "./shaders";
import type { ConstellationFocusMeta, ConstellationLines, ConstellationMapProps, StarRecord } from "./types";
import styles from "./ConstellationMap.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type TourKind = "constellation" | "nearest-star" | "brightest-star";

type TourItem =
  | { type: "constellation"; id: string }
  | { type: "nearest-star" | "brightest-star"; id: string; starIndex: number };

type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  star: StarRecord | null;
};

type WikipediaSummary = {
  title: string;
  extract: string;
  thumbnail?: {
    source: string;
  };
  originalimage?: {
    source: string;
  };
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
};

type ConstellationDetailsState = {
  abbr: string | null;
  open: boolean;
  loading: boolean;
  error: string | null;
  summary: WikipediaSummary | null;
};

type SceneApi = {
  focusCon: (abbr: string, openDetails?: boolean) => void;
  backToEarth: () => void;
  setShowLines: (next: boolean) => void;
  setShowLabels: (next: boolean) => void;
  setZoom: (value: number) => void;
  setStarBrightness: (value: number) => void;
  setLineOpacity: (value: number) => void;
  startTour: (kind: TourKind) => void;
  stopTour: () => void;
  tourPrev: () => void;
  tourNext: () => void;
  toggleTourPlay: () => void;
};

type LineMeshState = {
  line: THREE.LineSegments;
  mat: THREE.LineBasicMaterial;
  cur: number;
  tgt: number;
  drawCount: number;
  totalVertices: number;
};

type StarSphereState = {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.Material>;
  glow: THREE.Mesh<THREE.SphereGeometry, THREE.Material>;
  baseScale: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (value: number) => value * value * (3 - 2 * value);
const posKey = (x: number, y: number, z: number) =>
  `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function hexToRgb(hex: string): [number, number, number] {
  const v = Number.parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

// ─── Component ────────────────────────────────────────────────────────────────

function hasUsableExtract(summary: WikipediaSummary) {
  const extract = summary.extract?.trim();
  return Boolean(extract) && !/may refer to:|can refer to:/i.test(extract);
}

async function fetchWikipediaSummary(title: string, signal: AbortSignal) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Wikipedia returned ${response.status}`);
  return (await response.json()) as WikipediaSummary;
}

export function ConstellationMap({ stars, constellationLines, className }: ConstellationMapProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const labelHostRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<SceneApi | null>(null);

  const [focusedCon, setFocusedCon] = useState<string | null>(null);
  const focusedConRef = useRef<string | null>(null);
  const [showLines, setShowLines] = useState(true);
  const showLinesRef = useRef(true);
  const [showLabels, setShowLabels] = useState(true);
  const showLabelsRef = useRef(true);
  const [constellationOpen, setConstellationOpen] = useState(false);
  const [modeTitle, setModeTitle] = useState("SOLAR PERSPECTIVE");
  const [modeSub, setModeSub] = useState("drag to look · scroll to fly · double-click star for details");
  const [stats, setStats] = useState({ dist: "-", pos: "-" });
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, star: null });
  const [zoomVisible, setZoomVisible] = useState(false);
  const [zoomValue, setZoomValue] = useState(50);
  const [starBrightness, setStarBrightness] = useState(100);
  const [lineOpacity, setLineOpacity] = useState(100);
  const lineOpacityRef = useRef(1);
  const [tourVisible, setTourVisible] = useState(false);
  const [tourPlaying, setTourPlaying] = useState(false);
  // FIX: declared missing state
  const [tourLabel, setTourLabel] = useState("TOUR");
  const [tourMenuOpen, setTourMenuOpen] = useState(false);
  const [warpActive, setWarpActive] = useState(false);
  const [details, setDetails] = useState<ConstellationDetailsState>({
    abbr: null,
    open: false,
    loading: false,
    error: null,
    summary: null,
  });

  const constellationOptions = useMemo(
    () => Object.keys(constellationLines).sort((a, b) => constellationName(a).localeCompare(constellationName(b))),
    [constellationLines],
  );

  const constellationStarCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const star of stars) {
      if (!star.con) continue;
      counts[star.con] = (counts[star.con] || 0) + 1;
    }
    return counts;
  }, [stars]);

  const openConstellationDetails = (abbr: string) => {
    setDetails({
      abbr,
      open: true,
      loading: true,
      error: null,
      summary: null,
    });
  };

  useEffect(() => {
    if (!details.open || !details.abbr) return undefined;

    const abbr = details.abbr;
    const name = constellationName(abbr);
    const controller = new AbortController();

    async function loadSummary() {
      setDetails((current) =>
        current.abbr === abbr
          ? { ...current, loading: true, error: null, summary: null }
          : current,
      );

      try {
        const constellationPage = await fetchWikipediaSummary(`${name} (constellation)`, controller.signal);
        const summary = hasUsableExtract(constellationPage)
          ? constellationPage
          : await fetchWikipediaSummary(name, controller.signal);

        if (!hasUsableExtract(summary)) {
          throw new Error("No constellation summary was found.");
        }

        setDetails((current) =>
          current.abbr === abbr
            ? { ...current, loading: false, error: null, summary }
            : current,
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        setDetails((current) =>
          current.abbr === abbr
            ? {
                ...current,
                loading: false,
                error: error instanceof Error ? error.message : "Could not load Wikipedia summary.",
                summary: null,
              }
            : current,
        );
      }
    }

    loadSummary();

    return () => controller.abort();
  }, [details.abbr, details.open]);

  useEffect(() => {
    const root = rootRef.current;
    const canvasHost = canvasHostRef.current;
    const labelHost = labelHostRef.current;
    if (!root || !canvasHost || !labelHost || !stars.length) return undefined;
    const sceneRoot = root;

    const width = sceneRoot.clientWidth || window.innerWidth;
    const height = sceneRoot.clientHeight || window.innerHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000009, 1);
    canvasHost.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.className = styles.labelLayer;
    labelHost.appendChild(labelRenderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.001, 200000);
    camera.position.set(0, 0, 0.001);

    const starCount = stars.length;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const alphas = new Float32Array(starCount).fill(1);
    const targetAlphas = new Float32Array(starCount).fill(1);
    const baseLums = new Float32Array(starCount);

    for (let i = 0; i < starCount; i += 1) {
      const star = stars[i];
      positions[i * 3] = star.x;
      positions[i * 3 + 1] = star.y;
      positions[i * 3 + 2] = star.z;
      const [r, g, b] = hexToRgb(star.color);
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
      sizes[i] = star.size;
      baseLums[i] = magToLum(star.mag);
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    starGeo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    starGeo.setAttribute("aBaseLum", new THREE.BufferAttribute(baseLums, 1));
    const alphaBuffer = new THREE.BufferAttribute(alphas, 1);
    starGeo.setAttribute("aAlpha", alphaBuffer);

    const starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      uniforms: {
        uCamPos: { value: camera.position.clone() },
        uStarBrightness: { value: starBrightness / 100 },
        // FIX: declared missing uniform so backToEarth reset doesn't crash
        uWarpBoost: { value: 0 },
      },
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    const hazeCount = 3000;
    const hazePositions = new Float32Array(hazeCount * 3);
    const hazeColors = new Float32Array(hazeCount * 3);
    const hazeSizes = new Float32Array(hazeCount);
    for (let i = 0; i < hazeCount; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 4000 + Math.random() * 8000;
      hazePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      hazePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      hazePositions[i * 3 + 2] = radius * Math.cos(phi);
      const t = Math.random();
      hazeColors[i * 3] = 0.25 + t * 0.4;
      hazeColors[i * 3 + 1] = 0.3 + t * 0.35;
      hazeColors[i * 3 + 2] = 0.45 + t * 0.4;
      hazeSizes[i] = 0.05 + Math.random() * 0.15;
    }
    const hazeGeo = new THREE.BufferGeometry();
    hazeGeo.setAttribute("position", new THREE.BufferAttribute(hazePositions, 3));
    hazeGeo.setAttribute("aColor", new THREE.BufferAttribute(hazeColors, 3));
    hazeGeo.setAttribute("aSize", new THREE.BufferAttribute(hazeSizes, 1));
    hazeGeo.setAttribute("aBaseLum", new THREE.BufferAttribute(new Float32Array(hazeCount).fill(0.26), 1));
    hazeGeo.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(hazeCount).fill(0.35), 1));
    scene.add(new THREE.Points(hazeGeo, starMat));

    // FIX: create shared sphere/glow geometry for star selection meshes
    const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
    const glowGeo = new THREE.SphereGeometry(1, 32, 32);

    // FIX: declare starSpheres map and activeStarIndex
    const starSpheres = new Map<number, StarSphereState>();
    let activeStarIndex: number | null = null;

    function setActiveStarSphere(idx: number | null) {
      // Hide previous
      if (activeStarIndex !== null) {
        const prev = starSpheres.get(activeStarIndex);
        if (prev) {
          prev.mesh.visible = false;
          prev.glow.visible = false;
        }
      }
      activeStarIndex = idx;
      if (idx === null) return;
      // Create sphere on demand if not already made
      if (!starSpheres.has(idx)) {
        const star = stars[idx];
        const dist = Math.sqrt(star.x * star.x + star.y * star.y + star.z * star.z);
        const baseScale = Math.max(dist * 0.012, 0.08);
        
        const starColor = new THREE.Color(star.color);
        
        const meshMat = new THREE.ShaderMaterial({
          vertexShader: ACTIVE_STAR_VERTEX_SHADER,
          fragmentShader: ACTIVE_STAR_FRAGMENT_SHADER,
          uniforms: {
            uColor: { value: starColor },
            uTime: { value: 0 },
          },
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(sphereGeo, meshMat);
        mesh.position.set(star.x, star.y, star.z);
        mesh.scale.setScalar(baseScale);
        scene.add(mesh);
        
        const glowMat = new THREE.ShaderMaterial({
          vertexShader: ACTIVE_STAR_GLOW_VERTEX_SHADER,
          fragmentShader: ACTIVE_STAR_GLOW_FRAGMENT_SHADER,
          uniforms: {
            uColor: { value: starColor },
            uTime: { value: 0 },
          },
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.set(star.x, star.y, star.z);
        glow.scale.setScalar(baseScale * 3.5);
        scene.add(glow);
        starSpheres.set(idx, { mesh, glow, baseScale });
      }
      const sphere = starSpheres.get(idx)!;
      sphere.mesh.visible = true;
      sphere.glow.visible = true;
    }

    // FIX: build nearest/brightest star index arrays
    const nearestStarIndexes: number[] = stars
      .map((s, i) => ({ i, dist: Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z) }))
      .filter(({ dist }) => dist > 0 && dist < DISTANCE_CAP_PC)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 30)
      .map(({ i }) => i);

    const brightestStarIndexes: number[] = stars
      .map((s, i) => ({ i, mag: s.mag }))
      .sort((a, b) => a.mag - b.mag)
      .slice(0, 30)
      .map(({ i }) => i);

    const conMeshes: Record<string, LineMeshState> = {};
    for (const [abbr, segments] of Object.entries(constellationLines)) {
      const pts: number[] = [];
      for (const segment of segments) pts.push(...segment);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
      geo.setDrawRange(0, 0);
      const mat = new THREE.LineBasicMaterial({
        color: CONSTELLATION_LINE_COLORS.normal,
        transparent: true,
        opacity: CONSTELLATION_LINE_OPACITY.normal,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.LineSegments(geo, mat);
      scene.add(line);
      const totalVertices = pts.length / 3;
      conMeshes[abbr] = { line, mat, cur: CONSTELLATION_LINE_OPACITY.normal, tgt: CONSTELLATION_LINE_OPACITY.normal, drawCount: 0, totalVertices };
    }

    const connectedByAbbr: Record<string, Set<number>> = {};
    const connectedAll = new Set<number>();
    const posToIdx: Record<string, number> = {};
    for (let i = 0; i < starCount; i += 1) posToIdx[posKey(stars[i].x, stars[i].y, stars[i].z)] = i;
    for (const [abbr, segments] of Object.entries(constellationLines)) {
      connectedByAbbr[abbr] ||= new Set<number>();
      for (const segment of segments) {
        const i1 = posToIdx[posKey(segment[0], segment[1], segment[2])];
        const i2 = posToIdx[posKey(segment[3], segment[4], segment[5])];
        if (i1 !== undefined) {
          connectedByAbbr[abbr].add(i1);
          connectedAll.add(i1);
        }
        if (i2 !== undefined) {
          connectedByAbbr[abbr].add(i2);
          connectedAll.add(i2);
        }
      }
    }

    const conFocusMeta: Record<string, ConstellationFocusMeta> = {};
    for (const [abbr, idxSet] of Object.entries(connectedByAbbr)) {
      const validDistances: number[] = [];
      const dir = new THREE.Vector3();
      for (const idx of idxSet) {
        const star = stars[idx];
        const dist = Math.sqrt(star.x * star.x + star.y * star.y + star.z * star.z);
        if (dist > 0 && dist < DISTANCE_CAP_PC) {
          validDistances.push(dist);
          dir.add(new THREE.Vector3(star.x, star.y, star.z).normalize());
        }
      }
      if (!validDistances.length) continue;
      validDistances.sort((a, b) => a - b);
      const n = validDistances.length;
      conFocusMeta[abbr] = {
        p10: validDistances[Math.max(0, Math.floor(n * 0.1))],
        p50: validDistances[Math.max(0, Math.floor(n * 0.5))],
        p90: validDistances[Math.min(n - 1, Math.floor(n * 0.9))],
        dir: dir.divideScalar(idxSet.size).normalize().clone(),
      };
    }

    const conMap: Record<string, Array<StarRecord & { _i: number }>> = {};
    stars.forEach((star, i) => {
      if (!star.con) return;
      conMap[star.con] ||= [];
      conMap[star.con].push({ ...star, _i: i });
    });

    const labels: Array<{ obj: CSS2DObject; con: string | null; isConnected: boolean }> = [];
    for (let i = 0; i < starCount; i += 1) {
      const star = stars[i];
      const isConnected = connectedAll.has(i);
      const name = star.proper || star.bayer;
      if (!name || (!star.proper && !isConnected)) continue;
      const div = document.createElement("div");
      div.className = joinClasses(styles.starLabel, !star.proper && styles.bayerLabel);
      div.textContent = name;
      const obj = new CSS2DObject(div);
      obj.position.set(star.x, star.y, star.z);
      scene.add(obj);
      labels.push({ obj, con: star.con, isConnected });
    }

    let mode: "earth" | "flying" | "focus" = "earth";
    let orbitCtrl: OrbitControls | null = null;
    let yaw = 0.5;
    let pitch = 0.1;
    let dragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let lastMX = 0;
    let lastMY = 0;
    let lastInteractionTime = performance.now();
    let hoverIdx = -1;
    let hoverCon: string | null = null;
    let animationFrame = 0;
    let disposed = false;
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line = { threshold: 3 };
    const pointer = new THREE.Vector2();
    const zoomState = { min: 0.5, max: 100, target: null as number | null, lastSync: 0 };

    // FIX: added `kind` and `items` typed as TourItem[]
    const tourState: {
      active: boolean;
      playing: boolean;
      kind: TourKind | null;
      items: TourItem[];
      index: number;
      timer: number | null;
    } = {
      active: false,
      playing: false,
      kind: null,
      items: [],
      index: 0,
      timer: null,
    };

    function setFocused(next: string | null) {
      focusedConRef.current = next;
      setFocusedCon(next);
    }

    function applyLabelVis() {
      for (const { obj, con, isConnected } of labels) {
        obj.visible = focusedConRef.current
          ? con === focusedConRef.current && (showLabelsRef.current || isConnected)
          : showLabelsRef.current || isConnected;
      }
    }

    function updateEarthCam() {
      const dist = 800;
      camera.lookAt(
        camera.position.x + dist * Math.cos(pitch) * Math.sin(yaw),
        camera.position.y + dist * Math.sin(pitch),
        camera.position.z - dist * Math.cos(pitch) * Math.cos(yaw),
      );
    }

    function zoomValueToDistance(value: number) {
      const t = smoothstep(clamp01(value / 100));
      return zoomState.max * Math.pow(zoomState.min / zoomState.max, t);
    }

    function syncZoomSlider(distance: number) {
      if (!Number.isFinite(distance) || zoomState.max <= zoomState.min) return;
      const ratio = Math.log(zoomState.max / distance) / Math.log(zoomState.max / zoomState.min);
      setZoomValue(Math.round(clamp01(ratio) * 100));
    }

    function flyCamera(
      destPos: THREE.Vector3,
      lookAt: THREE.Vector3,
      ms: number,
      onDone: () => void,
      opts: { arc?: number; overshoot?: number } = {},
    ) {
      const { arc = 18, overshoot = 0.025 } = opts;
      const p0 = camera.position.clone();
      const q0 = camera.quaternion.clone();
      const targetCam = camera.clone();
      targetCam.position.copy(destPos);
      targetCam.lookAt(lookAt);
      const q1 = targetCam.quaternion.clone();
      const t0 = performance.now();
      const travel = destPos.clone().sub(p0);
      const dist = Math.max(travel.length(), 1);
      const forward = travel.clone().normalize();
      const upSeed =
        Math.abs(forward.dot(new THREE.Vector3(0, 1, 0))) > 0.92
          ? new THREE.Vector3(1, 0, 0)
          : new THREE.Vector3(0, 1, 0);
      const arcDir = new THREE.Vector3().crossVectors(forward, upSeed).cross(forward).normalize();
      const over = overshoot * dist;

      const step = () => {
        if (disposed) return;
        const raw = Math.min((performance.now() - t0) / ms, 1);
        const t = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
        const spice = Math.sin(Math.PI * t);
        const settle = Math.sin(Math.PI * Math.min(raw * 1.18, 1));
        camera.position.lerpVectors(p0, destPos, t);
        camera.position.addScaledVector(arcDir, arc * spice);
        camera.position.addScaledVector(forward, over * settle * (raw > 0.58 ? 1 : 0));
        camera.quaternion.slerpQuaternions(q0, q1, t);
        if (raw < 1) window.requestAnimationFrame(step);
        else {
          camera.position.copy(destPos);
          camera.quaternion.copy(q1);
          onDone();
        }
      };
      step();
    }

    function clearTourTimer() {
      if (tourState.timer) {
        window.clearTimeout(tourState.timer);
        tourState.timer = null;
      }
    }

    function scheduleTourNext() {
      clearTourTimer();
      if (!tourState.active || !tourState.playing) return;
      tourState.timer = window.setTimeout(() => {
        if (mode === "flying") {
          scheduleTourNext();
          return;
        }
        goTour(1, true);
      }, DEFAULT_TOUR.intervalMs);
    }

    function setTourPlayingInternal(playing: boolean) {
      tourState.playing = playing;
      setTourPlaying(playing);
      scheduleTourNext();
    }

    // FIX: implement focusTourItem — was called but never defined
    function focusTourItem(item: TourItem) {
      if (item.type === "constellation") {
        focusCon(item.id, true);
      } else {
        const { starIndex } = item;
        const star = stars[starIndex];
        if (!star) return;
        if (orbitCtrl) {
          orbitCtrl.dispose();
          orbitCtrl = null;
        }
        mode = "flying";
        setActiveStarSphere(starIndex);
        const dist = Math.sqrt(star.x * star.x + star.y * star.y + star.z * star.z);
        const lookAt = new THREE.Vector3(star.x, star.y, star.z);
        
        const targetDist = Math.max(dist * 0.05, 0.5);
        const earthDir = lookAt.clone().normalize();
        const camPos = lookAt.clone().sub(earthDir.multiplyScalar(targetDist));
        
        for (let i = 0; i < starCount; i += 1) targetAlphas[i] = i === starIndex ? 1 : 0.1;
        for (const mesh of Object.values(conMeshes)) {
          mesh.tgt = CONSTELLATION_LINE_OPACITY.dim;
        }
        const name = star.proper || star.bayer || (star.hip ? `HIP ${star.hip}` : "Star");
        setModeTitle(name);
        setModeSub(`Mag ${star.mag.toFixed(2)} · ${star.dist_ly ? `${star.dist_ly.toLocaleString()} ly` : "dist unknown"}`);
        setZoomVisible(true);
        applyLabelVis();
        flyCamera(
          camPos,
          lookAt,
          1900,
          () => {
            orbitCtrl = new OrbitControls(camera, renderer.domElement);
            orbitCtrl.target.copy(lookAt);
            orbitCtrl.enableDamping = true;
            orbitCtrl.dampingFactor = 0.07;
            orbitCtrl.enablePan = true;
            orbitCtrl.minDistance = targetDist;
            orbitCtrl.maxDistance = dist * 4;
            orbitCtrl.rotateSpeed = 0.6;
            orbitCtrl.zoomSpeed = 0.9;
            zoomState.min = orbitCtrl.minDistance;
            zoomState.max = orbitCtrl.maxDistance;
            zoomState.target = targetDist;
            syncZoomSlider(targetDist);
            mode = "focus";
          },
          { arc: Math.max(dist * 0.08, 12), overshoot: 0.035 },
        );
      }
    }

    function goTour(delta: number, fromAuto = false) {
      if (!tourState.items.length || mode === "flying") return;
      tourState.index = (tourState.index + delta + tourState.items.length) % tourState.items.length;
      focusTourItem(tourState.items[tourState.index]);
      if (!fromAuto) setTourPlayingInternal(false);
      else scheduleTourNext();
    }

    function focusCon(abbr: string, openDetails = false) {
      const meta = conFocusMeta[abbr];
      if (!meta || mode === "flying") return;
      if (orbitCtrl) {
        orbitCtrl.dispose();
        orbitCtrl = null;
      }
      mode = "flying";
      setFocused(abbr);
      if (openDetails) openConstellationDetails(abbr);
      setActiveStarSphere(null);
      if (tourState.active) {
        const tourIdx = tourState.items.findIndex((item) => item.id === abbr);
        if (tourIdx !== -1) tourState.index = tourIdx;
      }

      const { p10, p50, p90, dir } = meta;
      const camPos = dir.clone().multiplyScalar(Math.max(p10 * 0.15, 1.5));
      const lookAt = dir.clone().multiplyScalar(p50);
      const cStars = conMap[abbr] || [];

      for (let i = 0; i < starCount; i += 1) targetAlphas[i] = stars[i].con === abbr ? 1 : 0.1;
      for (const [a, mesh] of Object.entries(conMeshes)) {
        mesh.tgt = a === abbr ? CONSTELLATION_LINE_OPACITY.focused : CONSTELLATION_LINE_OPACITY.dim;
        mesh.mat.color.setHex(a === abbr ? CONSTELLATION_LINE_COLORS.focused : CONSTELLATION_LINE_COLORS.dim);
        if (a === abbr) {
          mesh.drawCount = -35;
        }
      }

      setModeTitle(constellationName(abbr));
      setModeSub(`${cStars.length} stars · drag rotate · right-drag pan · scroll zoom`);
      setZoomVisible(true);
      applyLabelVis();

      flyCamera(
        camPos,
        lookAt,
        1900,
        () => {
          orbitCtrl = new OrbitControls(camera, renderer.domElement);
          orbitCtrl.target.copy(lookAt);
          orbitCtrl.enableDamping = true;
          orbitCtrl.dampingFactor = 0.07;
          orbitCtrl.enablePan = true;
          orbitCtrl.panSpeed = 0.55;
          orbitCtrl.screenSpacePanning = true;
          orbitCtrl.minDistance = Math.max(p10 * 0.05, 0.5);
          orbitCtrl.maxDistance = p90 * 4;
          orbitCtrl.rotateSpeed = 0.6;
          orbitCtrl.zoomSpeed = 0.9;
          orbitCtrl.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          };
          zoomState.min = orbitCtrl.minDistance;
          zoomState.max = orbitCtrl.maxDistance;
          zoomState.target = camera.position.distanceTo(orbitCtrl.target);
          syncZoomSlider(zoomState.target);
          mode = "focus";
        },
        { arc: Math.max(p50 * 0.08, 12), overshoot: 0.035 },
      );
    }

    function backToEarth() {
      if (orbitCtrl) {
        orbitCtrl.dispose();
        orbitCtrl = null;
      }
      mode = "flying";
      setFocused(null);
      setActiveStarSphere(null);
      if (tourState.active) setTourPlayingInternal(false);
      tourState.active = false;
      tourState.kind = null;
      tourState.items = [];
      tourState.index = 0;
      setTourVisible(false);
      setTourLabel("TOUR");
      targetAlphas.fill(1);
      for (const mesh of Object.values(conMeshes)) {
        mesh.tgt = showLinesRef.current ? CONSTELLATION_LINE_OPACITY.normal : 0;
        mesh.mat.color.setHex(CONSTELLATION_LINE_COLORS.normal);
      }
      setModeTitle("SOLAR PERSPECTIVE");
      setModeSub("drag to look · scroll to fly · double-click star for details");
      setZoomVisible(false);
      setDetails({ abbr: null, open: false, loading: false, error: null, summary: null });
      // FIX: reset warp via React state setter (warpActive lives in React state)
      setWarpActive(false);
      starMat.uniforms.uWarpBoost.value = 0;
      zoomState.target = null;
      const dest = new THREE.Vector3(0, 0, 0.001);
      const look = new THREE.Vector3(
        800 * Math.cos(pitch) * Math.sin(yaw),
        800 * Math.sin(pitch),
        -800 * Math.cos(pitch) * Math.cos(yaw),
      );
      flyCamera(dest, look, 1500, () => {
        mode = "earth";
        updateEarthCam();
        applyLabelVis();
      }, { arc: 35, overshoot: 0.02 });
    }

    function startTour(kind: TourKind) {
      let items: TourItem[] = [];
      if (kind === "constellation") {
        items = Object.keys(conFocusMeta)
          .sort((a, b) => constellationName(a).localeCompare(constellationName(b)))
          .map((abbr): TourItem => ({ type: "constellation", id: abbr }));
        tourState.index = focusedConRef.current
          ? Math.max(0, items.findIndex((item) => item.id === focusedConRef.current))
          : 0;
        setTourLabel("CONSTELLATIONS");
      } else if (kind === "nearest-star") {
        items = nearestStarIndexes.map((starIndex): TourItem => ({
          type: "nearest-star",
          id: `nearest-star:${starIndex}`,
          starIndex,
        }));
        tourState.index = activeStarIndex === null
          ? 0
          : Math.max(0, items.findIndex((item) => item.type !== "constellation" && item.starIndex === activeStarIndex));
        setTourLabel("NEAREST STARS");
      } else {
        items = brightestStarIndexes.map((starIndex): TourItem => ({
          type: "brightest-star",
          id: `brightest-star:${starIndex}`,
          starIndex,
        }));
        tourState.index = activeStarIndex === null
          ? 0
          : Math.max(0, items.findIndex((item) => item.type !== "constellation" && item.starIndex === activeStarIndex));
        setTourLabel("BRIGHTEST STARS");
      }
      if (!items.length) return;
      tourState.items = items;
      tourState.active = true;
      tourState.kind = kind;
      setTourMenuOpen(false);
      setTourVisible(true);
      focusTourItem(tourState.items[tourState.index]);
      setTourPlayingInternal(true);
    }

    function stopTour() {
      tourState.active = false;
      tourState.kind = null;
      tourState.items = [];
      tourState.index = 0;
      setTourPlayingInternal(false);
      clearTourTimer();
      setTourVisible(false);
      setTourLabel("TOUR");
    }

    function pickStar(clientX: number, clientY: number) {
      const rect = sceneRoot.getBoundingClientRect();
      let bestD = 16;
      let bestI = -1;
      const tmp = new THREE.Vector3();
      for (let i = 0; i < starCount; i += 1) {
        tmp.set(stars[i].x, stars[i].y, stars[i].z).project(camera);
        if (tmp.z > 1) continue;
        const sx = (tmp.x * 0.5 + 0.5) * rect.width + rect.left;
        const sy = (1 - (tmp.y * 0.5 + 0.5)) * rect.height + rect.top;
        const d = Math.hypot(sx - clientX, sy - clientY);
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      }
      return bestI;
    }

    function pickConstellation(clientX: number, clientY: number) {
      const rect = sceneRoot.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(pointer, camera);
      const lineEntries = Object.entries(conMeshes);
      const hits = raycaster.intersectObjects(
        lineEntries.map(([, mesh]) => mesh.line),
        false,
      );
      const hitLine = hits[0]?.object;
      if (!hitLine) return null;
      return lineEntries.find(([, mesh]) => mesh.line === hitLine)?.[0] || null;
    }

    function showStarPopup(idx: number, clientX: number, clientY: number) {
      const star = stars[idx];
      const rect = sceneRoot.getBoundingClientRect();
      let x = clientX - rect.left + 18;
      const y = clientY - rect.top - 10;
      if (x + 260 > rect.width) x = clientX - rect.left - 275;
      setTooltip({ visible: true, x, y, star });
    }

    function onMouseDown(event: MouseEvent) {
      dragging = event.button === 0;
      dragStartX = lastMX = event.clientX;
      dragStartY = lastMY = event.clientY;
      lastInteractionTime = performance.now();
    }

    function onMouseUp() {
      dragging = false;
      lastInteractionTime = performance.now();
    }

    function onMouseMove(event: MouseEvent) {
      lastInteractionTime = performance.now();
      if (dragging && mode === "earth") {
        yaw -= (event.clientX - lastMX) * 0.0025;
        pitch -= (event.clientY - lastMY) * 0.0025;
        pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, pitch));
        lastMX = event.clientX;
        lastMY = event.clientY;
        updateEarthCam();
      }
      if (mode !== "flying") {
        hoverIdx = pickStar(event.clientX, event.clientY);
        hoverCon = hoverIdx !== -1 ? stars[hoverIdx].con : pickConstellation(event.clientX, event.clientY);
        renderer.domElement.style.cursor = (hoverIdx !== -1 || hoverCon) ? "pointer" : "crosshair";
      } else {
        hoverCon = null;
      }
    }

    function onWheel(event: WheelEvent) {
      lastInteractionTime = performance.now();
      if (mode === "focus" && orbitCtrl) {
        zoomState.target = null;
        window.setTimeout(() => {
          if (mode === "focus" && orbitCtrl && zoomState.target === null)
            syncZoomSlider(camera.position.distanceTo(orbitCtrl!.target));
        }, 100);
        return;
      }
      if (mode !== "earth") return;
      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      camera.position.addScaledVector(fwd, -event.deltaY * 0.003);
      if (camera.position.length() > 1500) camera.position.setLength(1500);
    }

    function onClick(event: MouseEvent) {
      if (Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY) > 5) return;
      setTooltip((current) => ({ ...current, visible: false }));
      const idx = hoverIdx === -1 ? pickStar(event.clientX, event.clientY) : hoverIdx;
      const clickedCon = idx === -1 ? pickConstellation(event.clientX, event.clientY) : stars[idx].con;
      if (!clickedCon) return;
      if (clickedCon !== focusedConRef.current) focusCon(clickedCon, true);
      else openConstellationDetails(clickedCon);
    }

    function onContextMenu(event: MouseEvent) {
      event.preventDefault();
    }

    function onDoubleClick(event: MouseEvent) {
      if (Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY) > 5) return;
      const idx = hoverIdx === -1 ? pickStar(event.clientX, event.clientY) : hoverIdx;
      if (idx === -1) {
        setTooltip((current) => ({ ...current, visible: false }));
        return;
      }
      showStarPopup(idx, event.clientX, event.clientY);
    }

    function onResize() {
      const nextWidth = sceneRoot.clientWidth || window.innerWidth;
      const nextHeight = sceneRoot.clientHeight || window.innerHeight;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
      labelRenderer.setSize(nextWidth, nextHeight);
    }

    function animate() {
      if (disposed) return;
      animationFrame += 1;
      window.requestAnimationFrame(animate);
      if (orbitCtrl) orbitCtrl.update();
      
      if (mode === "earth") {
        // Idle Drift
        const idleTime = performance.now() - lastInteractionTime;
        if (idleTime > 2000) {
          const driftStrength = Math.min((idleTime - 2000) / 3000, 1.0) * 0.00015;
          yaw += Math.sin(performance.now() * 0.0004) * driftStrength;
          pitch += Math.cos(performance.now() * 0.00025) * driftStrength;
          pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, pitch));
        }
        
        updateEarthCam();
      }

      starMat.uniforms.uCamPos.value.copy(camera.position);
      if (mode === "focus" && orbitCtrl && zoomState.target !== null) {
        const offset = camera.position.clone().sub(orbitCtrl.target);
        const cur = offset.length();
        const next = cur + (zoomState.target - cur) * 0.085;
        if (cur > 0.0001) {
          camera.position.copy(orbitCtrl.target).add(offset.multiplyScalar(next / cur));
          orbitCtrl.update();
        }
        if (Math.abs(next - zoomState.target) < 0.002) zoomState.target = null;
      } else if (mode === "focus" && orbitCtrl && performance.now() - zoomState.lastSync > 160) {
        syncZoomSlider(camera.position.distanceTo(orbitCtrl.target));
        zoomState.lastSync = performance.now();
      }

      let dirty = false;
      for (let i = 0; i < starCount; i += 1) {
        const diff = targetAlphas[i] - alphas[i];
        if (Math.abs(diff) > 0.002) {
          alphas[i] += diff * 0.065;
          dirty = true;
        }
      }
      if (dirty) alphaBuffer.needsUpdate = true;
      for (const [abbr, mesh] of Object.entries(conMeshes)) {
        const diff = mesh.tgt - mesh.cur;
        if (Math.abs(diff) > 0.001) mesh.cur += diff * 0.07;
        const isHover = abbr === hoverCon && mode === "earth" && showLinesRef.current;
        const pulse = (focusedConRef.current === abbr || isHover) ? 1 + Math.sin(performance.now() * 0.0025) * 0.045 : 1;
        const hoverBoost = isHover ? 0.35 : 0;
        mesh.mat.opacity = Math.min(1, (mesh.cur + hoverBoost) * pulse * lineOpacityRef.current);
        if (mode === "earth") {
          mesh.mat.color.setHex(isHover ? CONSTELLATION_LINE_COLORS.hover : CONSTELLATION_LINE_COLORS.normal);
        }
        
        if (mesh.drawCount < mesh.totalVertices) {
          mesh.drawCount += 0.45;
          const drawVerts = Math.max(0, Math.min(mesh.totalVertices, Math.floor(mesh.drawCount) * 2));
          mesh.line.geometry.setDrawRange(0, drawVerts);
        }
      }
      // FIX: use local activeStarIndex variable
      if (activeStarIndex !== null) {
        const sphere = starSpheres.get(activeStarIndex);
        if (sphere) {
          const t = performance.now() * 0.001;
          const mat = sphere.mesh.material as THREE.ShaderMaterial;
          const glowMat = sphere.glow.material as THREE.ShaderMaterial;
          if (mat.uniforms && mat.uniforms.uTime) mat.uniforms.uTime.value = t;
          if (glowMat.uniforms && glowMat.uniforms.uTime) glowMat.uniforms.uTime.value = t;
          
          const pulse = 1 + Math.sin(t * 3.8) * 0.05;
          sphere.mesh.scale.setScalar(sphere.baseScale * pulse);
          sphere.glow.scale.setScalar(sphere.baseScale * (3.5 + pulse * 0.35));
        }
      }
      if (animationFrame % 45 === 0) {
        const dist = camera.position.length();
        setStats({ dist: `${(dist * 3.26156).toFixed(1)} ly from Sol`, pos: `${dist.toFixed(2)} pc` });
      }
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    }

    apiRef.current = {
      focusCon,
      backToEarth,
      setShowLines: (next) => {
        showLinesRef.current = next;
        setShowLines(next);
        for (const [abbr, mesh] of Object.entries(conMeshes)) {
          mesh.tgt = next
            ? focusedConRef.current
              ? abbr === focusedConRef.current
                ? CONSTELLATION_LINE_OPACITY.focused
                : CONSTELLATION_LINE_OPACITY.dim
              : CONSTELLATION_LINE_OPACITY.normal
            : 0;
          if (next) {
            mesh.drawCount = 0;
          }
        }
      },
      setShowLabels: (next) => {
        showLabelsRef.current = next;
        setShowLabels(next);
        applyLabelVis();
      },
      setZoom: (value) => {
        setZoomValue(value);
        zoomState.target = zoomValueToDistance(value);
      },
      setStarBrightness: (value) => {
        setStarBrightness(value);
        starMat.uniforms.uStarBrightness.value = Math.max(0.15, value / 100);
      },
      setLineOpacity: (value) => {
        setLineOpacity(value);
        lineOpacityRef.current = value / 100;
      },
      startTour,
      stopTour,
      tourPrev: () => goTour(-1),
      tourNext: () => goTour(1),
      toggleTourPlay: () => setTourPlayingInternal(!tourState.playing),
    };

    updateEarthCam();
    applyLabelVis();
    renderer.domElement.addEventListener("mousedown", onMouseDown);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: true });
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("dblclick", onDoubleClick);
    renderer.domElement.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", onResize);
    animate();

    return () => {
      disposed = true;
      clearTourTimer();
      apiRef.current = null;
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("dblclick", onDoubleClick);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      if (orbitCtrl) orbitCtrl.dispose();
      renderer.dispose();
      starGeo.dispose();
      hazeGeo.dispose();
      sphereGeo.dispose();
      glowGeo.dispose();
      for (const sphere of starSpheres.values()) {
        sphere.mesh.material.dispose();
        sphere.glow.material.dispose();
      }
      starMat.dispose();
      canvasHost.replaceChildren();
      labelHost.replaceChildren();
    };
  }, [constellationLines, stars]);

  const activeStarName =
    tooltip.star?.proper || tooltip.star?.bayer || (tooltip.star?.hip ? `HIP ${tooltip.star.hip}` : "-");
  const detailsName = constellationName(details.abbr);
  const detailsStarCount = details.abbr ? constellationStarCounts[details.abbr] || 0 : 0;
  const detailsImageUrl = details.summary?.thumbnail?.source || details.summary?.originalimage?.source;
  const detailsPageUrl =
    details.summary?.content_urls?.desktop?.page ||
    (details.abbr
      ? `https://en.wikipedia.org/wiki/${encodeURIComponent(`${detailsName} (constellation)`).replace(/%20/g, "_")}`
      : null);

  return (
    <div ref={rootRef} className={joinClasses(styles.root, className)}>
      <div ref={canvasHostRef} className={styles.canvasHost} />
      <div ref={labelHostRef} />
      <div className={joinClasses(styles.warpOverlay, warpActive && styles.warpOverlayActive)} />

      <div className={styles.hudTopLeft}>
        <div className={styles.hudLabel}>STARC · Deep Sky</div>
        <div className={styles.hudSub}>HYG v4.2 · {stars.length.toLocaleString()} stars</div>
      </div>

      <div className={styles.modeBadge}>
        <div className={styles.modeTitle}>{modeTitle}</div>
        <div className={styles.modeSub}>{modeSub}</div>
      </div>

      <div className={styles.controls}>
        <div className={styles.controlRow}>
          <div className={styles.tourMenu}>
            <Button active={tourVisible} onClick={() => setTourMenuOpen((open) => !open)}>
              {tourLabel}
            </Button>
            {tourMenuOpen && (
              <div className={styles.tourModeList}>
                <button
                  className={styles.tourModeOption}
                  onClick={() => apiRef.current?.startTour("constellation")}
                  type="button"
                >
                  CONSTELLATIONS
                </button>
                <button
                  className={styles.tourModeOption}
                  onClick={() => apiRef.current?.startTour("nearest-star")}
                  type="button"
                >
                  NEAREST STARS
                </button>
                <button
                  className={styles.tourModeOption}
                  onClick={() => apiRef.current?.startTour("brightest-star")}
                  type="button"
                >
                  BRIGHTEST STARS
                </button>
              </div>
            )}
          </div>
        </div>
        <div className={styles.controlRow}>
          <Button active={showLines} onClick={() => apiRef.current?.setShowLines(!showLines)}>
            CONST. LINES
          </Button>
          <Button active={showLabels} onClick={() => apiRef.current?.setShowLabels(!showLabels)}>
            LABELS
          </Button>
        </div>
        <div className={styles.visualControls}>
          <label className={styles.sliderControl}>
            <span>
              STAR BRIGHTNESS <b>{starBrightness}%</b>
            </span>
            <input
              aria-label="Star brightness"
              className={styles.zoomSlider}
              max={180}
              min={15}
              onChange={(event) => apiRef.current?.setStarBrightness(Number(event.target.value))}
              step={1}
              type="range"
              value={starBrightness}
            />
          </label>
          <label className={styles.sliderControl}>
            <span>
              LINE OPACITY <b>{lineOpacity}%</b>
            </span>
            <input
              aria-label="Constellation line opacity"
              className={styles.zoomSlider}
              max={100}
              min={0}
              onChange={(event) => apiRef.current?.setLineOpacity(Number(event.target.value))}
              step={1}
              type="range"
              value={lineOpacity}
            />
          </label>
        </div>
        <div className={styles.controlRow}>
          <span className={styles.hint}>CLICK constellation lock · DRAG rotate · RIGHT-DRAG pan</span>
        </div>
      </div>

      <div className={styles.topActions}>
        <div className={styles.constellationMenu}>
          <Button
            aria-expanded={constellationOpen}
            className={styles.constellationButton}
            onClick={() => setConstellationOpen((open) => !open)}
            size="md"
          >
            CONSTELLATION
          </Button>
          {constellationOpen && (
            <div className={styles.constellationList}>
              {constellationOptions.map((abbr) => (
                <button
                  className={joinClasses(
                    styles.constellationOption,
                    focusedCon === abbr && styles.constellationOptionActive,
                  )}
                  key={abbr}
                  onClick={() => {
                    setConstellationOpen(false);
                    apiRef.current?.focusCon(abbr, true);
                  }}
                  type="button"
                >
                  <span>{constellationName(abbr)}</span>
                  <span className={styles.abbr}>{abbr}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button
          className={joinClasses(styles.backButton, (focusedCon || tourVisible) && styles.backButtonVisible)}
          onClick={() => apiRef.current?.backToEarth()}
          variant="ghost"
        >
          ← SOLAR VIEW
        </Button>
      </div>

      <div className={joinClasses(styles.tourControls, tourVisible && styles.tourControlsVisible)}>
        <Button onClick={() => apiRef.current?.tourPrev()}>PREV</Button>
        <Button active={tourPlaying} onClick={() => apiRef.current?.toggleTourPlay()}>
          {tourPlaying ? "PAUSE" : "PLAY"}
        </Button>
        <Button onClick={() => apiRef.current?.tourNext()}>NEXT</Button>
      </div>

      <div className={joinClasses(styles.focusZoom, zoomVisible && styles.focusZoomVisible)}>
        <div className={styles.zoomHead}>
          <span>FOCUS ZOOM</span>
          <span className={styles.zoomReadout}>{zoomValue}%</span>
        </div>
        <input
          aria-label="Focus zoom"
          className={styles.zoomSlider}
          max={100}
          min={0}
          onChange={(event) => apiRef.current?.setZoom(Number(event.target.value))}
          step={1}
          type="range"
          value={zoomValue}
        />
      </div>

      <div className={styles.stats}>
        <div>{stats.dist}</div>
        <div>{stats.pos}</div>
      </div>

      <aside className={joinClasses(styles.detailsCard, details.open && styles.detailsCardVisible)}>
        {details.abbr && (
          <>
            <div className={styles.detailsHeader}>
              <div>
                <div className={styles.detailsEyebrow}>Constellation Profile</div>
                <h2 className={styles.detailsTitle}>{detailsName}</h2>
                <div className={styles.detailsSubtitle}>{details.abbr}</div>
              </div>
              <button
                aria-label="Close constellation details"
                className={styles.detailsClose}
                onClick={() => setDetails((current) => ({ ...current, open: false }))}
                type="button"
              >
                x
              </button>
            </div>

            {detailsImageUrl ? (
              <img
                alt={`${detailsName} constellation`}
                className={styles.detailsImage}
                src={detailsImageUrl}
              />
            ) : (
              <div className={styles.detailsImageFallback} aria-hidden="true">
                <span>{details.abbr}</span>
              </div>
            )}

            <div className={styles.detailsFacts}>
              <div>
                <span>Stars in map</span>
                <b>{detailsStarCount.toLocaleString()}</b>
              </div>
              <div>
                <span>IAU code</span>
                <b>{details.abbr}</b>
              </div>
            </div>

            <div className={styles.detailsBody}>
              {details.loading ? (
                <p>Loading Wikipedia summary...</p>
              ) : details.error ? (
                <p>{details.error}</p>
              ) : (
                <p>{details.summary?.extract || "No Wikipedia summary was found for this constellation."}</p>
              )}
            </div>

            {detailsPageUrl && (
              <a
                className={styles.detailsLink}
                href={detailsPageUrl}
                rel="noreferrer"
                target="_blank"
              >
                Read on Wikipedia
              </a>
            )}
          </>
        )}
      </aside>

      <div
        className={joinClasses(styles.tooltip, tooltip.visible && styles.tooltipVisible)}
        style={{ left: tooltip.x, top: tooltip.y }}
      >
        {tooltip.star && (
          <>
            <div className={styles.tooltipName}>{activeStarName}</div>
            <div className={styles.tooltipSep}>────────────────</div>
            <div>
              Magnitude <span className={styles.tooltipValue}>{tooltip.star.mag.toFixed(2)}</span>
            </div>
            <div>
              Distance{" "}
              <span className={styles.tooltipValue}>
                {tooltip.star.dist_ly ? `${tooltip.star.dist_ly.toLocaleString()} ly` : "-"}
              </span>
            </div>
            <div>
              Spectral <span className={styles.tooltipValue}>{tooltip.star.spect || "-"}</span>
            </div>
            <div>
              Const. <span className={styles.tooltipValue}>{constellationName(tooltip.star.con)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
