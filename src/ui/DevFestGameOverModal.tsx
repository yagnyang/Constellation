'use client';

import React from 'react';
import { Trophy, Crown, Timer, Flame, RotateCcw, CheckCircle2 } from 'lucide-react';
import { AttemptResult, LeaderboardEntry } from '../core/DevFestArcadeManager';

interface DevFestGameOverModalProps {
  isOpen: boolean;
  entry: LeaderboardEntry | null;
  rank: number;
  isVictory?: boolean;
  attempts: AttemptResult[];
  maxAttempts: number;
  bestAttempt: AttemptResult | null;
  isFinalized: boolean;
  onRetryAttempt: () => void;
  onFinishSession: () => void;
  onViewLeaderboard: () => void;
  onNextAttendee: () => void;
  onReturnToSky: () => void;
}

export const DevFestGameOverModal: React.FC<DevFestGameOverModalProps> = ({
  isOpen,
  entry,
  rank,
  isVictory = false,
  attempts,
  maxAttempts,
  bestAttempt,
  isFinalized,
  onRetryAttempt,
  onFinishSession,
  onViewLeaderboard,
  onNextAttendee,
  onReturnToSky,
}) => {
  if (!isOpen || !entry) return null;

  const attemptsUsed = attempts.length;
  const retriesLeft = Math.max(0, maxAttempts - attemptsUsed);
  const canRetry = !isFinalized && retriesLeft > 0;
  const latestAttempt = attempts[attempts.length - 1] ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl pointer-events-auto animate-in fade-in duration-300 select-none">
      <div className="relative w-full max-w-md bg-zinc-950/95 border border-purple-500/35 rounded-3xl p-6 sm:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.95),0_0_50px_rgba(168,85,247,0.3)] backdrop-blur-2xl text-white space-y-5 text-center overflow-hidden">
        {/* Glow backdrop accent */}
        <div className="absolute -top-20 -left-20 w-52 h-52 bg-purple-600/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-52 h-52 bg-purple-900/25 rounded-full blur-3xl pointer-events-none" />

        {/* Status Header */}
        <div className="space-y-1.5 relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-[11px] font-semibold text-purple-200">
            {isVictory ? (
              <>
                <Crown className="w-3.5 h-3.5 text-purple-300 animate-bounce" />
                <span>ALL 88 CONSTELLATIONS CONQUERED!</span>
              </>
            ) : isFinalized ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                <span>
                  Best of {attemptsUsed}/{maxAttempts} Attempts Recorded
                </span>
              </>
            ) : (
              <>
                <Timer className="w-3.5 h-3.5 text-purple-400" />
                <span>
                  Attempt {attemptsUsed} of {maxAttempts} Complete &bull; {retriesLeft}{' '}
                  {retriesLeft === 1 ? 'Retry' : 'Retries'} Left
                </span>
              </>
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white pt-1">
            {entry.playerName}
          </h2>
          <p className="text-xs text-white/50">
            {isFinalized
              ? bestAttempt
                ? `Official score locked from Attempt #${bestAttempt.attemptNumber} (Highest of ${attemptsUsed})`
                : 'GDG DevFest Astral Challenge Final Report'
              : 'You get 3 consecutive attempts — only your highest score will be recorded'}
          </p>
        </div>

        {/* 3 Consecutive Attempts Scoreboard */}
        <div className="grid grid-cols-3 gap-2 text-center relative">
          {Array.from({ length: maxAttempts }, (_, idx) => {
            const num = idx + 1;
            const att = attempts.find((a) => a.attemptNumber === num);
            const isBest = Boolean(att && bestAttempt && att.attemptNumber === bestAttempt.attemptNumber);
            const isLatest = Boolean(att && latestAttempt && att.attemptNumber === latestAttempt.attemptNumber);

            return (
              <div
                key={num}
                className={`p-2.5 rounded-2xl border transition-all flex flex-col items-center justify-center ${
                  isBest
                    ? 'bg-purple-900/40 border-emerald-400/60 shadow-[0_0_16px_rgba(52,211,153,0.18)]'
                    : att
                    ? 'bg-white/[0.04] border-purple-500/25'
                    : 'bg-white/[0.015] border-white/10 opacity-55'
                }`}
              >
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/60">
                  <span>Try #{num}</span>
                  {isBest && (
                    <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px]">
                      BEST
                    </span>
                  )}
                </div>
                {att ? (
                  <>
                    <div className="text-sm font-black font-mono text-white mt-0.5">
                      {att.points.toLocaleString()}
                      <span className="text-[9px] text-white/40 font-normal ml-0.5">pts</span>
                    </div>
                    <div className="text-[9px] font-mono text-white/55">
                      {att.avgAccuracy.toFixed(1)}% &bull; {att.totalTimeSec.toFixed(1)}s
                    </div>
                  </>
                ) : (
                  <div className="text-[10px] text-white/35 mt-1.5 font-medium">
                    {isFinalized ? 'Unused' : isLatest ? 'Done' : 'Available'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* High Score & Rank Podium Badge (Always reflects Best Attempt) */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/40 via-purple-600/20 to-purple-950/60 border border-purple-400/30 flex items-center justify-between shadow-[0_0_25px_rgba(168,85,247,0.2)]">
          <div className="text-left">
            <span className="text-[11px] text-purple-300/80 font-medium uppercase tracking-wider block">
              {isFinalized ? 'Official Tournament Rank' : 'Projected Rank (Best)'}
            </span>
            <span className="text-2xl sm:text-3xl font-black text-purple-200 font-mono flex items-center gap-1.5">
              <span>#{rank}</span>
              {rank <= 3 && <Trophy className="w-5 h-5 text-purple-300 inline" />}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-white/50 uppercase tracking-wider block">
              {isFinalized ? 'Recorded Best Score' : 'Best Score So Far'}
            </span>
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">
              {entry.points.toLocaleString()}{' '}
              <span className="text-xs text-purple-300/70 font-normal">pts</span>
            </span>
          </div>
        </div>

        {/* Best Attempt Metrics */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="p-3 bg-white/[0.03] rounded-2xl border border-purple-500/15 space-y-0.5">
            <div className="text-[10px] text-white/50">Avg Accuracy</div>
            <div className="text-base font-bold text-emerald-300 font-mono">
              {entry.avgAccuracy.toFixed(1)}%
            </div>
            <div className="text-[9px] text-purple-300/70">Precision Factor</div>
          </div>

          <div className="p-3 bg-white/[0.03] rounded-2xl border border-purple-500/15 space-y-0.5">
            <div className="text-[10px] text-white/50">Total Time</div>
            <div className="text-base font-bold text-white font-mono">
              {entry.totalTimeSec.toFixed(1)}s
            </div>
            <div className="text-[9px] text-purple-300/70">Speed Multiplier</div>
          </div>

          <div className="p-3 bg-white/[0.03] rounded-2xl border border-purple-500/15 space-y-0.5">
            <div className="text-[10px] text-white/50">Solved</div>
            <div className="text-base font-bold text-purple-200 font-mono">
              {entry.score}
              <span className="text-[10px] text-white/40 font-normal">/88</span>
            </div>
            <div className="text-[9px] text-purple-300/70">Constellations</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          {canRetry ? (
            <>
              <button
                onClick={onRetryAttempt}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-700 via-purple-600 to-purple-800 hover:from-purple-600 hover:to-purple-700 text-white font-bold text-sm shadow-[0_0_24px_rgba(168,85,247,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4 text-purple-200" />
                <span>
                  RETRY — ATTEMPT {attemptsUsed + 1} OF {maxAttempts}
                </span>
              </button>

              <div className="flex gap-2">
                <button
                  onClick={onFinishSession}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 text-emerald-200 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Finish &amp; Record Best</span>
                </button>

                <button
                  onClick={onReturnToSky}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all"
                >
                  Sky View
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={onNextAttendee}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-700 via-purple-600 to-purple-800 hover:from-purple-600 hover:to-purple-700 text-white font-bold text-sm shadow-[0_0_24px_rgba(168,85,247,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Flame className="w-4 h-4 text-purple-300" />
                <span>NEXT ATTENDEE (NEW PLAYER)</span>
              </button>

              <div className="flex gap-2">
                <button
                  onClick={onViewLeaderboard}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-purple-500/20 text-purple-200 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                >
                  <Trophy className="w-4 h-4 text-purple-300" />
                  <span>View Leaderboard</span>
                </button>

                <button
                  onClick={onReturnToSky}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all"
                >
                  Sky View
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
