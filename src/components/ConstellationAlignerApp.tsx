'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { starDataManager, NormalizedConstellation, RawConstellation } from '../core/StarDataManager';
import { OrbitalCameraController, GameState, SolvedStats } from '../core/OrbitalCameraController';
import { CelestialScene } from '../rendering/CelestialScene';
import { TelemetryHUD } from '../ui/TelemetryHUD';
import { ConstellationSelector } from '../ui/ConstellationSelector';
import { SettingsModal } from '../ui/SettingsModal';
import { HowToPlayBanner } from '../ui/HowToPlayBanner';
import { ControlSettings, loadControlSettings, saveControlSettings, DEFAULT_CONTROL_SETTINGS } from '../core/ControlSettings';
import { DevFestStartModal } from '../ui/DevFestStartModal';
import { DevFestLeaderboardModal } from '../ui/DevFestLeaderboardModal';
import { DevFestGameOverModal } from '../ui/DevFestGameOverModal';
import {
  getConstellationTierInfo,
  generateArcadeQueue,
  saveLeaderboardEntry,
  LeaderboardEntry,
  SolvedConstellationRecord,
} from '../core/DevFestArcadeManager';

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
  const [controlSettings, setControlSettings] = useState<ControlSettings>(loadControlSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  // DevFest Tournament State & Modals
  const [isStartModalOpen, setIsStartModalOpen] = useState<boolean>(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);
  const [isGameOverModalOpen, setIsGameOverModalOpen] = useState<boolean>(false);
  const [highlightEntryId, setHighlightEntryId] = useState<string | undefined>(undefined);

  const [isArcadeActive, setIsArcadeActive] = useState<boolean>(false);
  const [arcadePlayerName, setArcadePlayerName] = useState<string>('Stargazer');
  const [arcadeQueue, setArcadeQueue] = useState<string[]>([]);
  const [arcadeIndex, setArcadeIndex] = useState<number>(0);
  const [arcadeTimeBank, setArcadeTimeBank] = useState<number>(20.0);
  const [arcadeTotalActiveTime, setArcadeTotalActiveTime] = useState<number>(0);
  const [arcadeHistory, setArcadeHistory] = useState<SolvedConstellationRecord[]>([]);
  const [arcadeBonusNotice, setArcadeBonusNotice] = useState<{ bonusSec: number; label: string } | null>(null);

  const [gameOverEntry, setGameOverEntry] = useState<LeaderboardEntry | null>(null);
  const [gameOverRank, setGameOverRank] = useState<number>(1);
  const [isVictory, setIsVictory] = useState<boolean>(false);

  // Mutable refs for persistent callbacks inside render loops & controller
  const isArcadeActiveRef = useRef<boolean>(false);
  const arcadePlayerNameRef = useRef<string>('Stargazer');
  const arcadeQueueRef = useRef<string[]>([]);
  const arcadeIndexRef = useRef<number>(0);
  const arcadeTimeBankRef = useRef<number>(20.0);
  const arcadeTotalActiveTimeRef = useRef<number>(0);
  const arcadeHistoryRef = useRef<SolvedConstellationRecord[]>([]);
  const bonusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync refs when states change
  useEffect(() => {
    isArcadeActiveRef.current = isArcadeActive;
  }, [isArcadeActive]);

  useEffect(() => {
    arcadePlayerNameRef.current = arcadePlayerName;
  }, [arcadePlayerName]);

  useEffect(() => {
    arcadeQueueRef.current = arcadeQueue;
  }, [arcadeQueue]);

  useEffect(() => {
    arcadeIndexRef.current = arcadeIndex;
  }, [arcadeIndex]);

  useEffect(() => {
    arcadeTimeBankRef.current = arcadeTimeBank;
  }, [arcadeTimeBank]);

  useEffect(() => {
    arcadeTotalActiveTimeRef.current = arcadeTotalActiveTime;
  }, [arcadeTotalActiveTime]);

  useEffect(() => {
    arcadeHistoryRef.current = arcadeHistory;
  }, [arcadeHistory]);

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

        // Check if user has seen how-to-play guide
        try {
          const seenGuide = localStorage.getItem('starc_has_seen_guide');
          if (!seenGuide) {
            setShowHowToPlay(true);
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

  // Finish arcade session on game over / timeout
  const handleGameOverArcade = useCallback(() => {
    setIsArcadeActive(false);
    isArcadeActiveRef.current = false;
    controllerRef.current?.setFastDisplace(false);

    const history = arcadeHistoryRef.current;
    const score = history.length;
    const totalTimeSec = +arcadeTotalActiveTimeRef.current.toFixed(1);

    // Calculate refined average accuracy % & residual offset
    const avgAccuracy =
      score > 0
        ? +(history.reduce((sum, h) => sum + h.accuracy, 0) / score).toFixed(2)
        : 0;

    const avgOffsetDeg =
      score > 0
        ? +(history.reduce((sum, h) => sum + h.alphaDeg, 0) / score).toFixed(2)
        : 90.0;

    const result = saveLeaderboardEntry({
      playerName: arcadePlayerNameRef.current,
      score,
      totalConstellations: 88,
      totalTimeSec,
      avgAccuracy,
      avgOffsetDeg,
      isAllCleared: false,
      history,
    });

    setGameOverEntry(result.entry);
    setGameOverRank(result.rank);
    setHighlightEntryId(result.entry.id);
    setIsVictory(false);
    setIsGameOverModalOpen(true);
  }, []);

  // Complete arcade session on conquering all 88 constellations!
  const handleCompleteArcade = useCallback(
    (history: SolvedConstellationRecord[], totalTimeSec: number) => {
      setIsArcadeActive(false);
      isArcadeActiveRef.current = false;
      controllerRef.current?.setFastDisplace(false);

      const avgAccuracy = +(
        history.reduce((sum, h) => sum + h.accuracy, 0) / 88
      ).toFixed(2);
      const avgOffsetDeg = +(
        history.reduce((sum, h) => sum + h.alphaDeg, 0) / 88
      ).toFixed(2);

      const result = saveLeaderboardEntry({
        playerName: arcadePlayerNameRef.current,
        score: 88,
        totalConstellations: 88,
        totalTimeSec: +totalTimeSec.toFixed(1),
        avgAccuracy,
        avgOffsetDeg,
        isAllCleared: true,
        history,
      });

      setGameOverEntry(result.entry);
      setGameOverRank(result.rank);
      setHighlightEntryId(result.entry.id);
      setIsVictory(true);
      setIsGameOverModalOpen(true);
    },
    []
  );

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
        if (isArcadeActiveRef.current) {
          arcadeTimeBankRef.current = timeLeft;
        }
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

        // If in DevFest Arcade Tournament Mode:
        if (isArcadeActiveRef.current && norm) {
          const tierInfo = getConstellationTierInfo(norm.starCount);
          const bonus = tierInfo.bonusSec;

          // Calculate remaining timer + reward bonus
          const currentRemaining = controllerRef.current?.getPuzzleTimer() || 0;
          const newBank = +(currentRemaining + bonus).toFixed(1);

          controllerRef.current?.setCustomPuzzleTimer(newBank);
          setTimerSec(newBank);
          setArcadeTimeBank(newBank);
          arcadeTimeBankRef.current = newBank;

          const record: SolvedConstellationRecord = {
            constellationId: stats.constellationId,
            constellationName: stats.constellationName,
            starCount: norm.starCount,
            tier: tierInfo.tier,
            timeSpentSec: stats.timeSpentSec,
            accuracy: stats.finalAccuracy,
            alphaDeg: stats.finalAlphaDeg,
            bonusSec: bonus,
          };

          const newHistory = [...arcadeHistoryRef.current, record];
          arcadeHistoryRef.current = newHistory;
          setArcadeHistory(newHistory);

          const newTotalTime = +(
            arcadeTotalActiveTimeRef.current + stats.timeSpentSec
          ).toFixed(1);
          arcadeTotalActiveTimeRef.current = newTotalTime;
          setArcadeTotalActiveTime(newTotalTime);

          // Show floating visual bonus notification
          setArcadeBonusNotice({ bonusSec: bonus, label: tierInfo.bonusLabel });
          if (bonusTimeoutRef.current) clearTimeout(bonusTimeoutRef.current);
          bonusTimeoutRef.current = setTimeout(() => {
            setArcadeBonusNotice(null);
          }, 2500);

          // Check if solved all 88 constellations
          if (newHistory.length >= 88) {
            handleCompleteArcade(newHistory, newTotalTime);
          }
        }
      },
      onTimeout: () => {
        if (isArcadeActiveRef.current) {
          handleGameOverArcade();
        } else {
          setShowTimeoutModal(true);
        }
      },
    });

    controller.setControlSettings(controlSettings);
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
      if (bonusTimeoutRef.current) clearTimeout(bonusTimeoutRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
      window.removeEventListener('blur', handleGlobalPointerUp);
      scene.dispose();
      sceneRef.current = null;
      controllerRef.current = null;
    };
  }, [isDataLoaded, constellationList, handleGameOverArcade, handleCompleteArcade]);

  // Pointer event handlers for 360 Earth gaze & orbital puzzle rotation
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.buttons !== 1) return;
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    controllerRef.current?.handlePointerDown(e.clientX, e.clientY);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
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

  // Constellation selection (free explorer mode)
  const handleSelectConstellation = useCallback((id: string) => {
    controllerRef.current?.handlePointerUp();
    const norm = starDataManager.getNormalizedConstellation(id);
    if (!norm || !sceneRef.current || !controllerRef.current) return;

    setActiveConstellation(norm);
    sceneRef.current.setActiveConstellation(norm);
    controllerRef.current.selectConstellation(norm, true);
    setIsCatalogOpen(false);
  }, []);

  // Start DevFest Arcade Speedrun Tournament
  const handleStartArcade = useCallback(
    (playerName: string) => {
      setIsStartModalOpen(false);
      setIsLeaderboardOpen(false);
      setIsGameOverModalOpen(false);
      setShowTimeoutModal(false);
      setSolvedStats(null);

      // 1. Generate progressive 88-constellation queue (Easy -> Medium -> Hard)
      const queue = generateArcadeQueue(constellationList);
      setArcadeQueue(queue);
      arcadeQueueRef.current = queue;

      setArcadeIndex(0);
      arcadeIndexRef.current = 0;

      setArcadePlayerName(playerName);
      arcadePlayerNameRef.current = playerName;

      setArcadeHistory([]);
      arcadeHistoryRef.current = [];

      setArcadeTotalActiveTime(0);
      arcadeTotalActiveTimeRef.current = 0;

      setArcadeBonusNotice(null);
      setIsVictory(false);

      setIsArcadeActive(true);
      isArcadeActiveRef.current = true;

      // 2. Set fast displace mode & initial 20.0s time bank
      controllerRef.current?.setFastDisplace(true);
      controllerRef.current?.setCustomPuzzleTimer(20.0);
      setTimerSec(20.0);
      setArcadeTimeBank(20.0);
      arcadeTimeBankRef.current = 20.0;

      // 3. Load first constellation from queue
      const firstId = queue[0];
      const norm = starDataManager.getNormalizedConstellation(firstId);
      if (norm && sceneRef.current && controllerRef.current) {
        setActiveConstellation(norm);
        sceneRef.current.setActiveConstellation(norm);
        controllerRef.current.selectConstellation(norm, true);
      }
    },
    [constellationList]
  );

  // Next constellation action
  const handleNextConstellation = useCallback(() => {
    if (isArcadeActiveRef.current) {
      const queue = arcadeQueueRef.current;
      const nextIndex = arcadeIndexRef.current + 1;

      if (nextIndex < queue.length) {
        setArcadeIndex(nextIndex);
        arcadeIndexRef.current = nextIndex;

        // Carry over remaining time bank into next puzzle
        controllerRef.current?.setCustomPuzzleTimer(arcadeTimeBankRef.current);

        const nextId = queue[nextIndex];
        const norm = starDataManager.getNormalizedConstellation(nextId);
        if (norm && sceneRef.current && controllerRef.current) {
          setActiveConstellation(norm);
          sceneRef.current.setActiveConstellation(norm);
          controllerRef.current.selectConstellation(norm, true);
        }
      } else {
        // Conquered all 88 constellations!
        handleCompleteArcade(arcadeHistoryRef.current, arcadeTotalActiveTimeRef.current);
      }
    } else {
      // Free Explorer mode: cycle next
      if (!activeConstellation || constellationList.length === 0) return;
      const currentIndex = constellationList.findIndex((c) => c.id === activeConstellation.id);
      const nextIndex = (currentIndex + 1) % constellationList.length;
      const nextRaw = constellationList[nextIndex];
      handleSelectConstellation(nextRaw.id);
    }
  }, [
    activeConstellation,
    constellationList,
    handleSelectConstellation,
    handleCompleteArcade,
  ]);

  // Spacebar hotkey to rapidly advance upon solve in arcade tournament
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && gameState === 'RESOLVED') {
        e.preventDefault();
        handleNextConstellation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, handleNextConstellation]);

  // Auto-advance after 2.5s on solve in arcade tournament mode
  useEffect(() => {
    if (gameState === 'RESOLVED' && isArcadeActive) {
      const autoAdvanceTimer = setTimeout(() => {
        handleNextConstellation();
      }, 2500);
      return () => clearTimeout(autoAdvanceTimer);
    }
  }, [gameState, isArcadeActive, handleNextConstellation]);

  // Return to Earth Hub
  const handleReturnToEarthHub = useCallback(() => {
    if (isArcadeActiveRef.current) {
      // Forfeiting active arcade run
      handleGameOverArcade();
    } else {
      controllerRef.current?.transitionTo('EARTH_HUB');
      setShowTimeoutModal(false);
      setSolvedStats(null);
    }
  }, [handleGameOverArcade]);

  // Retry orbit on timeout (free explorer mode)
  const handleRetryOrbit = useCallback(() => {
    setShowTimeoutModal(false);
    controllerRef.current?.retryOrbit();
  }, []);

  // Auto-align on timeout (free explorer mode)
  const handleAutoAlign = useCallback(() => {
    setShowTimeoutModal(false);
    controllerRef.current?.autoAlignToEarth();
  }, []);

  // Sky View Lines Toggle
  const handleToggleAllLines = useCallback(() => {
    setShowAllLines((prev) => {
      const next = !prev;
      sceneRef.current?.setAllConstellationLinesVisible(next, true);
      setShowArt(next);
      return next;
    });
  }, []);

  // Sky View Art Toggle
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

  // Control Settings handlers
  const handleUpdateControlSettings = useCallback((newPartial: Partial<ControlSettings>) => {
    setControlSettings((prev) => {
      const updated = { ...prev, ...newPartial };
      saveControlSettings(updated);
      controllerRef.current?.setControlSettings(updated);
      return updated;
    });
  }, []);

  const handleResetControlSettings = useCallback(() => {
    const reset = { ...DEFAULT_CONTROL_SETTINGS };
    setControlSettings(reset);
    saveControlSettings(reset);
    controllerRef.current?.setControlSettings(reset);
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
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black text-purple-300 p-6 text-center space-y-2">
          <div className="text-sm font-semibold tracking-wide">
            Unable to load stellar data
          </div>
          <div className="text-xs text-white/40 max-w-md">{loadError}</div>
        </div>
      )}

      {/* Telemetry HUD */}
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
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenHowToPlay={() => setShowHowToPlay(true)}
          // DevFest Arcade Tournament Props
          isArcadeActive={isArcadeActive}
          arcadePlayerName={arcadePlayerName}
          arcadeStage={arcadeIndex + 1}
          arcadeTotalSolved={arcadeHistory.length}
          arcadeBonusNotice={arcadeBonusNotice}
          onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
          onStartArcadeChallenge={() => setIsStartModalOpen(true)}
        />
      )}

      {/* Earth Hub Constellation Catalog Selector (in non-arcade mode) */}
      {isDataLoaded && gameState === 'EARTH_HUB' && !isArcadeActive && (
        <ConstellationSelector
          constellations={constellationList}
          activeId={activeConstellation?.id || null}
          solvedIds={solvedIds}
          isOpen={isCatalogOpen}
          onToggle={() => setIsCatalogOpen((prev) => !prev)}
          onSelect={handleSelectConstellation}
        />
      )}

      {/* Control Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={controlSettings}
        onUpdateSettings={handleUpdateControlSettings}
        onResetSettings={handleResetControlSettings}
      />

      {/* How to Play Banner (6-Step Directive) */}
      <HowToPlayBanner
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
      />

      {/* DevFest Arcade Start Registration Modal */}
      <DevFestStartModal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        onStart={handleStartArcade}
        onOpenLeaderboard={() => {
          setIsStartModalOpen(false);
          setIsLeaderboardOpen(true);
        }}
      />

      {/* DevFest Tournament Leaderboard Modal */}
      <DevFestLeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        onStartNewGame={() => {
          setIsLeaderboardOpen(false);
          setIsStartModalOpen(true);
        }}
        highlightId={highlightEntryId}
      />

      {/* DevFest Game Over / Session Complete Modal */}
      <DevFestGameOverModal
        isOpen={isGameOverModalOpen}
        entry={gameOverEntry}
        rank={gameOverRank}
        isVictory={isVictory}
        onViewLeaderboard={() => {
          setIsGameOverModalOpen(false);
          setIsLeaderboardOpen(true);
        }}
        onPlayAgain={() => {
          setIsGameOverModalOpen(false);
          setIsStartModalOpen(true);
        }}
        onReturnToSky={() => {
          setIsGameOverModalOpen(false);
          controllerRef.current?.transitionTo('EARTH_HUB');
        }}
      />
    </div>
  );
}
