'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { starDataManager, NormalizedConstellation, RawConstellation } from '../core/StarDataManager';
import { OrbitalCameraController, GameState, SolvedStats } from '../core/OrbitalCameraController';
import { CelestialScene } from '../rendering/CelestialScene';
import { TelemetryHUD } from '../ui/TelemetryHUD';
import { ConstellationSelector } from '../ui/ConstellationSelector';

export default function ConstellationAlignerApp() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CelestialScene | null>(null);
  const controllerRef = useRef<OrbitalCameraController | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Application State
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [constellationList, setConstellationList] = useState<RawConstellation[]>([]);
  const [activeConstellation, setActiveConstellation] = useState<NormalizedConstellation | null>(null);
  const [gameState, setGameState] = useState<GameState>('EARTH_HUB');
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());

  // Live Telemetry Metrics
  const [timerSec, setTimerSec] = useState<number>(20.0);
  const [alphaDeg, setAlphaDeg] = useState<number>(90.0);
  const [accuracy, setAccuracy] = useState<number>(0.0);
  const [solvedStats, setSolvedStats] = useState<SolvedStats | null>(null);
  const [showTimeoutModal, setShowTimeoutModal] = useState<boolean>(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);
  const [showAllLines, setShowAllLines] = useState<boolean>(false);
  const [showArt, setShowArt] = useState<boolean>(false);
  const [showGhostGuide, setShowGhostGuide] = useState<boolean>(false);
  const [showSkyPanorama, setShowSkyPanorama] = useState<boolean>(true);

  // 1. Load astronomical dataset
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        await starDataManager.loadData();
        if (!isMounted) return;

        const allConsts = starDataManager.getAllConstellations();
        setConstellationList(allConsts);

        // Load solved constellations from localStorage
        try {
          const saved = localStorage.getItem('starc_solved_constellations');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              setSolvedIds(new Set(parsed));
            }
          }
        } catch {}

        setIsDataLoaded(true);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setLoadError(msg);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Initialize Three.js scene and OrbitalCameraController
  useEffect(() => {
    if (!isDataLoaded || !mountRef.current) return;

    const container = mountRef.current;
    const scene = new CelestialScene(container);
    sceneRef.current = scene;

    // Load high-quality TIFF background celestial panorama
    scene.initBackgroundPanorama('/bg-image.tif');

    // Load background starfield
    const starfieldData = starDataManager.getRawStarfield();
    if (starfieldData) {
      scene.initBackgroundStarfield(starfieldData);
    }

    // Initialize progressive wave animated lines for all 88 constellations
    const allLinesData = starDataManager.getAllConstellationAnimatedLines();
    if (allLinesData) {
      scene.initAllConstellationLines(allLinesData);
    }

    // Initialize all 88 celestial constellation artwork plates on the sphere
    const allNormConsts = starDataManager.getAllNormalizedConstellations();
    if (allNormConsts.length > 0) {
      scene.initAllConstellationArt(allNormConsts);
    }

    // Initialize controller with callbacks
    const controller = new OrbitalCameraController(scene.camera, {
      onStateChange: (newState) => {
        setGameState(newState);
        if (newState === 'ALIGN_PUZZLE') {
          setShowTimeoutModal(false);
          setSolvedStats(null);
        } else if (newState === 'EARTH_HUB') {
          setShowTimeoutModal(false);
        }
      },
      onAlignmentUpdate: (alpha, acc) => {
        setAlphaDeg(alpha);
        setAccuracy(acc);
      },
      onTimerUpdate: (timeLeft) => {
        setTimerSec(timeLeft);
      },
      onSolved: (stats) => {
        setSolvedStats(stats);
        setSolvedIds((prev) => {
          const next = new Set(prev).add(stats.constellationId);
          try {
            localStorage.setItem('starc_solved_constellations', JSON.stringify([...next]));
          } catch {}
          return next;
        });

        // Mark permanently in celestial sky
        const norm = starDataManager.getNormalizedConstellation(stats.constellationId);
        if (norm) {
          scene.markConstellationSolved(norm);
        }
      },
      onTimeout: () => {
        setShowTimeoutModal(true);
      },
    });

    controllerRef.current = controller;

    // Mark previously solved constellations in scene
    try {
      const saved = localStorage.getItem('starc_solved_constellations');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach((id: string) => {
            const norm = starDataManager.getNormalizedConstellation(id);
            if (norm) scene.markConstellationSolved(norm);
          });
        }
      }
    } catch {}

    // Set initial featured constellation (Cassiopeia by default)
    const initialConstellation =
      starDataManager.getNormalizedConstellation('Cas') ||
      starDataManager.getNormalizedConstellation('Ori') ||
      starDataManager.getNormalizedConstellation(constellationList[0]?.id || 'UMa');

    if (initialConstellation) {
      setActiveConstellation(initialConstellation);
      scene.setActiveConstellation(initialConstellation);
      controller.selectConstellation(initialConstellation, false);
    }

    // Render loop
    let lastTime = performance.now();

    function renderLoop(now: number) {
      const deltaSec = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      controller.update(deltaSec);
      const metrics = controller.getAlignmentMetrics();
      const currentState = controller.getState();
      const displaceProgress = controller.getDisplaceProgress();
      scene.render(metrics.dimFactor, metrics.lineOpacity, currentState, displaceProgress, metrics.accuracy);

      animFrameRef.current = requestAnimationFrame(renderLoop);
    }

    animFrameRef.current = requestAnimationFrame(renderLoop);

    // Resize handler
    function handleResize() {
      if (!mountRef.current) return;
      scene.resize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    }

    window.addEventListener('resize', handleResize);

    const handleGlobalPointerUp = () => {
      controller.handlePointerUp();
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    window.addEventListener('blur', handleGlobalPointerUp);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
      window.removeEventListener('blur', handleGlobalPointerUp);
      scene.dispose();
      sceneRef.current = null;
      controllerRef.current = null;
    };
  }, [isDataLoaded, constellationList]);

  // Pointer event handlers for 360 Earth gaze & orbital puzzle rotation
  // Strict click-and-hold requirement: only active when mouse button or touch is physically held down
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.buttons !== 1) return;
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    controllerRef.current?.handlePointerDown(e.clientX, e.clientY);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // If no button is held down (e.buttons === 0), cancel any active drag immediately!
    if (e.buttons === 0) {
      controllerRef.current?.handlePointerUp();
      return;
    }
    controllerRef.current?.handlePointerMove(e.clientX, e.clientY, e.buttons);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    controllerRef.current?.handlePointerUp();
  }, []);

  // Constellation selection
  const handleSelectConstellation = useCallback((id: string) => {
    controllerRef.current?.handlePointerUp();
    const norm = starDataManager.getNormalizedConstellation(id);
    if (!norm || !sceneRef.current || !controllerRef.current) return;

    setActiveConstellation(norm);
    sceneRef.current.setActiveConstellation(norm);
    controllerRef.current.selectConstellation(norm, true);
    setIsCatalogOpen(false);
  }, []);

  // Next constellation action
  const handleNextConstellation = useCallback(() => {
    if (!activeConstellation || constellationList.length === 0) return;

    // Find next constellation in catalog
    const currentIndex = constellationList.findIndex((c) => c.id === activeConstellation.id);
    const nextIndex = (currentIndex + 1) % constellationList.length;
    const nextRaw = constellationList[nextIndex];

    handleSelectConstellation(nextRaw.id);
  }, [activeConstellation, constellationList, handleSelectConstellation]);

  // Return to Earth Hub
  const handleReturnToEarthHub = useCallback(() => {
    controllerRef.current?.transitionTo('EARTH_HUB');
    setShowTimeoutModal(false);
    setSolvedStats(null);
  }, []);

  // Retry orbit on timeout
  const handleRetryOrbit = useCallback(() => {
    setShowTimeoutModal(false);
    controllerRef.current?.retryOrbit();
  }, []);

  // Auto-align on timeout
  const handleAutoAlign = useCallback(() => {
    setShowTimeoutModal(false);
    controllerRef.current?.autoAlignToEarth();
  }, []);

  // Sky View All-Constellation Lines & Art Toggle
  const handleToggleAllLines = useCallback(() => {
    setShowAllLines((prev) => {
      const next = !prev;
      sceneRef.current?.setAllConstellationLinesVisible(next, true);
      setShowArt(next);
      return next;
    });
  }, []);

  // Sky View Art Toggle (independent control)
  const handleToggleArt = useCallback(() => {
    setShowArt((prev) => {
      const next = !prev;
      sceneRef.current?.setAllConstellationArtVisible(next);
      return next;
    });
  }, []);

  // Sky View Replay Formation Animation
  const handleReplayLinesAnimation = useCallback(() => {
    setShowAllLines(true);
    sceneRef.current?.replayAllLinesAnimation();
  }, []);

  // Quiz Target Alignment Ghost Guide Toggle
  const handleToggleGhostGuide = useCallback(() => {
    setShowGhostGuide((prev) => {
      const next = !prev;
      sceneRef.current?.setShowGhostGuide(next);
      return next;
    });
  }, []);

  // Sky View Background Panorama Toggle
  const handleToggleSkyPanorama = useCallback(() => {
    setShowSkyPanorama((prev) => {
      const next = !prev;
      sceneRef.current?.setBackgroundSkyVisible(next);
      return next;
    });
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* Three.js Canvas Container */}
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Loading Screen */}
      {!isDataLoaded && !loadError && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black text-white space-y-3">
          <div className="w-8 h-8 border-2 border-purple-500/20 border-t-purple-400 rounded-full animate-spin" />
          <div className="text-xs text-white/60 tracking-wide font-medium">
            Loading stellar catalog...
          </div>
        </div>
      )}

      {/* Error Screen */}
      {loadError && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black text-rose-300 p-6 text-center space-y-2">
          <div className="text-sm font-semibold tracking-wide">
            Unable to load stellar data
          </div>
          <div className="text-xs text-white/40 max-w-md">{loadError}</div>
        </div>
      )}

      {/* Stealth Telemetry HUD */}
      {isDataLoaded && (
        <TelemetryHUD
          state={gameState}
          constellation={activeConstellation}
          timerSec={timerSec}
          alphaDeg={alphaDeg}
          accuracy={accuracy}
          solvedStats={solvedStats}
          showTimeoutModal={showTimeoutModal}
          showAllLines={showAllLines}
          onToggleAllLines={handleToggleAllLines}
          showArt={showArt}
          onToggleArt={handleToggleArt}
          onReplayLinesAnimation={handleReplayLinesAnimation}
          showGhostGuide={showGhostGuide}
          onToggleGhostGuide={handleToggleGhostGuide}
          showSkyPanorama={showSkyPanorama}
          onToggleSkyPanorama={handleToggleSkyPanorama}
          onStartAlignment={() => {
            controllerRef.current?.handlePointerUp();
            controllerRef.current?.transitionTo('PREVIEW');
          }}
          onNextConstellation={handleNextConstellation}
          onReturnToEarthHub={handleReturnToEarthHub}
          onRetryOrbit={handleRetryOrbit}
          onAutoAlign={handleAutoAlign}
        />
      )}

      {/* Earth Hub Constellation Catalog Selector */}
      {isDataLoaded && gameState === 'EARTH_HUB' && (
        <ConstellationSelector
          constellations={constellationList}
          activeId={activeConstellation?.id || null}
          solvedIds={solvedIds}
          isOpen={isCatalogOpen}
          onToggle={() => setIsCatalogOpen((prev) => !prev)}
          onSelect={handleSelectConstellation}
        />
      )}
    </div>
  );
}
