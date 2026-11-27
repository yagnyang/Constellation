'use client';

import React, { useEffect } from 'react';
import {
  Compass,
  Eye,
  Rocket,
  RotateCw,
  Target,
  CheckCircle2,
  X,
  Sparkles,
  HelpCircle,
  ChevronRight,
} from 'lucide-react';

export interface HowToPlayBannerProps {
  isOpen: boolean;
  onClose: () => void;
  onGotIt?: () => void;
}

export const HowToPlayBanner: React.FC<HowToPlayBannerProps> = ({
  isOpen,
  onClose,
  onGotIt,
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem('starc_has_seen_guide', 'true');
    } catch {}
    if (onGotIt) {
      onGotIt();
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xl pointer-events-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-zinc-950/95 border border-purple-500/30 rounded-3xl p-5 sm:p-7 md:p-8 shadow-[0_20px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(168,85,247,0.18)] backdrop-blur-2xl text-white select-none overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background accents */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-purple-900/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="relative flex items-start justify-between pb-4 border-b border-purple-500/15 gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-[11px] font-semibold text-purple-200 tracking-wider uppercase">
              <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
              <span>Pilot Briefing</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>How to Play</span>
              <span className="text-xs font-mono font-medium text-purple-300/70 px-2 py-0.5 rounded-md bg-purple-950/60 border border-purple-500/20">
                6 STEPS
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-white/50 max-w-xl">
              Constellations only form iconic shapes from Earth. In 3D space, stars scatter across light-years. Your mission is to restore that perspective.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-purple-500/20 hover:border-purple-400/50 text-white/60 hover:text-white transition-all flex items-center justify-center shrink-0"
            title="Close Guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 6 Steps Grid: 3 on the Left, 3 on the Right */}
        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 my-5">
          {/* Subtle vertical divider for desktop */}
          <div className="hidden md:block absolute top-2 bottom-2 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-purple-500/0 via-purple-500/20 to-purple-500/0 pointer-events-none" />

          {/* LEFT COLUMN: Steps 1 to 3 (Discovery & Observation) */}
          <div className="space-y-3.5">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-purple-300/70 flex items-center gap-2 pb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span>Phase 1 &bull; Observation & Launch</span>
            </div>

            {/* Step 1 */}
            <div className="group relative p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-purple-500/15 hover:border-purple-500/35 transition-all flex gap-3.5 items-start">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0 mt-0.5">
                <Compass className="w-4 h-4" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                    1. Choose a Constellation
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-purple-400/80 px-1.5 py-0.5 rounded bg-purple-500/10">
                    STEP 01
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-white/55 leading-relaxed">
                  Open the catalog drawer to pick from all 88 official IAU star patterns, or start with famous legends like Orion and Ursa Major.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="group relative p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-purple-500/15 hover:border-purple-500/35 transition-all flex gap-3.5 items-start">
              <div className="w-9 h-9 rounded-xl bg-purple-900/40 border border-purple-500/30 text-purple-200 flex items-center justify-center shrink-0 mt-0.5">
                <Eye className="w-4 h-4" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                    2. Preview from Earth
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-purple-300/80 px-1.5 py-0.5 rounded bg-purple-500/10">
                    STEP 02
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-white/55 leading-relaxed">
                  Memorize the 2D pattern, connecting lines, and classical artwork as observed from Earth’s unique vantage point.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="group relative p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-purple-500/15 hover:border-purple-500/35 transition-all flex gap-3.5 items-start">
              <div className="w-9 h-9 rounded-xl bg-purple-800/40 border border-purple-400/30 text-purple-200 flex items-center justify-center shrink-0 mt-0.5">
                <Rocket className="w-4 h-4" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                    3. Warp into Deep Space
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-purple-300/80 px-1.5 py-0.5 rounded bg-purple-500/10">
                    STEP 03
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-white/55 leading-relaxed">
                  The camera displaces into deep 3D orbit. Watch the stars scatter into a distorted 3D cluster at their true light-year distances.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Steps 4 to 6 (Puzzle & Alignment) */}
          <div className="space-y-3.5">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-purple-300/70 flex items-center gap-2 pb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span>Phase 2 &bull; Puzzle & Alignment</span>
            </div>

            {/* Step 4 */}
            <div className="group relative p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-purple-500/15 hover:border-purple-500/35 transition-all flex gap-3.5 items-start">
              <div className="w-9 h-9 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0 mt-0.5">
                <RotateCw className="w-4 h-4" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                    4. Rotate & Orbit
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-purple-300/80 px-1.5 py-0.5 rounded bg-purple-500/10">
                    STEP 04
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-white/55 leading-relaxed">
                  Click and drag anywhere on the screen to rotate your orbital camera. Feel free to tweak drag sensitivity in Settings.
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="group relative p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-purple-500/15 hover:border-purple-500/35 transition-all flex gap-3.5 items-start">
              <div className="w-9 h-9 rounded-xl bg-purple-900/40 border border-purple-400/30 text-purple-200 flex items-center justify-center shrink-0 mt-0.5">
                <Target className="w-4 h-4" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                    5. Match the Target Silhouette
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-purple-300/80 px-1.5 py-0.5 rounded bg-purple-500/10">
                    STEP 05
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-white/55 leading-relaxed">
                  Look at the mini-map target silhouette and toggle the Ghost Guide if needed. Watch the Accuracy % climb as stars line up.
                </p>
              </div>
            </div>

            {/* Step 6 */}
            <div className="group relative p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-purple-500/15 hover:border-purple-500/35 transition-all flex gap-3.5 items-start">
              <div className="w-9 h-9 rounded-xl bg-purple-800/40 border border-purple-300/40 text-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                    6. Lock In &amp; Celebrate
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-purple-300/80 px-1.5 py-0.5 rounded bg-purple-500/10">
                    STEP 06
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-white/55 leading-relaxed">
                  Reach at least 85% accuracy, keep refining up to 100% for maximum bonus time, then release the cursor to lock in your alignment!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Footer */}
        <div className="relative pt-3 border-t border-purple-500/15 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px] text-white/40 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>You can reopen this guide anytime via the <strong>How to Play</strong> button.</span>
          </span>

          <button
            onClick={handleDismiss}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-bold transition-all shadow-[0_0_20px_rgba(168,85,247,0.35)] flex items-center justify-center gap-2"
          >
            <span>Got It, Let&apos;s Play</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
