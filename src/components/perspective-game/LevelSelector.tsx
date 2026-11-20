'use client';

import React from 'react';
import { PUZZLE_LEVELS, PuzzleLevel } from './levels';
import { X, CheckCircle2, Compass } from 'lucide-react';

interface LevelSelectorProps {
  currentLevelId: string;
  onSelectLevel: (index: number) => void;
  onClose: () => void;
}

export default function LevelSelector({
  currentLevelId,
  onSelectLevel,
  onClose,
}: LevelSelectorProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 pointer-events-auto animate-fadeIn select-none">
      <div className="bg-space-900 border border-white/15 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest">
              <Compass className="w-4 h-4 text-amber-400" />
              Constellation Perspective Levels
            </div>
            <h2 className="text-xl font-bold text-white mt-0.5">Select Constellation Puzzle</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Level Grid */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PUZZLE_LEVELS.map((lvl, idx) => {
            const isCurrent = lvl.id === currentLevelId;
            return (
              <div
                key={lvl.id}
                onClick={() => {
                  onSelectLevel(idx);
                  onClose();
                }}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  isCurrent
                    ? 'bg-amber-500/20 border-amber-400 shadow-lg shadow-amber-500/10'
                    : 'bg-white/5 border-white/10 hover:border-cyan-400 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/40 text-cyan-300 border border-cyan-800">
                    LEVEL {idx + 1}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      lvl.difficulty === 'Easy'
                        ? 'text-emerald-400 bg-emerald-950/40'
                        : lvl.difficulty === 'Medium'
                        ? 'text-amber-400 bg-amber-950/40'
                        : 'text-rose-400 bg-rose-950/40'
                    }`}
                  >
                    {lvl.difficulty}
                  </span>
                </div>

                <div className="text-base font-bold text-white mt-2 flex items-center justify-between">
                  <span>{lvl.name}</span>
                  <span className="text-xs font-mono text-gray-500">{lvl.id}</span>
                </div>
                <div className="text-xs text-gray-400 italic mt-0.5 truncate">{lvl.subtitle}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
