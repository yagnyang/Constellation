'use client';

import React, { useState, useMemo } from 'react';
import { RawConstellation } from '../core/StarDataManager';

interface ConstellationSelectorProps {
  constellations: RawConstellation[];
  activeId: string | null;
  solvedIds: Set<string>;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
}

// Iconic constellations for default view
const ICONIC_IDS = new Set([
  'Cas', 'Cru', 'UMa', 'Ori', 'Cyg', 'Leo', 'Sco', 'Tau', 'Peg', 'Lyr', 'CMa', 'Gem', 'Aql', 'Boo', 'And'
]);

export const ConstellationSelector: React.FC<ConstellationSelectorProps> = ({
  constellations,
  activeId,
  solvedIds,
  isOpen,
  onToggle,
  onSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'iconic' | 'all' | 'solved'>('iconic');

  const filtered = useMemo(() => {
    return constellations.filter((c) => {
      const matchesSearch =
        searchTerm === '' ||
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.english.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (filterMode === 'iconic') {
        return ICONIC_IDS.has(c.id);
      }
      if (filterMode === 'solved') {
        return solvedIds.has(c.id);
      }
      return true;
    });
  }, [constellations, searchTerm, filterMode, solvedIds]);

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={onToggle}
        className={`fixed left-6 bottom-6 z-40 px-4 py-2 bg-black/75 hover:bg-black/90 border border-purple-500/25 hover:border-purple-500/50 text-white rounded-full text-xs font-medium tracking-wide transition-all backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.8),0_0_15px_rgba(168,85,247,0.15)] flex items-center gap-2.5 ${
          isOpen ? 'ring-1 ring-purple-400/50 border-purple-400/60' : ''
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-purple-400" />
        <span>{isOpen ? 'Close' : 'Constellations'}</span>
        <span className="text-purple-300/60 text-[11px] font-normal">
          {solvedIds.size}/{constellations.length}
        </span>
      </button>

      {/* Slide-out Drawer */}
      {isOpen && (
        <aside
          className="fixed left-6 bottom-20 z-40 w-96 max-h-[70vh] bg-black/90 border border-purple-500/20 rounded-2xl backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.9),0_0_24px_rgba(168,85,247,0.12)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200"
          aria-label="Constellation List"
        >
          {/* Header */}
          <div className="p-4 border-b border-purple-500/10 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                <span>Constellations</span>
                <span className="text-[11px] font-normal text-purple-300/60">
                  {filtered.length} visible
                </span>
              </h2>
            </div>
            <button
              onClick={onToggle}
              className="text-white/40 hover:text-white text-sm w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/5 transition-all"
            >
              ✕
            </button>
          </div>

          {/* Filter Tabs & Search */}
          <div className="p-3 border-b border-purple-500/10 space-y-2.5 bg-purple-950/10">
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search constellation or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/[0.04] border border-purple-500/15 focus:border-purple-400 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none transition-all"
            />

            {/* Filter Buttons */}
            <div className="flex gap-1.5">
              {(['iconic', 'all', 'solved'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-all ${
                    filterMode === mode
                      ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                      : 'text-white/40 hover:text-white/70 border border-transparent'
                  }`}
                >
                  {mode === 'iconic' ? 'Featured' : mode === 'solved' ? `Solved (${solvedIds.size})` : 'All 88'}
                </button>
              ))}
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
            {filtered.length === 0 ? (
              <div className="text-center py-10 text-xs text-white/30">
                No constellations found
              </div>
            ) : (
              filtered.map((c) => {
                const isSelected = c.id === activeId;
                const isSolved = solvedIds.has(c.id);

                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      onSelect(c.id);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between group ${
                      isSelected
                        ? 'bg-purple-600/20 border-purple-500/60 text-white shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                        : isSolved
                        ? 'bg-purple-950/20 border-purple-500/15 text-white/90 hover:border-purple-500/35'
                        : 'bg-white/[0.02] border-transparent hover:bg-white/[0.05] hover:border-purple-500/15 text-white/75'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {c.art?.url && (
                        <div className="w-8 h-8 rounded-lg bg-black/60 border border-purple-500/20 flex-shrink-0 flex items-center justify-center overflow-hidden p-0.5">
                          <img
                            src={c.art.url}
                            alt=""
                            className="w-full h-full object-contain filter brightness-110"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-white group-hover:text-purple-200">
                            {c.name}
                          </span>
                          <span className="text-[10px] text-purple-400/80 font-mono">
                            {c.id}
                          </span>
                          {isSolved && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Solved
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-white/40 mt-0.5 truncate max-w-[180px]">
                          {c.english} &bull; {c.starCount} stars
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-white/40">
                      <div>{c.brightestStar?.name || 'Primary'}</div>
                      <div className="text-[10px] text-white/25">
                        {c.distMin} - {c.distMax} pc
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>
      )}
    </>
  );
};
