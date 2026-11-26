'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Flame, Timer, Sparkles, Star, Zap, HelpCircle, Volume2, VolumeX } from 'lucide-react';
import { GameState, SolvedStats } from '../core/OrbitalCameraController';
import { NormalizedConstellation } from '../core/StarDataManager';
import { ReferenceSilhouette } from './ReferenceSilhouette';
import { getConstellationTierInfo, TierInfo } from '../core/DevFestArcadeManager';

interface TelemetryHUDProps {
  state: GameState;
  constellation: NormalizedConstellation | null;
  timerSec: number;
  alphaDeg: number;
  accuracy: number;
  solvedStats: SolvedStats | null;
  showTimeoutModal: boolean;
  showAllLines?: boolean;
  onToggleAllLines?: () => void;
  showArt?: boolean;
  onToggleArt?: () => void;
  onReplayLinesAnimation?: () => void;
  showGhostGuide?: boolean;
  onToggleGhostGuide?: () => void;
  showSkyPanorama?: boolean;
  onToggleSkyPanorama?: () => void;
  onStartAlignment?: () => void;
  onNextConstellation: () => void;
  onReturnToEarthHub: () => void;
  onRetryOrbit: () => void;
  onAutoAlign: () => void;
  onOpenSettings?: () => void;
  onOpenHowToPlay?: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  hideResolvedModal?: boolean;

  // DevFest Arcade Tournament Props
  isArcadeActive?: boolean;
  arcadePlayerName?: string;
  arcadeStage?: number;
  arcadeTotalSolved?: number;
  arcadeBonusNotice?: { bonusSec: number; label: string } | null;
  onOpenLeaderboard?: () => void;
  onStartArcadeChallenge?: () => void;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  state,
  constellation,
  timerSec,
  alphaDeg,
  accuracy,
  solvedStats,
  showTimeoutModal,
  showAllLines = false,
  onToggleAllLines,
  showArt = false,
  onToggleArt,
  onReplayLinesAnimation,
  showGhostGuide = false,
  onToggleGhostGuide,
  showSkyPanorama = true,
  onToggleSkyPanorama,
  onStartAlignment,
  onNextConstellation,
  onReturnToEarthHub,
  onRetryOrbit,
  onAutoAlign,
  onOpenSettings,
  onOpenHowToPlay,
  soundEnabled = true,
  onToggleSound,
  hideResolvedModal = false,
  isArcadeActive = false,
  arcadePlayerName = 'Stargazer',
  arcadeStage = 1,
  arcadeTotalSolved = 0,
  arcadeBonusNotice = null,
  onOpenLeaderboard,
  onStartArcadeChallenge,
}) => {
  // Fire confetti on genuine solve (skip on auto-align preview or hidden modal)
  useEffect(() => {
    if (state === 'RESOLVED' && solvedStats && !solvedStats.isAutoAligned && !hideResolvedModal) {
      try {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.65 },
          colors: ['#c084fc', '#a855f7', '#9333ea', '#7e22ce', '#e9d5ff'],
        });
      } catch {}
    }
  }, [state, solvedStats, hideResolvedModal]);

  // Format clean state label
  const getStateBadge = () => {
    switch (state) {
      case 'EARTH_HUB':
        return { label: 'Sky view' };
      case 'PREVIEW':
        return { label: 'Target lock' };
      case 'DISPLACE':
        return { label: 'Transitioning' };
      case 'ALIGN_PUZZLE':
        return { label: 'Aligning' };
      case 'RESOLVED':
        return { label: 'Aligned' };
    }
  };

  const badge = getStateBadge();
  const tierInfo: TierInfo | null = constellation
    ? getConstellationTierInfo(constellation.starCount)
    : null;

  // Timer styling
  const timerStyle =
    timerSec <= 0.0
      ? 'text-purple-300 border-purple-500/60 bg-black/90'
      : timerSec < 5.0
      ? 'text-purple-200 border-purple-400/80 bg-purple-950/50 animate-pulse ring-1 ring-purple-500/50'
      : isArcadeActive
      ? 'text-purple-100 border-purple-500/40 bg-black/80 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
      : 'text-purple-200 border-purple-500/25 bg-black/70';

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-20">
      {/* --- TOP BAR --- */}
      <header className="absolute top-0 left-0 right-0 p-4 sm:p-5 flex items-center justify-between gap-3 pointer-events-auto">
        {/* Left: State Badge, Arcade Info & Constellation Meta */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Arcade Callsign & Stage Badge */}
          {isArcadeActive ? (
            <div className="px-3.5 py-1.5 rounded-full border border-purple-400/40 bg-purple-950/40 backdrop-blur-xl flex items-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
              <Flame className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
              <span className="text-xs font-bold text-white tracking-wide">
                {arcadePlayerName}
              </span>
              <span className="text-[10px] text-purple-300/70 font-mono">
                STAGE {arcadeStage}/88
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200 font-bold font-mono">
                ★ {arcadeTotalSolved}
              </span>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-full border border-purple-500/20 text-xs font-medium text-purple-200 bg-black/75 backdrop-blur-xl flex items-center gap-2 shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span>{badge.label}</span>
            </div>
          )}

          {/* Active Constellation Badge */}
          {constellation && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/75 border border-purple-500/20 text-white backdrop-blur-xl shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
              <span className="text-xs font-semibold text-white">
                {constellation.name}
              </span>
              <span className="text-[10px] text-purple-400 font-mono">
                {constellation.id}
              </span>
              <span className="text-xs text-white/40 truncate max-w-[130px]">
                {constellation.english}
              </span>
            </div>
          )}

          {/* Tier Bonus Indicator (When aligning) */}
          {isArcadeActive && tierInfo && state === 'ALIGN_PUZZLE' && (
            <div
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${tierInfo.badgeBg} ${tierInfo.badgeBorder} ${tierInfo.badgeText} backdrop-blur-xl shadow-md`}
            >
              <Sparkles className="w-3 h-3" />
              <span>{tierInfo.label.toUpperCase()}</span>
              <span className="opacity-50">•</span>
              <span>{constellation?.starCount} stars</span>
              <span className="opacity-50">•</span>
              <span className="font-mono">{tierInfo.bonusLabel} Reward</span>
            </div>
          )}
        </div>

        {/* Right: Timer, Leaderboard & Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Tournament Leaderboard Button */}
          {onOpenLeaderboard && (
            <button
              onClick={onOpenLeaderboard}
              className="px-3.5 py-1.5 rounded-full bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/40 text-purple-200 text-xs font-semibold backdrop-blur-xl flex items-center gap-1.5 shadow-[0_0_15px_rgba(168,85,247,0.25)] transition-all active:scale-95"
              title="Open GDG DevFest Leaderboard"
            >
              <Trophy className="w-3.5 h-3.5 text-purple-300" />
              <span>Leaderboard</span>
            </button>
          )}

          {/* Sky View: Constellation Lines & Art Toggle */}
          {state === 'EARTH_HUB' && onToggleAllLines && (
            <div className="hidden md:flex items-center gap-1.5">
              <button
                onClick={onToggleAllLines}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium backdrop-blur-xl flex items-center gap-2 transition-all shadow-lg active:scale-95 ${
                  showAllLines
                    ? 'bg-purple-600/90 border-purple-400 text-white shadow-[0_0_18px_rgba(168,85,247,0.45)]'
                    : 'bg-black/75 hover:bg-black/95 border-purple-500/20 text-white/70 hover:text-white'
                }`}
                title={showAllLines ? 'Hide constellation lines & artwork' : 'Show constellation lines & celestial art'}
              >
                <span>Lines: <strong className={showAllLines ? 'text-purple-200' : 'text-white/40'}>{showAllLines ? 'ON' : 'OFF'}</strong></span>
              </button>

              {onToggleArt && (
                <button
                  onClick={onToggleArt}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium backdrop-blur-xl flex items-center gap-1.5 transition-all shadow-lg active:scale-95 ${
                    showArt
                      ? 'bg-purple-700/90 border-purple-400 text-white shadow-[0_0_18px_rgba(168,85,247,0.45)]'
                      : 'bg-black/75 hover:bg-black/95 border-purple-500/20 text-white/70 hover:text-white'
                  }`}
                  title="Toggle art figures"
                >
                  <span>Art: <strong className={showArt ? 'text-purple-200' : 'text-white/40'}>{showArt ? 'ON' : 'OFF'}</strong></span>
                </button>
              )}
            </div>
          )}

          {/* Quiz Target Alignment Guide Toggle */}
          {state === 'ALIGN_PUZZLE' && onToggleGhostGuide && (
            <button
              onClick={onToggleGhostGuide}
              className={`px-3 py-1.5 rounded-full border text-xs font-medium backdrop-blur-xl flex items-center gap-1.5 transition-all shadow-lg active:scale-95 ${
                showGhostGuide
                  ? 'bg-purple-700/90 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                  : 'bg-black/75 hover:bg-black/95 border-purple-500/20 text-white/50 hover:text-white'
              }`}
              title="Toggle target alignment guide lines overlay"
            >
              <span>Guide: <strong className={showGhostGuide ? 'text-purple-200' : 'text-white/40'}>{showGhostGuide ? 'ON' : 'OFF'}</strong></span>
            </button>
          )}

          {/* Countdown Timer Display (ALIGN_PUZZLE) */}
          {state === 'ALIGN_PUZZLE' && (
            <div
              className={`px-3.5 py-1.5 rounded-full border text-xs font-bold backdrop-blur-xl shadow-lg flex items-center gap-2 ${timerStyle}`}
            >
              <Timer className={`w-3.5 h-3.5 ${timerSec < 5.0 ? 'text-purple-300 animate-spin' : 'text-purple-400'}`} />
              <span className="tabular-nums font-mono text-sm">
                {timerSec.toFixed(1)}s
              </span>
            </div>
          )}

          {/* Abort / Exit Button (ALIGN_PUZZLE) */}
          {state === 'ALIGN_PUZZLE' && (
            <button
              onClick={onReturnToEarthHub}
              className="px-3 py-1.5 rounded-full bg-black/75 hover:bg-black/95 border border-purple-500/20 hover:border-purple-400/50 text-xs text-white/70 hover:text-white transition-all backdrop-blur-xl shadow-lg"
            >
              {isArcadeActive ? 'Forfeit' : 'Exit'}
            </button>
          )}

          {/* How to Play Guide Button */}
          {onOpenHowToPlay && (
            <button
              onClick={onOpenHowToPlay}
              className="px-3 py-1.5 rounded-full bg-black/75 hover:bg-purple-950/60 border border-purple-500/20 hover:border-purple-400/50 text-purple-200 hover:text-white transition-all backdrop-blur-xl flex items-center gap-1.5 text-xs font-semibold shadow-lg active:scale-95"
              title="How to Play (6 Steps Guide)"
            >
              <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">How to Play</span>
            </button>
          )}

          {/* Audio Mute / Unmute Button */}
          {onToggleSound && (
            <button
              onClick={onToggleSound}
              className={`w-8 h-8 rounded-full border transition-all backdrop-blur-xl flex items-center justify-center shadow-lg active:scale-95 ${
                soundEnabled
                  ? 'bg-black/75 hover:bg-purple-950/60 border-purple-500/20 hover:border-purple-400/50 text-purple-300 hover:text-white'
                  : 'bg-black/75 hover:bg-purple-950/60 border-white/10 text-white/40 hover:text-white/80'
              }`}
              title={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Control Settings Button */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="w-8 h-8 rounded-full bg-black/75 hover:bg-purple-950/60 border border-purple-500/20 hover:border-purple-400/50 text-purple-300 hover:text-white transition-all backdrop-blur-xl flex items-center justify-center shadow-lg active:scale-95"
              title="Control Settings (Invert X/Y axes, Sensitivity)"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <circle cx="12" cy="12" r="3" strokeWidth={1.8} />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* --- FLOATING REWARD NOTICE (ARCADE MODE) --- */}
      {arcadeBonusNotice && (
        <div className="absolute top-16 right-5 z-40 pointer-events-none animate-bounce">
          <div className="px-4 py-2 rounded-2xl bg-purple-900/40 border border-purple-400/50 text-purple-200 font-black text-sm shadow-[0_0_30px_rgba(168,85,247,0.4)] backdrop-blur-xl flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-300" />
            <span>+{arcadeBonusNotice.bonusSec}s TIME REWARD!</span>
          </div>
        </div>
      )}

      {/* --- 2D TARGET SILHOUETTE (ALIGN_PUZZLE & PREVIEW) --- */}
      {(state === 'ALIGN_PUZZLE' || state === 'PREVIEW') && (
        <div className="absolute top-20 right-5 z-20 animate-in fade-in duration-300">
          <ReferenceSilhouette constellation={constellation} />
        </div>
      )}

      {/* --- PREVIEW NOTIFICATION --- */}
      {state === 'PREVIEW' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-black/80 border border-purple-500/30 rounded-full text-center backdrop-blur-xl shadow-2xl flex items-center gap-2 animate-fadeIn">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-xs text-white/90 font-medium">Memorize target constellation shape</span>
        </div>
      )}

      {/* --- BOTTOM ALIGNMENT HUD (ALIGN_PUZZLE) --- */}
      {state === 'ALIGN_PUZZLE' && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[92vw] max-w-sm z-20 pointer-events-auto animate-fadeIn">
          <div className="bg-black/85 border border-purple-500/20 rounded-2xl p-4 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_24px_rgba(168,85,247,0.15)] space-y-2.5">
            {/* Numbers */}
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-white/60">
                Offset: <span className="text-white font-semibold tabular-nums">{alphaDeg.toFixed(1)}&deg;</span>
              </span>
              <span className="text-white/60">
                Match:{' '}
                <span
                  className={`font-semibold tabular-nums ${
                    accuracy >= 96.0 ? 'text-purple-300 animate-pulse' : 'text-purple-400'
                  }`}
                >
                  {accuracy.toFixed(1)}%
                </span>
              </span>
            </div>

            {/* Progress Bar */}
            <div className="relative w-full h-2 bg-white/[0.06] rounded-full overflow-hidden border border-purple-500/15">
              {/* Target lock threshold mark at alpha = 3.5 deg (acc = 96.1%) */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-purple-300 z-10 opacity-70"
                style={{ left: `${(1.0 - 3.5 / 90.0) * 100}%` }}
              />

              {/* Filling bar */}
              <div
                className={`h-full transition-all duration-75 rounded-full ${
                  accuracy >= 96.0
                    ? 'bg-gradient-to-r from-purple-600 to-purple-300 shadow-[0_0_12px_rgba(192,132,252,0.9)]'
                    : 'bg-gradient-to-r from-purple-900 via-purple-700 to-purple-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, accuracy))}%` }}
              />
            </div>

            {/* Guidance */}
            <div className="flex items-center justify-between text-[11px] text-white/40 pt-0.5">
              <span className="flex items-center gap-1.5 text-purple-300/80">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                Align 3D lines into guide
              </span>
              <span className="text-purple-300/70 font-mono">Snap &le; 3.5&deg;</span>
            </div>
          </div>
        </div>
      )}

      {/* --- EARTH HUB: BOTTOM BAR --- */}
      {state === 'EARTH_HUB' && constellation && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex flex-col items-center gap-3 animate-fadeIn">
          {/* Main DevFest Speedrun Launcher Call-to-Action */}
          {onStartArcadeChallenge && (
            <button
              onClick={onStartArcadeChallenge}
              className="px-6 py-3 bg-gradient-to-r from-purple-700 via-purple-600 to-purple-800 hover:from-purple-600 hover:to-purple-700 active:scale-95 text-white font-extrabold text-xs sm:text-sm rounded-2xl transition-all shadow-[0_0_30px_rgba(168,85,247,0.5)] flex items-center gap-2.5 border border-purple-400/40"
            >
              <Flame className="w-4 h-4 text-purple-300 animate-pulse" />
              <span>START DEVFEST SPEEDRUN CHALLENGE</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-mono">
                20s Timer
              </span>
            </button>
          )}

          {/* Regular Explorer bar */}
          <div className="bg-black/85 backdrop-blur-2xl border border-purple-500/25 rounded-2xl px-5 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_20px_rgba(168,85,247,0.18)] flex items-center gap-5">
            <div>
              <div className="text-xs font-semibold text-white flex items-center gap-2">
                <span>{constellation.name}</span>
                <span className="text-[10px] text-purple-400 font-mono">[{constellation.id}]</span>
              </div>
              <div className="text-[11px] text-white/50">
                {constellation.english} &bull; {constellation.starCount} stars
              </div>
            </div>
            <button
              onClick={onStartAlignment}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-medium text-xs rounded-xl transition-all flex items-center gap-1.5"
            >
              <span>Practice Align</span>
              <span>&rarr;</span>
            </button>
          </div>
          <span className="text-[11px] text-white/30 tracking-wide">Drag to look around celestial sphere</span>
        </div>
      )}

      {/* --- MODAL: RESOLVED --- */}
      {state === 'RESOLVED' && solvedStats && !hideResolvedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl pointer-events-auto animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-black/90 border border-purple-500/30 rounded-2xl p-6 shadow-[0_16px_48px_rgba(0,0,0,0.9),0_0_30px_rgba(168,85,247,0.2)] space-y-4">
            {/* Header */}
            <div className="space-y-1 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-[11px] text-purple-300 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                <span>
                  {solvedStats.isAutoAligned
                    ? 'Alignment Preview'
                    : isArcadeActive
                    ? `Stage ${arcadeStage}/88 Cleared!`
                    : 'Perspective Aligned'}
                </span>
              </div>
              <h3 className="text-xl font-bold tracking-tight text-white pt-1">
                {solvedStats.constellationName}{' '}
                <span className="text-xs text-purple-400 font-mono font-normal">[{solvedStats.constellationId}]</span>
              </h3>
              {constellation && (
                <p className="text-xs text-white/50 italic pt-0.5 leading-relaxed">
                  &ldquo;{constellation.lore}&rdquo;
                </p>
              )}
            </div>

            {/* Constellation Art Illustration */}
            {constellation?.art?.url && (
              <div className="relative w-28 h-28 mx-auto my-1 rounded-xl bg-purple-950/20 border border-purple-500/20 p-1.5 flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                <img
                  src={constellation.art.url}
                  alt={constellation.name}
                  className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] brightness-110"
                />
              </div>
            )}

            {/* Arcade Reward Banner */}
            {isArcadeActive && !solvedStats.isAutoAligned && tierInfo && (
              <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-500/40 text-center">
                <span className="text-xs font-semibold text-purple-200 block">
                  {tierInfo.label} Constellation Solved!
                </span>
                <span className="text-sm font-extrabold text-purple-300 font-mono">
                  {tierInfo.bonusLabel} Added to Time Bank
                </span>
              </div>
            )}

            {/* Metrics (hidden on auto-align preview) */}
            {solvedStats.isAutoAligned ? (
              <div className="py-2.5 px-3 border-y border-purple-500/10 text-center text-xs text-white/50">
                True Earth vantage point restored (not counted as solved).
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 py-2 border-y border-purple-500/10 text-center">
                <div className="p-2 bg-white/[0.02] rounded-xl border border-purple-500/10">
                  <div className="text-[10px] text-white/40">Time</div>
                  <div className="text-sm font-semibold text-white mt-0.5 font-mono">
                    {solvedStats.timeSpentSec}s
                  </div>
                </div>
                <div className="p-2 bg-white/[0.02] rounded-xl border border-purple-500/10">
                  <div className="text-[10px] text-white/40">Accuracy</div>
                  <div className="text-sm font-semibold text-purple-300 mt-0.5 font-mono">
                    {solvedStats.finalAccuracy}%
                  </div>
                </div>
                <div className="p-2 bg-white/[0.02] rounded-xl border border-purple-500/10">
                  <div className="text-[10px] text-white/40">Residual &alpha;</div>
                  <div className="text-xs font-semibold text-purple-200 mt-1 font-mono">
                    {solvedStats.finalAlphaDeg.toFixed(1)}&deg;
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onNextConstellation}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-[0_0_16px_rgba(168,85,247,0.3)] flex items-center justify-center gap-1.5"
              >
                <span>NEXT CONSTELLATION</span>
                <span>&rarr;</span>
              </button>
              {!isArcadeActive && (
                <button
                  onClick={onReturnToEarthHub}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-purple-500/20 text-white/80 hover:text-white text-xs rounded-xl transition-all"
                >
                  Sky View
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: TIMEOUT (Only shown in non-arcade mode) --- */}
      {showTimeoutModal && !isArcadeActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl pointer-events-auto animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-black/90 border border-purple-500/25 rounded-2xl p-6 shadow-[0_16px_48px_rgba(0,0,0,0.9),0_0_24px_rgba(168,85,247,0.15)] space-y-4 text-center">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/50 border border-purple-500/30 text-[11px] text-purple-300 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span>Window Expired</span>
              </div>
              <h3 className="text-base font-bold text-white pt-1">
                Perspective Drift
              </h3>
              <p className="text-xs text-white/50 mt-1">
                The alignment window closed before reaching target perspective.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={onRetryOrbit}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition-all shadow-[0_0_16px_rgba(168,85,247,0.3)]"
              >
                Try Again
              </button>
              <button
                onClick={onAutoAlign}
                className="w-full py-2 bg-white/5 hover:bg-white/10 border border-purple-500/20 text-purple-200 text-xs rounded-xl transition-all"
              >
                Show Alignment
              </button>
              <button
                onClick={onReturnToEarthHub}
                className="w-full py-1.5 text-white/40 hover:text-white text-xs transition-all"
              >
                Return to Sky View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
