'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Crown, Flame, Timer, Sparkles, X, RotateCcw, Download, Trash2, ArrowUpRight } from 'lucide-react';
import { LeaderboardEntry, loadLeaderboard, clearLeaderboard, exportLeaderboardJSON } from '../core/DevFestArcadeManager';

interface DevFestLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartNewGame: () => void;
  highlightId?: string;
}

export const DevFestLeaderboardModal: React.FC<DevFestLeaderboardModalProps> = ({
  isOpen,
  onClose,
  onStartNewGame,
  highlightId,
}) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEntries(loadLeaderboard());
      setShowClearConfirm(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const top1 = entries[0];
  const top2 = entries[1];
  const top3 = entries[2];

  const handleClear = () => {
    clearLeaderboard();
    setEntries(loadLeaderboard());
    setShowClearConfirm(false);
  };

  const handleExport = () => {
    const json = exportLeaderboardJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devfest-leaderboard-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-2xl pointer-events-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] bg-zinc-950/95 border border-purple-500/35 rounded-3xl p-5 sm:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.95),0_0_50px_rgba(168,85,247,0.25)] backdrop-blur-2xl text-white flex flex-col select-none overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow backdrop accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Top Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-purple-500/20 relative">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.25)]">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                <span>GDG DevFest Leaderboard</span>
              </h2>
              <p className="text-[11px] text-white/50">
                Ranked by Competitive Score (Highest Accuracy &amp; Minimum Time)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              title="Export results as JSON"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all text-xs flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* --- TOP 3 PODIUM (if at least 1 entry exists) --- */}
        {entries.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 py-4 border-b border-purple-500/15 relative">
            {/* 2nd Place */}
            {top2 ? (
              <div
                className={`relative rounded-2xl p-3 bg-zinc-900/60 border ${
                  top2.id === highlightId
                    ? 'border-purple-400 bg-purple-950/40 ring-1 ring-purple-400/50'
                    : 'border-purple-500/30'
                } flex flex-col items-center justify-end text-center`}
              >
                <div className="w-7 h-7 rounded-full bg-purple-900/40 text-purple-200 font-bold text-xs flex items-center justify-center mb-1.5 border border-purple-500/40">
                  2
                </div>
                <div className="text-xs font-bold text-white truncate max-w-full">
                  {top2.playerName}
                </div>
                <div className="text-base font-extrabold text-purple-200 font-mono mt-0.5">
                  {top2.points.toLocaleString()}{' '}
                  <span className="text-[10px] text-white/50 font-normal">pts</span>
                </div>
                <div className="text-[10px] text-white/55 font-mono">
                  {top2.avgAccuracy.toFixed(1)}% • {top2.score}/88 solved
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-3 border border-white/5 bg-white/[0.01]" />
            )}

            {/* 1st Place (Crown) */}
            {top1 ? (
              <div
                className={`relative rounded-2xl p-3.5 bg-gradient-to-b from-purple-800/40 via-zinc-900/80 to-zinc-950 border ${
                  top1.id === highlightId
                    ? 'border-purple-400 ring-2 ring-purple-400/50'
                    : 'border-purple-500/40'
                } flex flex-col items-center justify-end text-center shadow-[0_0_25px_rgba(168,85,247,0.25)] -translate-y-1`}
              >
                <Crown className="w-5 h-5 text-purple-300 animate-bounce mb-1" />
                <div className="w-8 h-8 rounded-full bg-purple-600/30 text-purple-200 font-black text-sm flex items-center justify-center mb-1 border border-purple-400/50">
                  1
                </div>
                <div className="text-xs sm:text-sm font-black text-purple-100 truncate max-w-full">
                  {top1.playerName}
                </div>
                <div className="text-lg font-black text-purple-200 font-mono">
                  {top1.points.toLocaleString()}{' '}
                  <span className="text-xs text-purple-400/70 font-normal">pts</span>
                </div>
                <div className="text-[10px] text-purple-300/80 font-mono font-medium">
                  {top1.avgAccuracy.toFixed(1)}% • {top1.score}/88 solved
                </div>
              </div>
            ) : null}

            {/* 3rd Place */}
            {top3 ? (
              <div
                className={`relative rounded-2xl p-3 bg-zinc-900/60 border ${
                  top3.id === highlightId
                    ? 'border-purple-400 bg-purple-950/40 ring-1 ring-purple-400/50'
                    : 'border-purple-800/30'
                } flex flex-col items-center justify-end text-center`}
              >
                <div className="w-7 h-7 rounded-full bg-purple-950/40 text-purple-300 font-bold text-xs flex items-center justify-center mb-1.5 border border-purple-700/40">
                  3
                </div>
                <div className="text-xs font-bold text-white truncate max-w-full">
                  {top3.playerName}
                </div>
                <div className="text-base font-extrabold text-purple-300/90 font-mono mt-0.5">
                  {top3.points.toLocaleString()}{' '}
                  <span className="text-[10px] text-white/50 font-normal">pts</span>
                </div>
                <div className="text-[10px] text-white/55 font-mono">
                  {top3.avgAccuracy.toFixed(1)}% • {top3.score}/88 solved
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-3 border border-white/5 bg-white/[0.01]" />
            )}
          </div>
        )}

        {/* --- FULL SCROLLABLE RANKINGS TABLE --- */}
        <div className="flex-1 overflow-y-auto min-h-[160px] py-2 pr-1 space-y-1.5 custom-scrollbar">
          <div className="grid grid-cols-12 px-3 py-1.5 text-[11px] font-semibold text-white/40 uppercase tracking-wider">
            <span className="col-span-1 text-center">#</span>
            <span className="col-span-4">Player</span>
            <span className="col-span-3 text-right">Score</span>
            <span className="col-span-2 text-right">Accuracy</span>
            <span className="col-span-2 text-right">Solved</span>
          </div>

          {entries.length === 0 ? (
            <div className="text-center py-8 text-white/40 text-xs">
              No entries recorded yet. Be the first to play!
            </div>
          ) : (
            entries.map((entry) => {
              const isHighlighted = entry.id === highlightId;
              return (
                <div
                  key={entry.id}
                  className={`grid grid-cols-12 items-center px-3 py-2.5 rounded-xl text-xs transition-all ${
                    isHighlighted
                      ? 'bg-purple-600/30 border border-purple-400 text-white font-semibold shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                      : 'bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-white/80'
                  }`}
                >
                  {/* Rank */}
                  <span className="col-span-1 text-center font-mono font-bold">
                    {entry.rank === 1 ? (
                      <span className="text-purple-300">1</span>
                    ) : entry.rank === 2 ? (
                      <span className="text-purple-200">2</span>
                    ) : entry.rank === 3 ? (
                      <span className="text-purple-400">3</span>
                    ) : (
                      <span className="text-white/40">{entry.rank}</span>
                    )}
                  </span>

                  {/* Player Name */}
                  <div className="col-span-4 flex items-center gap-1.5 truncate pr-2">
                    <span className="truncate font-medium text-white">{entry.playerName}</span>
                    {entry.isAllCleared && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-900/40 text-purple-200 border border-purple-500/40 font-bold shrink-0">
                        MAX 88
                      </span>
                    )}
                  </div>

                  {/* Competitive Points */}
                  <div className="col-span-3 text-right font-mono font-bold text-purple-300">
                    {entry.points.toLocaleString()}{' '}
                    <span className="text-[10px] text-white/40 font-normal">pts</span>
                  </div>

                  {/* Avg Accuracy */}
                  <span className="col-span-2 text-right font-mono text-emerald-300 font-semibold">
                    {entry.avgAccuracy.toFixed(1)}%
                  </span>

                  {/* Constellations Solved */}
                  <span className="col-span-2 text-right font-mono text-white/90">
                    {entry.score}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* --- FOOTER CONTROLS --- */}
        <div className="pt-4 border-t border-purple-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          {showClearConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-purple-300 font-medium">Reset board?</span>
              <button
                onClick={handleClear}
                className="px-2.5 py-1 rounded-lg bg-purple-700 hover:bg-purple-600 text-white text-xs font-semibold"
              >
                Confirm Clear
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-2.5 py-1 rounded-lg bg-white/10 text-white text-xs"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-[11px] text-white/30 hover:text-purple-400 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset Board</span>
            </button>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition-all"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                onStartNewGame();
              }}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-[0_0_18px_rgba(168,85,247,0.4)] flex items-center justify-center gap-1.5"
            >
              <Flame className="w-4 h-4 text-purple-300" />
              <span>NEW SESSION / PLAY</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
