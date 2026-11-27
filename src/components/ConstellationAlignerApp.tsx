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
import { soundEngine } from '../core/SoundEngine';
import { DevFestStartModal } from '../ui/DevFestStartModal';
import { DevFestLeaderboardModal } from '../ui/DevFestLeaderboardModal';
import { DevFestGameOverModal } from '../ui/DevFestGameOverModal';
import {
  getConstellationTierInfo,
  calculateAccuracyBonus,
  calculateCompetitiveScore,
  generateArcadeQueue,
  saveLeaderboardEntry,
  pickBestAttempt,
  getProjectedRank,
  MAX_ARCADE_ATTEMPTS,
  AttemptResult,
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
  const [controlSettings, setControlSettings] = useState<ControlSettings>(loadControlSettings());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => soundEngine.isEnabled());
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

  // Consecutive 2-attempt session tracking (highest of up to 2 attempts is recorded)
  const [arcadeAttempts, setArcadeAttempts] = useState<AttemptResult[]>([]);
  const [currentAttemptNumber, setCurrentAttemptNumber] = useState<number>(1);
  const [bestAttempt, setBestAttempt] = useState<AttemptResult | null>(null);
  const [isSessionFinalized, setIsSessionFinalized] = useState<boolean>(false);

  // Mutable refs for persistent callbacks inside render loops & controller
  const isArcadeActiveRef = useRef<boolean>(false);
  const arcadePlayerNameRef = useRef<string>('Stargazer');
  const arcadePlayerEmailRef = useRef<string>('');
  const arcadePlayerPhoneRef = useRef<string | undefined>(undefined);
  const arcadePlayerIdRef = useRef<number | null>(null);
  const arcadeQueueRef = useRef<string[]>([]);
  const arcadeIndexRef = useRef<number>(0);
  const arcadeTimeBankRef = useRef<number>(20.0);
  const arcadeTotalActiveTimeRef = useRef<number>(0);
  const arcadeHistoryRef = useRef<SolvedConstellationRecord[]>([]);
  const arcadeAttemptsRef = useRef<AttemptResult[]>([]);
  const currentAttemptNumberRef = useRef<number>(1);
  const isSessionFinalizedRef = useRef<boolean>(false);
  const bonusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for throttling HUD React state updates while WebGL runs at full 60-120fps
  const gameStateRef = useRef<GameState>('EARTH_HUB');
  const lastUiSyncMsRef = useRef<number>(0);
  const lastAlphaTenthsRef = useRef<number>(-1);
  const lastAccuracyTenthsRef = useRef<number>(-1);
  const lastTimerTenthsRef = useRef<number>(-1);

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

  // Commit the highest of the player's consecutive attempts (up to 2) to leaderboard & SQLite once
  const finalizeArcadeSession = useCallback((attemptsOverride?: AttemptResult[]) => {
    if (isSessionFinalizedRef.current) return;
    const attempts = attemptsOverride ?? arcadeAttemptsRef.current;
    if (attempts.length === 0) return;

    isSessionFinalizedRef.current = true;
    setIsSessionFinalized(true);

    const best = pickBestAttempt(attempts);
    setBestAttempt(best);

    const result = saveLeaderboardEntry({
      playerName: arcadePlayerNameRef.current,
      email: arcadePlayerEmailRef.current || undefined,
      phone: arcadePlayerPhoneRef.current || undefined,
      points: best.points,
      score: best.score,
      avgAccuracy: best.avgAccuracy,
      totalTimeSec: best.totalTimeSec,
    });

    if (arcadePlayerIdRef.current !== null) {
      fetch('/api/players', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: arcadePlayerIdRef.current,
          points: result.entry.points,
          score: best.score,
          totalTimeSec: best.totalTimeSec,
          avgAccuracy: best.avgAccuracy,
          attempts: attempts.length,
        }),
      }).catch(() => {});
    }

    setGameOverEntry(result.entry);
    setGameOverRank(result.rank);
    setHighlightEntryId(result.entry.id);
    setIsVictory(best.isAllCleared);
  }, []);

  // Record a finished attempt; automatically finalize after the 2nd consecutive attempt
  const recordCompletedAttempt = useCallback(
    (history: SolvedConstellationRecord[], totalTimeSec: number, isAllCleared: boolean) => {
      setIsArcadeActive(false);
      isArcadeActiveRef.current = false;
      controllerRef.current?.setFastDisplace(false);

      const score = history.length;
      const roundedTime = +totalTimeSec.toFixed(1);
      const avgAccuracy =
        score > 0
          ? +(history.reduce((sum, h) => sum + h.accuracy, 0) / score).toFixed(2)
          : 0;
      const avgOffsetDeg =
        score > 0
          ? +(history.reduce((sum, h) => sum + h.alphaDeg, 0) / score).toFixed(2)
          : 90.0;
      const points = calculateCompetitiveScore(score, avgAccuracy, roundedTime);

      const attemptResult: AttemptResult = {
        attemptNumber: currentAttemptNumberRef.current,
        points,
        score,
        totalConstellations: 88,
        totalTimeSec: roundedTime,
        avgAccuracy,
        avgOffsetDeg,
        isAllCleared,
        history,
      };

      const nextAttempts = [...arcadeAttemptsRef.current, attemptResult];
      arcadeAttemptsRef.current = nextAttempts;
      setArcadeAttempts(nextAttempts);

      const best = pickBestAttempt(nextAttempts);
      setBestAttempt(best);

      if (nextAttempts.length >= MAX_ARCADE_ATTEMPTS) {
        // Final consecutive attempt complete — record highest attempt permanently
        finalizeArcadeSession(nextAttempts);
      } else {
        // Retries still available — show projected rank for best attempt so far without duplicating DB rows
        const projectedRank = getProjectedRank(best);
        setGameOverEntry({
          id: `preview-${Date.now()}`,
          playerName: arcadePlayerNameRef.current,
          email: arcadePlayerEmailRef.current || undefined,
          phone: arcadePlayerPhoneRef.current || undefined,
          points: best.points,
          score: best.score,
          totalTimeSec: best.totalTimeSec,
          avgAccuracy: best.avgAccuracy,
          isAllCleared: best.isAllCleared,
        });
        setGameOverRank(projectedRank);
        setIsVictory(attemptResult.isAllCleared);
      }

      setIsGameOverModalOpen(true);
    },
    [finalizeArcadeSession]
  );

  // Finish arcade attempt on game over / timeout
  const handleGameOverArcade = useCallback(() => {
    recordCompletedAttempt(
      arcadeHistoryRef.current,
      arcadeTotalActiveTimeRef.current,
      false
    );
  }, [recordCompletedAttempt]);

  // Complete arcade attempt on conquering all 88 constellations!
  const handleCompleteArcade = useCallback(
    (history: SolvedConstellationRecord[], totalTimeSec: number) => {
      recordCompletedAttempt(history, totalTimeSec, true);
    },
    [recordCompletedAttempt]
  );

  // 2. Initialize Three.js scene and OrbitalCameraController
  useEffect(() => {
    if (!isDataLoaded || !mountRef.current) return;

    const container = mountRef.current;
    const scene = new CelestialScene(container);
    sceneRef.current = scene;

    // Load HYG background starfield
    const starfieldData = starDataManager.getRawStarfield();
    if (starfieldData) {
      scene.initBackgroundStarfield(starfieldData);
    }

    // Initialize progressive wave animated lines for all 88 constellations
    const allLinesData = starDataManager.getAllConstellationAnimatedLines();
    if (allLinesData) {
      scene.initAllConstellationLines(allLinesData);
    }

    // Initialize highlighted blue pixel stars for all 88 constellations in Sky View
    const allConstStarsData = starDataManager.getAllConstellationStarPoints();
    if (allConstStarsData.count > 0) {
      scene.initAllConstellationStars(allConstStarsData);
    }

    // Initialize all 88 celestial constellation artwork plates on the sphere
    const allNormConsts = starDataManager.getAllNormalizedConstellations();
    if (allNormConsts.length > 0) {
      scene.initAllConstellationArt(allNormConsts);
    }

    // Initialize controller with callbacks
    const controller = new OrbitalCameraController(scene.camera, {
      onStateChange: (newState) => {
        gameStateRef.current = newState;
        lastUiSyncMsRef.current = 0;
        lastAlphaTenthsRef.current = -1;
        lastAccuracyTenthsRef.current = -1;
        lastTimerTenthsRef.current = -1;

        setGameState(newState);
        if (newState === 'PREVIEW') {
          soundEngine.stopResonance();
          soundEngine.playPreviewLock();
        } else if (newState === 'DISPLACE') {
          soundEngine.stopResonance();
          soundEngine.playDisplaceWhoosh();
        } else if (newState === 'ALIGN_PUZZLE') {
          setShowTimeoutModal(false);
          setSolvedStats(null);
        } else if (newState === 'EARTH_HUB') {
          soundEngine.stopResonance();
          setShowTimeoutModal(false);
        }
      },
      onAlignmentUpdate: (alpha, acc) => {
        const isAligning = gameStateRef.current === 'ALIGN_PUZZLE';
        soundEngine.updateResonance(acc, isAligning);

        // Only update React HUD telemetry during ALIGN_PUZZLE (at ~20Hz & when displayed 0.1 values change)
        if (!isAligning) return;
        const now = performance.now();
        if (now - lastUiSyncMsRef.current < 48) return;

        const alphaTenths = Math.round(alpha * 10);
        const accTenths = Math.round(acc * 10);
        if (alphaTenths !== lastAlphaTenthsRef.current || accTenths !== lastAccuracyTenthsRef.current) {
          lastUiSyncMsRef.current = now;
          lastAlphaTenthsRef.current = alphaTenths;
          lastAccuracyTenthsRef.current = accTenths;
          setAlphaDeg(alpha);
          setAccuracy(acc);
        }
      },
      onTimerUpdate: (timeLeft) => {
        if (isArcadeActiveRef.current) {
          arcadeTimeBankRef.current = timeLeft;
        }
        soundEngine.checkLowTimeTick(timeLeft);

        const tenths = Math.round(timeLeft * 10);
        if (tenths !== lastTimerTenthsRef.current) {
          lastTimerTenthsRef.current = tenths;
          setTimerSec(timeLeft);
        }
      },
      onSolved: (stats) => {
        setSolvedStats(stats);

        // If user clicked "Show Alignment" after timeout, preview true Earth view without crediting a solve
        if (stats.isAutoAligned) {
          soundEngine.stopResonance();
          soundEngine.playPreviewLock();
          return;
        }

        soundEngine.playSolvedChord();

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
          const bonus = calculateAccuracyBonus(norm.starCount, stats.finalAccuracy);

          // Calculate remaining timer + accuracy-scaled reward bonus
          const currentRemaining = controllerRef.current?.getPuzzleTimer() || 0;
          const newBank = +(currentRemaining + bonus).toFixed(2);

          controllerRef.current?.setCustomPuzzleTimer(newBank);
          lastTimerTenthsRef.current = Math.round(newBank * 10);
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
          setArcadeBonusNotice({ bonusSec: bonus, label: `+${bonus.toFixed(2)}s` });
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
        soundEngine.playTimeoutTone();
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

    // Start from the very first constellation (#1 of 88)
    const initialConstellation =
      (constellationList[0]
        ? starDataManager.getNormalizedConstellation(constellationList[0].id)
        : null) ||
      starDataManager.getNormalizedConstellation('And');

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
      controller.handlePointerUp(true);
    };
    const handleGlobalPointerCancel = () => {
      controller.handlePointerUp(false);
    };
    const handleWindowBlur = () => {
      controller.handlePointerUp(false);
      soundEngine.stopResonance();
    };
    const handleUserActivity = () => {
      controller.notifyUserActivity();
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerCancel);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('pointerdown', handleUserActivity, { passive: true });
    window.addEventListener('pointermove', handleUserActivity, { passive: true });
    window.addEventListener('wheel', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity, { passive: true });

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (bonusTimeoutRef.current) clearTimeout(bonusTimeoutRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerCancel);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('pointerdown', handleUserActivity);
      window.removeEventListener('pointermove', handleUserActivity);
      window.removeEventListener('wheel', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      soundEngine.stopResonance();
      scene.dispose();
      sceneRef.current = null;
      controllerRef.current = null;
    };
  }, [isDataLoaded, constellationList, handleGameOverArcade, handleCompleteArcade]);

  // Pointer event handlers for 360 Earth gaze & orbital puzzle rotation
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    soundEngine.unlock();
    if (e.button !== 0 && e.buttons !== 1) return;
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    controllerRef.current?.handlePointerDown(e.clientX, e.clientY);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (e.buttons === 0) {
      controllerRef.current?.handlePointerUp(true);
      return;
    }
    controllerRef.current?.handlePointerMove(e.clientX, e.clientY, e.buttons);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    controllerRef.current?.handlePointerUp(true);
  }, []);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    controllerRef.current?.handlePointerUp(false);
  }, []);

  // Constellation selection (free explorer mode)
  const handleSelectConstellation = useCallback((id: string) => {
    soundEngine.unlock();
    controllerRef.current?.handlePointerUp(false);
    const norm = starDataManager.getNormalizedConstellation(id);
    if (!norm || !sceneRef.current || !controllerRef.current) return;

    setActiveConstellation(norm);
    sceneRef.current.setActiveConstellation(norm);
    controllerRef.current.selectConstellation(norm, true);
    setIsCatalogOpen(false);
  }, []);

  // Launch a single consecutive arcade attempt (1 or 2) starting from #1 Andromeda
  const launchArcadeAttempt = useCallback(
    (attemptNumber: number) => {
      soundEngine.unlock();
      setIsStartModalOpen(false);
      setIsLeaderboardOpen(false);
      setIsGameOverModalOpen(false);
      setShowTimeoutModal(false);
      setSolvedStats(null);

      setCurrentAttemptNumber(attemptNumber);
      currentAttemptNumberRef.current = attemptNumber;

      // 1. Generate deterministic 1-to-88 constellation queue (no randomization)
      const queue = generateArcadeQueue(constellationList);
      setArcadeQueue(queue);
      arcadeQueueRef.current = queue;

      setArcadeIndex(0);
      arcadeIndexRef.current = 0;

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

  // Start a new player's 2-attempt DevFest Arcade Speedrun session
  const handleStartArcade = useCallback(
    (playerName: string, playerId?: number, playerEmail?: string, playerPhone?: string) => {
      setArcadePlayerName(playerName);
      arcadePlayerNameRef.current = playerName;
      arcadePlayerEmailRef.current = playerEmail?.trim() || '';
      arcadePlayerPhoneRef.current = playerPhone?.trim() || undefined;
      arcadePlayerIdRef.current = typeof playerId === 'number' ? playerId : null;

      setArcadeAttempts([]);
      arcadeAttemptsRef.current = [];
      setBestAttempt(null);
      setHighlightEntryId(undefined);
      setIsSessionFinalized(false);
      isSessionFinalizedRef.current = false;

      launchArcadeAttempt(1);
    },
    [launchArcadeAttempt]
  );

  // Consecutive retry for the same player (strictly capped at MAX_ARCADE_ATTEMPTS = 2)
  const handleRetryArcadeAttempt = useCallback(() => {
    if (isSessionFinalizedRef.current) return;
    if (arcadeAttemptsRef.current.length >= MAX_ARCADE_ATTEMPTS) return;
    launchArcadeAttempt(arcadeAttemptsRef.current.length + 1);
  }, [launchArcadeAttempt]);

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
    if (gameState === 'RESOLVED' && isArcadeActive && !isGameOverModalOpen) {
      const autoAdvanceTimer = setTimeout(() => {
        handleNextConstellation();
      }, 2500);
      return () => clearTimeout(autoAdvanceTimer);
    }
  }, [gameState, isArcadeActive, isGameOverModalOpen, handleNextConstellation]);

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
    const next = !showAllLines;
    setShowAllLines(next);
    setShowArt(next);
    sceneRef.current?.setAllConstellationLinesVisible(next, true);
  }, [showAllLines]);

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

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      soundEngine.setEnabled(next);
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
        onPointerCancel={handlePointerCancel}
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
          onStartAlignment={() => {
            soundEngine.unlock();
            controllerRef.current?.handlePointerUp(false);
            controllerRef.current?.transitionTo('PREVIEW');
          }}
          onNextConstellation={handleNextConstellation}
          onReturnToEarthHub={handleReturnToEarthHub}
          onRetryOrbit={handleRetryOrbit}
          onAutoAlign={handleAutoAlign}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenHowToPlay={() => setShowHowToPlay(true)}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          hideResolvedModal={isGameOverModalOpen}
          // DevFest Arcade Tournament Props
          isArcadeActive={isArcadeActive}
          arcadePlayerName={arcadePlayerName}
          arcadeStage={arcadeIndex + 1}
          arcadeTotalSolved={arcadeHistory.length}
          arcadeAttempt={currentAttemptNumber}
          arcadeMaxAttempts={MAX_ARCADE_ATTEMPTS}
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
        attempts={arcadeAttempts}
        maxAttempts={MAX_ARCADE_ATTEMPTS}
        bestAttempt={bestAttempt}
        isFinalized={isSessionFinalized}
        onRetryAttempt={handleRetryArcadeAttempt}
        onFinishSession={() => finalizeArcadeSession()}
        onViewLeaderboard={() => {
          finalizeArcadeSession();
          setIsGameOverModalOpen(false);
          setIsLeaderboardOpen(true);
        }}
        onNextAttendee={() => {
          finalizeArcadeSession();
          setIsGameOverModalOpen(false);
          setIsStartModalOpen(true);
        }}
        onReturnToSky={() => {
          finalizeArcadeSession();
          setIsGameOverModalOpen(false);
          controllerRef.current?.transitionTo('EARTH_HUB');
        }}
      />
    </div>
  );
}
