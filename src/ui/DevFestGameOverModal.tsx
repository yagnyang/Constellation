'use client';

import React from 'react';
import { Trophy, Crown, Timer, Sparkles, Flame, RotateCcw, ChevronRight, Award } from 'lucide-react';
import { LeaderboardEntry } from '../core/DevFestArcadeManager';

interface DevFestGameOverModalProps {
  isOpen: boolean;
  entry: LeaderboardEntry | null;
  rank: number;
  isVictory?: boolean;
  onViewLeaderboard: () => void;
  onPlayAgain: () => void;
  onReturnToSky: () => void;
}

export const DevFestGameOverModal: React.FC<DevFestGameOverModalProps> = ({
  isOpen,
  entry,
  rank,
  isVictory = false,
  onViewLeaderboard,
  onPlayAgain,
  onReturnToSky,
}) => {
  if (!isOpen || !entry) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl pointer-events-auto animate-in fade-in duration-300 select-none">
      <div className="relative w-full max-w-md bg-zinc-950/95 border border-purple-500/35 rounded-3xl p-6 sm:p-8 shadow-[0_24px_80px_rgba(0,0,0,0.95),0_0_50px_rgba(168,85,247,0.3)] backdrop-blur-2xl text-white space-y-6 text-center overflow-hidden">
        {/* Glow backdrop accent */}
        <div className="absolute -top-20 -left-20 w-52 h-52 bg-purple-600/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-52 h-52 bg-amber-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Status Header */}
        <div className="space-y-1.5 relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-[11px] font-semibold text-purple-200">
            {isVictory ? (
              <>
                <Crown className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                <span>ALL 88 CONSTELLATIONS CONQUERED!</span>
              </>
            ) : (
              <>
                <Timer className="w-3.5 h-3.5 text-rose-400" />
                <span>Time Expired • Session Complete</span>
              </>
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white pt-1">
            {entry.playerName}
          </h2>
          <p className="text-xs text-white/50">
            GDG DevFest Astral Challenge Final Report
          </p>
        </div>

        {/* High Score & Rank Podium Badge */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/40 via-purple-600/20 to-indigo-900/40 border border-purple-400/30 flex items-center justify-between shadow-[0_0_25px_rgba(168,85,247,0.2)]">
          <div className="text-left">
            <span className="text-[11px] text-purple-300/80 font-medium uppercase tracking-wider block">
              Official Tournament Rank
            </span>
            <span className="text-2xl sm:text-3xl font-black text-amber-300 font-mono flex items-center gap-1.5">
              <span>#{rank}</span>
              {rank <= 3 && <Trophy className="w-5 h-5 text-amber-400 inline" />}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-white/50 uppercase tracking-wider block">
              Constellations Solved
            </span>
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">
              {entry.score} <span className="text-xs text-white/40 font-normal">/ 88</span>
            </span>
          </div>
        </div>

        {/* Tie-breaker & Precision Metrics */}
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="p-3 bg-white/[0.03] rounded-2xl border border-purple-500/15 space-y-0.5">
            <div className="text-[11px] text-white/50">Total Elapsed Time</div>
            <div className="text-lg font-bold text-white font-mono">
              {entry.totalTimeSec.toFixed(1)}s
            </div>
            <div className="text-[10px] text-purple-300/70">1st Tie-Breaker (Least Time)</div>
          </div>

          <div className="p-3 bg-white/[0.03] rounded-2xl border border-purple-500/15 space-y-0.5">
            <div className="text-[11px] text-white/50">Average Accuracy</div>
            <div className="text-lg font-bold text-emerald-300 font-mono">
              {entry.avgAccuracy.toFixed(1)}%
            </div>
            <div className="text-[10px] text-emerald-400/70">2nd Tie-Breaker (Precision)</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            onClick={onPlayAgain}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-[0_0_24px_rgba(168,85,247,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Flame className="w-4 h-4 text-amber-300" />
            <span>PLAY AGAIN / NEXT ATTENDEE</span>
          </button>

          <div className="flex gap-2">
            <button
              onClick={onViewLeaderboard}
              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-purple-500/20 text-purple-200 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>View Leaderboard</span>
            </button>

            <button
              onClick={onReturnToSky}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all"
            >
              Sky View
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
