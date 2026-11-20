'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Timer, Sparkles, Star, ChevronRight, Zap } from 'lucide-react';

interface DevFestStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (playerName: string) => void;
  onOpenLeaderboard: () => void;
}

export const DevFestStartModal: React.FC<DevFestStartModalProps> = ({
  isOpen,
  onClose,
  onStart,
  onOpenLeaderboard,
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name or handle to join the tournament!');
      return;
    }
    onStart(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl pointer-events-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-zinc-950/95 border border-purple-500/35 rounded-3xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_40px_rgba(168,85,247,0.22)] backdrop-blur-2xl text-white space-y-6 select-none overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow backdrop accent */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-purple-900/25 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative space-y-2 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/40 border border-purple-500/40 text-[11px] font-semibold text-purple-200 tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span>GDG DevFest Live Booth Challenge</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Astral Speedrun Arena
          </h2>
          <p className="text-xs sm:text-sm text-white/60 max-w-md mx-auto leading-relaxed">
            Rotate and align 3D starfields back into their true Earth constellations before your time bank expires!
          </p>
        </div>

        {/* Rules Cards */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex flex-col items-center justify-between shadow-[0_0_15px_rgba(168,85,247,0.15)]">
            <div className="flex items-center gap-1 text-[11px] font-bold text-purple-300 uppercase tracking-wide">
              <Star className="w-3 h-3 fill-purple-300" />
              <span>Easy</span>
            </div>
            <div className="text-xs text-white/50 my-1">2–5 stars</div>
            <div className="text-sm font-extrabold text-purple-200 font-mono">+2.5s</div>
          </div>

          <div className="p-3 rounded-2xl bg-purple-900/40 border border-purple-400/40 flex flex-col items-center justify-between shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <div className="flex items-center gap-1 text-[11px] font-bold text-purple-300 uppercase tracking-wide">
              <Zap className="w-3 h-3 text-purple-300" />
              <span>Medium</span>
            </div>
            <div className="text-xs text-white/50 my-1">6–12 stars</div>
            <div className="text-sm font-extrabold text-purple-200 font-mono">+4.0s</div>
          </div>

          <div className="p-3 rounded-2xl bg-purple-800/40 border border-purple-300/40 flex flex-col items-center justify-between shadow-[0_0_15px_rgba(168,85,247,0.25)]">
            <div className="flex items-center gap-1 text-[11px] font-bold text-purple-200 uppercase tracking-wide">
              <Sparkles className="w-3 h-3 text-purple-200" />
              <span>Hard</span>
            </div>
            <div className="text-xs text-white/50 my-1">13+ stars</div>
            <div className="text-sm font-extrabold text-purple-100 font-mono">+6.0s</div>
          </div>
        </div>

        {/* Gameplay Notes */}
        <div className="px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs text-white/70">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-purple-400" />
            <span>Starting Time: <strong className="text-white font-mono">20.0s</strong></span>
          </div>
          <div className="text-right text-[11px] text-white/50">
            Least Total Time Breaks Ties
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/80 block">
              Player Callsign / Full Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Alex_DevFest or Sarah K."
                autoFocus
                maxLength={24}
                className="w-full px-4 py-3.5 rounded-2xl bg-white/5 border border-purple-500/40 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all shadow-inner font-medium"
              />
            </div>
            {error && <p className="text-xs text-purple-300 font-medium">{error}</p>}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              type="submit"
              className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-700 via-purple-600 to-purple-800 hover:from-purple-600 hover:to-purple-700 text-white font-bold text-sm shadow-[0_0_24px_rgba(168,85,247,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span>ENTER ARENA & START</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="py-3 px-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-purple-500/25 text-purple-200 text-xs font-semibold transition-all flex items-center justify-center gap-2"
            >
              <Trophy className="w-4 h-4 text-purple-300" />
              <span>Leaderboard</span>
            </button>
          </div>
        </form>

        <div className="text-center">
          <button
            onClick={onClose}
            className="text-xs text-white/40 hover:text-white transition-colors"
          >
            Or return to free Sky Exploration
          </button>
        </div>
      </div>
    </div>
  );
};
