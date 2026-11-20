'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PerspectiveCanvas from './PerspectiveCanvas';
import PerspectiveGameHUD from './PerspectiveGameHUD';
import LevelSelector from './LevelSelector';
import { PUZZLE_LEVELS } from './levels';
import constellationLinesData from '@/components/constellation/data/constellation_lines.json';
import starsData from '@/components/constellation/data/stars.json';
import type { ConstellationLines, StarRecord } from '@/components/constellation/types';

interface PerspectiveGameProps {
  onOpenPlanetarium: () => void;
}

export default function PerspectiveGame({ onOpenPlanetarium }: PerspectiveGameProps) {
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [isSolved, setIsSolved] = useState(false);
  const [showGhostHint, setShowGhostHint] = useState(false);
  const [showLevelSelector, setShowLevelSelector] = useState(false);
  const [scrambleKey, setScrambleKey] = useState(0);

  const currentLevel = PUZZLE_LEVELS[currentLevelIndex] || PUZZLE_LEVELS[0];

  const handleAlignmentChange = useCallback((acc: number) => {
    setAccuracy(acc);
  }, []);

  const handleSolved = useCallback(() => {
    setIsSolved(true);
  }, []);

  const handleScramble = useCallback(() => {
    setIsSolved(false);
    setAccuracy(0);
    setScrambleKey((prev) => prev + 1);
  }, []);

  const handleNextLevel = useCallback(() => {
    setIsSolved(false);
    setAccuracy(0);
    setCurrentLevelIndex((prev) => (prev + 1) % PUZZLE_LEVELS.length);
  }, []);

  const handleSelectLevel = useCallback((idx: number) => {
    setIsSolved(false);
    setAccuracy(0);
    setCurrentLevelIndex(idx);
  }, []);

  return (
    <div className="relative w-full h-full bg-[#02040b] overflow-hidden select-none">
      {/* 3D Perspective WebGL Canvas */}
      <PerspectiveCanvas
        key={`${currentLevel.id}-${scrambleKey}`}
        currentConstellationId={currentLevel.id}
        allStars={starsData as unknown as StarRecord[]}
        constellationLines={constellationLinesData as unknown as ConstellationLines}
        showGhostHint={showGhostHint}
        onAlignmentChange={handleAlignmentChange}
        onSolved={handleSolved}
        isSolved={isSolved}
      />

      {/* Glassmorphic Game HUD */}
      <PerspectiveGameHUD
        level={currentLevel}
        levelIndex={currentLevelIndex}
        totalLevels={PUZZLE_LEVELS.length}
        accuracy={accuracy}
        isSolved={isSolved}
        showGhostHint={showGhostHint}
        onToggleHint={() => setShowGhostHint((prev) => !prev)}
        onScramble={handleScramble}
        onNextLevel={handleNextLevel}
        onOpenLevelSelect={() => setShowLevelSelector(true)}
        onOpenPlanetarium={onOpenPlanetarium}
      />

      {/* Level Selector Modal */}
      {showLevelSelector && (
        <LevelSelector
          currentLevelId={currentLevel.id}
          onSelectLevel={handleSelectLevel}
          onClose={() => setShowLevelSelector(false)}
        />
      )}
    </div>
  );
}
