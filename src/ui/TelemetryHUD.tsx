'use client';

import React from 'react';
import { GameState, SolvedStats } from '../core/OrbitalCameraController';
import { NormalizedConstellation } from '../core/StarDataManager';
import { ReferenceSilhouette } from './ReferenceSilhouette';

interface TelemetryHUDProps {
  state: GameState;
  constellation: NormalizedConstellation | null;
  timerSec: number;
  alphaDeg: number;
  accuracy: number;
  soundEnabled: boolean;
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
  onToggleSound: () => void;
  onStartAlignment?: () => void;
  onNextConstellation: () => void;
  onReturnToEarthHub: () => void;
  onRetryOrbit: () => void;
  onAutoAlign: () => void;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  state,
  constellation,
  timerSec,
  alphaDeg,
  accuracy,
  soundEnabled,
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
  onToggleSound,
  onStartAlignment,
  onNextConstellation,
  onReturnToEarthHub,
  onRetryOrbit,
  onAutoAlign,
}) => {
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

  // Timer styling
  const timerStyle =
    timerSec <= 0.0
      ? 'text-rose-400 border-rose-500/40 bg-rose-950/30'
      : timerSec < 5.0
      ? 'text-rose-300 border-rose-500/30 bg-rose-950/20 animate-pulse'
      : 'text-purple-200 border-purple-500/25 bg-black/70';

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-20">
      {/* --- TOP BAR --- */}
      <header className="absolute top-0 left-0 right-0 p-5 flex items-center justify-between gap-4 pointer-events-auto">
        {/* Left: State Badge & Constellation Meta */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-full border border-purple-500/20 text-xs font-medium text-purple-200 bg-black/75 backdrop-blur-xl flex items-center gap-2 shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span>{badge.label}</span>
          </div>

          {constellation && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/75 border border-purple-500/20 text-white backdrop-blur-xl shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
              <span className="text-xs font-semibold text-white">
                {constellation.name}
              </span>
              <span className="text-[10px] text-purple-400 font-mono">
                {constellation.id}
              </span>
              <span className="text-xs text-white/40 truncate max-w-[150px]">
                {constellation.english}
              </span>
            </div>
          )}
        </div>

        {/* Right: Timer, Exit & Controls */}
        <div className="flex items-center gap-2.5">
          {/* Sky View: Constellation Lines & Art Toggle & Replay Animation */}
          {state === 'EARTH_HUB' && onToggleAllLines && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onToggleAllLines}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium backdrop-blur-xl flex items-center gap-2 transition-all shadow-lg active:scale-95 ${
                  showAllLines
                    ? 'bg-purple-600/90 border-purple-400 text-white shadow-[0_0_18px_rgba(168,85,247,0.45)]'
                    : 'bg-black/75 hover:bg-black/95 border-purple-500/20 text-white/70 hover:text-white'
                }`}
                title={showAllLines ? 'Hide constellation lines & artwork' : 'Show constellation lines & celestial art'}
              >
                <svg className="w-3.5 h-3.5 text-purple-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 18l4-8 6 4 6-10" />
                  <circle cx="4" cy="18" r="2" fill="currentColor" />
                  <circle cx="8" cy="10" r="2" fill="currentColor" />
                  <circle cx="14" cy="14" r="2" fill="currentColor" />
                  <circle cx="20" cy="4" r="2" fill="currentColor" />
                </svg>
                <span>Lines: <strong className={showAllLines ? 'text-purple-200' : 'text-white/40'}>{showAllLines ? 'ON' : 'OFF'}</strong></span>
              </button>

              {onToggleArt && (
                <button
                  onClick={onToggleArt}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium backdrop-blur-xl flex items-center gap-1.5 transition-all shadow-lg active:scale-95 ${
                    showArt
                      ? 'bg-fuchsia-600/90 border-fuchsia-400 text-white shadow-[0_0_18px_rgba(217,70,239,0.45)]'
                      : 'bg-black/75 hover:bg-black/95 border-purple-500/20 text-white/70 hover:text-white'
                  }`}
                  title={showArt ? 'Hide constellation art figures' : 'Show constellation art figures'}
                >
                  <svg className="w-3.5 h-3.5 text-fuchsia-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="9" strokeWidth={1.6} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 7a5 5 0 015 5 5 5 0 01-5 5" />
                    <circle cx="9" cy="9.5" r="1.2" fill="currentColor" />
                  </svg>
                  <span>Art: <strong className={showArt ? 'text-fuchsia-200' : 'text-white/40'}>{showArt ? 'ON' : 'OFF'}</strong></span>
                </button>
              )}

              {onToggleSkyPanorama && (
                <button
                  onClick={onToggleSkyPanorama}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium backdrop-blur-xl flex items-center gap-1.5 transition-all shadow-lg active:scale-95 ${
                    showSkyPanorama
                      ? 'bg-indigo-600/90 border-indigo-400 text-white shadow-[0_0_18px_rgba(99,102,241,0.45)]'
                      : 'bg-black/75 hover:bg-black/95 border-purple-500/20 text-white/70 hover:text-white'
                  }`}
                  title={showSkyPanorama ? 'Hide Milky Way panoramic background' : 'Show Milky Way panoramic background'}
                >
                  <svg className="w-3.5 h-3.5 text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="9" strokeWidth={1.6} />
                    <path strokeLinecap="round" strokeWidth={1.6} d="M3.6 9h16.8M3.6 15h16.8" />
                  </svg>
                  <span>Milky Way: <strong className={showSkyPanorama ? 'text-indigo-200' : 'text-white/40'}>{showSkyPanorama ? 'ON' : 'OFF'}</strong></span>
                </button>
              )}

              {showAllLines && onReplayLinesAnimation && (
                <button
                  onClick={onReplayLinesAnimation}
                  className="w-8 h-8 rounded-full bg-black/75 hover:bg-purple-950/60 border border-purple-500/25 hover:border-purple-400 text-purple-300 hover:text-white transition-all backdrop-blur-xl flex items-center justify-center shadow-lg active:scale-95"
                  title="Replay progressive star formation animation"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Quiz (ALIGN_PUZZLE): Target Alignment Guide Toggle */}
          {state === 'ALIGN_PUZZLE' && onToggleGhostGuide && (
            <button
              onClick={onToggleGhostGuide}
              className={`px-3 py-1.5 rounded-full border text-xs font-medium backdrop-blur-xl flex items-center gap-1.5 transition-all shadow-lg active:scale-95 ${
                showGhostGuide
                  ? 'bg-cyan-600/80 border-cyan-400 text-white shadow-[0_0_15px_rgba(56,189,248,0.4)]'
                  : 'bg-black/75 hover:bg-black/95 border-purple-500/20 text-white/50 hover:text-white'
              }`}
              title="Toggle target alignment guide lines overlay"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="9" strokeWidth={1.6} strokeDasharray="3 3" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
                <path strokeLinecap="round" strokeWidth={1.6} d="M12 3v3m0 12v3M3 12h3m12 0h3" />
              </svg>
              <span>Guide: <strong className={showGhostGuide ? 'text-cyan-200' : 'text-white/40'}>{showGhostGuide ? 'ON' : 'OFF'}</strong></span>
            </button>
          )}

          {/* Countdown Timer (ALIGN_PUZZLE) */}
          {state === 'ALIGN_PUZZLE' && (
            <div
              className={`px-3 py-1.5 rounded-full border text-xs font-medium backdrop-blur-xl shadow-lg flex items-center gap-1.5 ${timerStyle}`}
            >
              <span className="text-[10px] text-white/40">Time</span>
              <span className="tabular-nums font-mono font-medium">
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
              Exit
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute audio' : 'Unmute audio'}
            className="w-8 h-8 rounded-full bg-black/75 hover:bg-black/95 border border-purple-500/20 hover:border-purple-400/50 text-white/70 hover:text-purple-300 transition-all backdrop-blur-xl flex items-center justify-center shadow-lg"
            title={soundEnabled ? 'Mute' : 'Unmute'}
          >
            {soundEnabled ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </button>
        </div>
      </header>

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
              <span className="flex items-center gap-1.5 text-cyan-300/80">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Align 3D lines into guide
              </span>
              <span className="text-purple-300/70 font-mono">Snap &le; 3.5&deg;</span>
            </div>
          </div>
        </div>
      )}

      {/* --- EARTH HUB: BOTTOM BAR --- */}
      {state === 'EARTH_HUB' && constellation && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex flex-col items-center gap-2 animate-fadeIn">
          <div className="bg-black/85 backdrop-blur-2xl border border-purple-500/25 rounded-2xl px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_20px_rgba(168,85,247,0.18)] flex items-center gap-5">
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <span>{constellation.name}</span>
                <span className="text-[11px] text-purple-400 font-mono">[{constellation.id}]</span>
              </div>
              <div className="text-xs text-white/50">
                {constellation.english} &bull; {constellation.starCount} stars
              </div>
            </div>
            <button
              onClick={onStartAlignment}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-medium text-xs rounded-xl transition-all shadow-[0_0_18px_rgba(168,85,247,0.35)] flex items-center gap-2"
            >
              <span>Align</span>
              <span>&rarr;</span>
            </button>
          </div>
          <span className="text-[11px] text-white/30 tracking-wide">Drag to look around</span>
        </div>
      )}

      {/* --- MODAL: RESOLVED --- */}
      {state === 'RESOLVED' && solvedStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl pointer-events-auto animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-black/90 border border-purple-500/30 rounded-2xl p-6 shadow-[0_16px_48px_rgba(0,0,0,0.9),0_0_30px_rgba(168,85,247,0.2)] space-y-4">
            {/* Header */}
            <div className="space-y-1 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-[11px] text-purple-300 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                <span>Perspective Aligned</span>
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

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2 py-2 border-y border-purple-500/10 text-center">
              <div className="p-2 bg-white/[0.02] rounded-xl border border-purple-500/10">
                <div className="text-[10px] text-white/40">Time</div>
                <div className="text-sm font-semibold text-white mt-0.5">
                  {solvedStats.timeSpentSec}s
                </div>
              </div>
              <div className="p-2 bg-white/[0.02] rounded-xl border border-purple-500/10">
                <div className="text-[10px] text-white/40">Accuracy</div>
                <div className="text-sm font-semibold text-purple-300 mt-0.5">
                  {solvedStats.finalAccuracy}%
                </div>
              </div>
              <div className="p-2 bg-white/[0.02] rounded-xl border border-purple-500/10">
                <div className="text-[10px] text-white/40">Depth Spread</div>
                <div className="text-xs font-semibold text-purple-200 mt-1">
                  {(solvedStats.distMax - solvedStats.distMin).toFixed(0)} pc
                </div>
              </div>
            </div>

            {/* Parallax Insight */}
            <p className="text-[11px] text-white/50 leading-relaxed text-center">
              These stars are separated by up to{' '}
              <span className="text-white font-medium">{(solvedStats.distMax - solvedStats.distMin).toFixed(0)} parsecs</span> in 3D space,
              only forming this shape when observed from Earth.
            </p>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onNextConstellation}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-semibold rounded-xl transition-all shadow-[0_0_16px_rgba(168,85,247,0.3)]"
              >
                Next Constellation &rarr;
              </button>
              <button
                onClick={onReturnToEarthHub}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-purple-500/20 text-white/80 hover:text-white text-xs rounded-xl transition-all"
              >
                Sky View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: TIMEOUT --- */}
      {showTimeoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl pointer-events-auto animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-black/90 border border-purple-500/25 rounded-2xl p-6 shadow-[0_16px_48px_rgba(0,0,0,0.9),0_0_24px_rgba(168,85,247,0.15)] space-y-4 text-center">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/25 text-[11px] text-rose-300 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
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
