'use client';

import React from 'react';
import { PuzzleLevel } from './levels';
import {
  Sparkles,
  RotateCcw,
  Volume2,
  VolumeX,
  Compass,
  ArrowRight,
  Eye,
  CheckCircle2,
  Grid,
  Trophy,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PerspectiveGameHUDProps {
  level: PuzzleLevel;
  levelIndex: number;
  totalLevels: number;
  accuracy: number;
  isSolved: boolean;
  soundEnabled: boolean;
  showGhostHint: boolean;
  onToggleSound: () => void;
  onToggleHint: () => void;
  onScramble: () => void;
  onNextLevel: () => void;
  onOpenLevelSelect: () => void;
  onOpenPlanetarium: () => void;
}

export default function PerspectiveGameHUD({
  level,
  levelIndex,
  totalLevels,
  accuracy,
  isSolved,
  soundEnabled,
  showGhostHint,
  onToggleSound,
  onToggleHint,
  onScramble,
  onNextLevel,
  onOpenLevelSelect,
  onOpenPlanetarium,
}: PerspectiveGameHUDProps) {
  // Fire celebratory starlight confetti on solve
  React.useEffect(() => {
    if (isSolved) {
      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.65 },
          colors: ['#38bdf8', '#f59e0b', '#ffffff', '#e0f2fe'],
        });
      } catch {}
    }
  }, [isSolved]);

  return (
    <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-4 md:p-8 z-30">
      {/* TOP HEADER */}
      <div className="flex items-start justify-between w-full">
        {/* Left: Level & Title */}
        <div className="pointer-events-auto bg-space-900/80 border border-white/10 rounded-2xl p-4 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-2 text-[10px] uppercase font-mono tracking-widest text-cyan-400">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            LEVEL {levelIndex + 1} OF {totalLevels} • TIER {level.tier}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white mt-0.5">
            {level.name.toUpperCase()}
          </h1>
          <div className="text-xs text-gray-300 font-medium italic">
            &ldquo;{level.subtitle}&rdquo;
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="pointer-events-auto flex items-center gap-2 bg-space-900/80 border border-white/10 rounded-2xl p-2 backdrop-blur-xl shadow-2xl">
          <button
            onClick={onOpenLevelSelect}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-cyan-300 flex items-center gap-1.5 transition-colors"
          >
            <Grid className="w-3.5 h-3.5" />
            LEVELS
          </button>
          <button
            onClick={onOpenPlanetarium}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-gray-300 hover:text-white transition-colors"
          >
            PLANETARIUM
          </button>
          <button
            onClick={onToggleSound}
            className="p-2 rounded-xl text-cyan-300 hover:bg-white/10 transition-colors"
            title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
          </button>
        </div>
      </div>

      {/* CENTER VICTORY CARD */}
      {isSolved && (
        <div className="pointer-events-auto self-center bg-space-900/95 border-2 border-amber-400/80 rounded-3xl p-6 md:p-8 max-w-md w-full backdrop-blur-2xl shadow-2xl shadow-amber-500/20 text-center animate-fadeIn">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-amber-300 animate-bounce">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div className="text-[10px] uppercase font-mono tracking-widest text-amber-400 font-bold">
            PERSPECTIVE HARMONIZED
          </div>
          <h2 className="text-3xl font-extrabold text-white mt-1">
            {level.name.toUpperCase()}
          </h2>
          <p className="text-xs text-cyan-300 font-medium italic mt-0.5">
            {level.subtitle}
          </p>

          <p className="text-xs text-gray-300 mt-4 leading-relaxed px-2 bg-black/40 py-3 rounded-xl border border-white/5">
            {level.description}
          </p>

          <div className="flex gap-3 mt-5">
            <button
              onClick={onScramble}
              className="py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-mono text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              RE-ALIGN
            </button>
            <button
              onClick={onNextLevel}
              className="flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold uppercase text-xs tracking-wider shadow-lg shadow-amber-500/30 transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              NEXT CONSTELLATION
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM SECTION: RESONANCE ALIGNMENT METER */}
      <div className="flex items-end justify-between w-full">
        {/* Left: Scramble & Rotate Assist */}
        <div className="pointer-events-auto flex items-center gap-2 bg-space-900/80 border border-white/10 rounded-2xl p-2 backdrop-blur-xl">
          <button
            onClick={onScramble}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-gray-300 hover:text-white flex items-center gap-2 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            SCRAMBLE 3D
          </button>
        </div>

        {/* Center: Glowing Resonance Alignment Meter (Shadowmatic / Monument Valley style) */}
        {!isSolved && (
          <div className="pointer-events-auto flex flex-col items-center max-w-sm w-full mx-4">
            <div className="flex items-center justify-between w-full px-2 mb-1.5 font-mono text-[11px]">
              <span className="text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                EARTH PERSPECTIVE ALIGNMENT
              </span>
              <span
                className={`font-bold transition-colors ${
                  accuracy > 85 ? 'text-amber-400' : accuracy > 50 ? 'text-cyan-300' : 'text-gray-500'
                }`}
              >
                {accuracy}%
              </span>
            </div>

            {/* Glowing Progress Track */}
            <div className="w-full h-3 bg-black/60 rounded-full border border-white/15 p-0.5 overflow-hidden backdrop-blur-md relative shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-75 ${
                  accuracy > 90
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 shadow-[0_0_15px_rgba(245,158,11,0.8)]'
                    : 'bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_12px_rgba(56,189,248,0.6)]'
                }`}
                style={{ width: `${accuracy}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-500 mt-1.5 font-mono">
              Drag mouse or finger to rotate in 3D space
            </div>
          </div>
        )}

        {/* Right: Hint / Instructions */}
        <div className="pointer-events-auto bg-space-900/80 border border-white/10 rounded-2xl p-3 backdrop-blur-xl text-right font-mono text-xs hidden sm:block">
          <div className="text-[10px] text-gray-400 uppercase tracking-widest">ASTRONOMICAL TRICK</div>
          <div className="text-cyan-300/80 text-[11px] mt-0.5 max-w-[200px] leading-tight">
            Stars are scattered in depth. Rotate until they align from Earth&apos;s angle.
          </div>
        </div>
      </div>
    </div>
  );
}
