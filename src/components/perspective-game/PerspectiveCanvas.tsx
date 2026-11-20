'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { STAR_VERTEX_SHADER, STAR_FRAGMENT_SHADER } from '@/components/constellation/shaders';
import type { ConstellationLines, StarRecord } from '@/components/constellation/types';
import { puzzleAudio } from './audio';

interface PerspectiveCanvasProps {
  currentConstellationId: string;
  allStars: StarRecord[];
  constellationLines: ConstellationLines;
  showGhostHint: boolean;
  onAlignmentChange: (accuracy: number) => void;
  onSolved: () => void;
  isSolved: boolean;
}

export default function PerspectiveCanvas({
  currentConstellationId,
  allStars,
  constellationLines,
  showGhostHint,
  onAlignmentChange,
  onSolved,
  isSolved,
}: PerspectiveCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Puzzle state refs
  const puzzleGroupRef = useRef<THREE.Group | null>(null);
  const canonicalQuatRef = useRef<THREE.Quaternion>(new THREE.Quaternion());
  const currentQuatRef = useRef<THREE.Quaternion>(new THREE.Quaternion());
  const targetQuatRef = useRef<THREE.Quaternion>(new THREE.Quaternion());
  const isDraggingRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isSnappingRef = useRef<boolean>(false);
  const solvedRef = useRef<boolean>(false);

  // Mesh refs
  const activeLineMeshRef = useRef<THREE.LineSegments | null>(null);
  const ghostLineMeshRef = useRef<THREE.LineSegments | null>(null);
  const activeStarsMeshRef = useRef<THREE.Points | null>(null);

  solvedRef.current = isSolved;

  // Initialize Scene
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02040b);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50000);
    camera.position.set(0, 0, 400);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Background cosmic nebula
    const nebulaGeo = new THREE.SphereGeometry(15000, 32, 32);
    const nebulaMat = new THREE.MeshBasicMaterial({
      color: 0x050c1e,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.8,
    });
    scene.add(new THREE.Mesh(nebulaGeo, nebulaMat));

    // Puzzle group that rotates in 3D
    const puzzleGroup = new THREE.Group();
    scene.add(puzzleGroup);
    puzzleGroupRef.current = puzzleGroup;

    // Render background ambient stars
    if (allStars && allStars.length > 0) {
      const count = allStars.length;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      const baseLums = new Float32Array(count);
      const alphas = new Float32Array(count);

      allStars.forEach((s, i) => {
        positions[i * 3] = s.x;
        positions[i * 3 + 1] = s.y;
        positions[i * 3 + 2] = s.z;

        const col = new THREE.Color(s.color || '#ffffff');
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;

        sizes[i] = s.size || 1.0;
        baseLums[i] = 0.45;
        alphas[i] = 0.35; // Dim background so active constellation pops
      });

      const bgGeo = new THREE.BufferGeometry();
      bgGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      bgGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
      bgGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
      bgGeo.setAttribute('aBaseLum', new THREE.BufferAttribute(baseLums, 1));
      bgGeo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

      const bgMat = new THREE.ShaderMaterial({
        vertexShader: STAR_VERTEX_SHADER,
        fragmentShader: STAR_FRAGMENT_SHADER,
        uniforms: {
          uCamPos: { value: camera.position },
          uStarBrightness: { value: 0.6 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const bgPoints = new THREE.Points(bgGeo, bgMat);
      scene.add(bgPoints);
    }

    // Handle Resize
    const handleResize = () => {
      if (!mountRef.current || !renderer || !camera) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Smoothly interpolate rotation towards target
      if (puzzleGroupRef.current) {
        if (isSnappingRef.current) {
          puzzleGroupRef.current.quaternion.slerp(targetQuatRef.current, 0.12);
          if (puzzleGroupRef.current.quaternion.angleTo(targetQuatRef.current) < 0.005) {
            puzzleGroupRef.current.quaternion.copy(targetQuatRef.current);
            isSnappingRef.current = false;
          }
        } else {
          puzzleGroupRef.current.quaternion.slerp(targetQuatRef.current, 0.18);
        }

        // Calculate Alignment Accuracy
        // Angle between current orientation and canonical Earth view (0 = perfect alignment)
        const currentQ = puzzleGroupRef.current.quaternion;
        const angle = currentQ.angleTo(canonicalQuatRef.current);

        // Normalize to 0..100% (within 0.8 rad ~ 45 degrees)
        const maxAngle = 0.85;
        let acc = Math.max(0, Math.min(100, Math.round((1 - angle / maxAngle) * 100)));

        if (angle < 0.06) {
          acc = 100;
        }

        onAlignmentChange(acc);
        puzzleAudio.updateResonance(acc / 100);

        // Magnetic Snap Condition: within 0.07 radians (~4 degrees)
        if (acc >= 94 && !solvedRef.current && !isSnappingRef.current) {
          isSnappingRef.current = true;
          targetQuatRef.current.copy(canonicalQuatRef.current);
          puzzleAudio.playSnapSound();
          puzzleAudio.playVictoryFanfare();
          onSolved();
        }

        // Visual Line Glow based on accuracy
        if (activeLineMeshRef.current) {
          const mat = activeLineMeshRef.current.material as THREE.LineBasicMaterial;
          if (solvedRef.current || acc >= 98) {
            mat.color.setHex(0xf59e0b); // Radiant gold
            mat.opacity = 1.0;
          } else {
            // Smooth transition from faint starlight cyan (0.35) to bright cyan (0.9)
            mat.color.setHex(0x38bdf8);
            mat.opacity = 0.25 + (acc / 100) * 0.65;
          }
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [allStars, onAlignmentChange, onSolved]);

  // Load Constellation Geometry when ID changes
  useEffect(() => {
    const puzzleGroup = puzzleGroupRef.current;
    const camera = cameraRef.current;
    if (!puzzleGroup || !camera || !constellationLines[currentConstellationId]) return;

    // Clear old constellation meshes from puzzleGroup
    while (puzzleGroup.children.length > 0) {
      puzzleGroup.remove(puzzleGroup.children[0]);
    }

    const segments = constellationLines[currentConstellationId];

    // Compute Centroid of the constellation in 3D parsec space
    let cx = 0, cy = 0, cz = 0;
    let ptCount = 0;
    const linePositions: number[] = [];
    const starMap = new Map<string, { x: number; y: number; z: number; mag: number; color: string }>();

    segments.forEach((seg) => {
      linePositions.push(seg[0], seg[1], seg[2], seg[3], seg[4], seg[5]);
      cx += seg[0] + seg[3];
      cy += seg[1] + seg[4];
      cz += seg[2] + seg[5];
      ptCount += 2;

      const k1 = `${seg[0]},${seg[1]},${seg[2]}`;
      const k2 = `${seg[3]},${seg[4]},${seg[5]}`;
      if (!starMap.has(k1)) starMap.set(k1, { x: seg[0], y: seg[1], z: seg[2], mag: 3.0, color: '#38bdf8' });
      if (!starMap.has(k2)) starMap.set(k2, { x: seg[3], y: seg[4], z: seg[5], mag: 3.0, color: '#38bdf8' });
    });

    cx /= ptCount;
    cy /= ptCount;
    cz /= ptCount;

    // Centering: Shift stars so constellation centroid is at (0, 0, 0) of the puzzleGroup!
    // This allows natural 3D trackball / orbit rotation directly around the constellation center!
    const centeredLinePositions: number[] = [];
    for (let i = 0; i < linePositions.length; i += 3) {
      centeredLinePositions.push(
        linePositions[i] - cx,
        linePositions[i + 1] - cy,
        linePositions[i + 2] - cz
      );
    }

    // 1. Physical 3D Constellation Lines
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(centeredLinePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 2,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const lineMesh = new THREE.LineSegments(lineGeo, lineMat);
    puzzleGroup.add(lineMesh);
    activeLineMeshRef.current = lineMesh;

    // 2. 3D Stars of this constellation
    const starArr = Array.from(starMap.values());
    const starCount = starArr.length;
    const starPos = new Float32Array(starCount * 3);
    const starCols = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    const starLums = new Float32Array(starCount);
    const starAlphas = new Float32Array(starCount);

    starArr.forEach((s, idx) => {
      starPos[idx * 3] = s.x - cx;
      starPos[idx * 3 + 1] = s.y - cy;
      starPos[idx * 3 + 2] = s.z - cz;

      starCols[idx * 3] = 1.0;
      starCols[idx * 3 + 1] = 0.95;
      starCols[idx * 3 + 2] = 0.85;

      starSizes[idx] = 4.5;
      starLums[idx] = 1.4;
      starAlphas[idx] = 1.0;
    });

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('aColor', new THREE.BufferAttribute(starCols, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
    starGeo.setAttribute('aBaseLum', new THREE.BufferAttribute(starLums, 1));
    starGeo.setAttribute('aAlpha', new THREE.BufferAttribute(starAlphas, 1));

    const starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      uniforms: {
        uCamPos: { value: camera.position },
        uStarBrightness: { value: 1.2 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const starPoints = new THREE.Points(starGeo, starMat);
    puzzleGroup.add(starPoints);
    activeStarsMeshRef.current = starPoints;

    // Compute Earth viewing vector from Earth (0,0,0) to centroid (cx, cy, cz)
    const earthVector = new THREE.Vector3(cx, cy, cz).normalize();

    // Canonical alignment quaternion: aligns earthVector with the camera's Z axis (0, 0, 1)
    const canonicalQuat = new THREE.Quaternion();
    canonicalQuat.setFromUnitVectors(earthVector, new THREE.Vector3(0, 0, 1));
    canonicalQuatRef.current.copy(canonicalQuat);

    // Initial Scramble: Rotate away from Earth by 50 to 90 degrees around a random 3D axis
    scramblePerspective();
  }, [currentConstellationId, constellationLines]);

  // Scramble perspective into a random 3D rotation
  const scramblePerspective = useCallback(() => {
    puzzleAudio.playScrambleSound();
    isSnappingRef.current = false;

    // Generate random rotation axis orthogonal to Earth view
    const randomAxis = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    ).normalize();

    // Random angle between 55 and 100 degrees (0.95 to 1.75 radians)
    const randomAngle = 0.95 + Math.random() * 0.8;
    const scrambleRot = new THREE.Quaternion().setFromAxisAngle(randomAxis, randomAngle);

    // Target rotation = canonical * scramble
    const scrambled = canonicalQuatRef.current.clone().multiply(scrambleRot);
    targetQuatRef.current.copy(scrambled);
    currentQuatRef.current.copy(scrambled);
    if (puzzleGroupRef.current) {
      puzzleGroupRef.current.quaternion.copy(scrambled);
    }
  }, []);

  // Mouse / Touch Drag to Rotate Perspective in 3D
  const handleMouseDown = (e: React.MouseEvent) => {
    if (solvedRef.current) return;
    isDraggingRef.current = true;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || solvedRef.current) return;

    const deltaX = e.clientX - prevMouseRef.current.x;
    const deltaY = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    // 3D Trackball / Arcball rotation
    const sensitivity = 0.0055;
    const rotX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), deltaY * sensitivity);
    const rotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * sensitivity);

    targetQuatRef.current.premultiply(rotY);
    targetQuatRef.current.premultiply(rotX);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Touch Support for mobile / tablet
  const handleTouchStart = (e: React.TouchEvent) => {
    if (solvedRef.current || e.touches.length === 0) return;
    isDraggingRef.current = true;
    prevMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || solvedRef.current || e.touches.length === 0) return;

    const deltaX = e.touches[0].clientX - prevMouseRef.current.x;
    const deltaY = e.touches[0].clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

    const sensitivity = 0.0055;
    const rotX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), deltaY * sensitivity);
    const rotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * sensitivity);

    targetQuatRef.current.premultiply(rotY);
    targetQuatRef.current.premultiply(rotX);
  };

  return (
    <div
      ref={mountRef}
      className="relative w-full h-full cursor-grab active:cursor-grabbing select-none overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
    >
      {/* Reticle guide overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-24 h-24 border border-white/10 rounded-full flex items-center justify-center">
          <div className="w-1.5 h-1.5 bg-cyan-400/30 rounded-full" />
        </div>
      </div>
    </div>
  );
}
