export type ConstellationTier = 'EASY' | 'MEDIUM' | 'HARD';

export const MIN_PASS_ACCURACY = 85.0;
export const MAX_ARCADE_ATTEMPTS = 3;

export interface TierInfo {
  tier: ConstellationTier;
  label: string;
  minBonusSec: number;
  maxBonusSec: number;
  bonusSec: number;
  starRange: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  glowColor: string;
  bonusLabel: string;
}

export function getConstellationTierInfo(starCount: number): TierInfo {
  if (starCount <= 5) {
    return {
      tier: 'EASY',
      label: 'Easy',
      minBonusSec: 0.5,
      maxBonusSec: 2.5,
      bonusSec: 2.5,
      starRange: '2–5 Stars',
      badgeBg: 'bg-purple-950/40',
      badgeBorder: 'border-purple-600/40',
      badgeText: 'text-purple-300',
      glowColor: 'rgba(168,85,247,0.25)',
      bonusLabel: '+0.5s–2.5s',
    };
  } else if (starCount <= 12) {
    return {
      tier: 'MEDIUM',
      label: 'Medium',
      minBonusSec: 1.0,
      maxBonusSec: 4.0,
      bonusSec: 4.0,
      starRange: '6–12 Stars',
      badgeBg: 'bg-purple-900/40',
      badgeBorder: 'border-purple-500/50',
      badgeText: 'text-purple-200',
      glowColor: 'rgba(192,132,252,0.3)',
      bonusLabel: '+1.0s–4.0s',
    };
  } else {
    return {
      tier: 'HARD',
      label: 'Hard',
      minBonusSec: 2.0,
      maxBonusSec: 6.0,
      bonusSec: 6.0,
      starRange: '13+ Stars',
      badgeBg: 'bg-purple-800/40',
      badgeBorder: 'border-purple-400/60',
      badgeText: 'text-purple-100',
      glowColor: 'rgba(216,180,254,0.35)',
      bonusLabel: '+2.0s–6.0s',
    };
  }
}

/**
 * Uniform linear interpolation of bonus time for accuracy in [85%, 100%]:
 * - Easy:   85% -> 0.5s, 100% -> 2.5s
 * - Medium: 85% -> 1.0s, 100% -> 4.0s
 * - Hard:   85% -> 2.0s, 100% -> 6.0s
 * Returns 0 if accuracy is below MIN_PASS_ACCURACY (85%).
 */
export function calculateAccuracyBonus(starCount: number, accuracy: number): number {
  if (accuracy < MIN_PASS_ACCURACY) return 0;
  const tierInfo = getConstellationTierInfo(starCount);
  const t = Math.max(0, Math.min(1, (accuracy - MIN_PASS_ACCURACY) / (100 - MIN_PASS_ACCURACY)));
  const bonus = tierInfo.minBonusSec + t * (tierInfo.maxBonusSec - tierInfo.minBonusSec);
  return +bonus.toFixed(2);
}

export interface SolvedConstellationRecord {
  constellationId: string;
  constellationName: string;
  starCount: number;
  tier: ConstellationTier;
  timeSpentSec: number;
  accuracy: number;
  alphaDeg: number;
  bonusSec: number;
}

export interface AttemptResult {
  attemptNumber: number; // 1, 2, or 3
  points: number;
  score: number; // Constellations solved (0-88)
  totalConstellations: number; // 88
  totalTimeSec: number;
  avgAccuracy: number;
  avgOffsetDeg: number;
  isAllCleared: boolean;
  history: SolvedConstellationRecord[];
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  points: number; // Competitive score derived from accuracy & minimum time across solved constellations
  score: number; // Constellations solved (0-88)
  totalConstellations: number; // 88
  totalTimeSec: number; // Total active puzzle time in seconds
  avgAccuracy: number; // e.g. 98.4%
  avgOffsetDeg: number; // Average residual alpha degree e.g. 1.2°
  date: string;
  rank?: number;
  isAllCleared?: boolean;
  attemptsUsed?: number;
  history?: SolvedConstellationRecord[];
}

/**
 * Pick the highest-scoring attempt from a player's consecutive tries using
 * the official competitive ranking criteria (Points DESC, Accuracy DESC, Time ASC, Solved DESC).
 */
export function pickBestAttempt(attempts: AttemptResult[]): AttemptResult {
  if (attempts.length === 0) {
    throw new Error('pickBestAttempt requires at least one attempt');
  }
  return [...attempts].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (Math.abs(b.avgAccuracy - a.avgAccuracy) > 0.05) return b.avgAccuracy - a.avgAccuracy;
    if (Math.abs(a.totalTimeSec - b.totalTimeSec) > 0.05) return a.totalTimeSec - b.totalTimeSec;
    if (b.score !== a.score) return b.score - a.score;
    return a.avgOffsetDeg - b.avgOffsetDeg;
  })[0];
}

/**
 * Calculate the projected leaderboard rank for a candidate attempt without saving it yet.
 */
export function getProjectedRank(candidate: AttemptResult): number {
  const existing = loadLeaderboard();
  const previewEntry: LeaderboardEntry = {
    id: '__preview__',
    playerName: '__preview__',
    points: candidate.points,
    score: candidate.score,
    totalConstellations: candidate.totalConstellations,
    totalTimeSec: candidate.totalTimeSec,
    avgAccuracy: candidate.avgAccuracy,
    avgOffsetDeg: candidate.avgOffsetDeg,
    date: '',
    isAllCleared: candidate.isAllCleared,
  };
  const combined = [...existing, previewEntry].sort(compareLeaderboardEntries);
  const idx = combined.findIndex((e) => e.id === '__preview__');
  return idx >= 0 ? idx + 1 : combined.length;
}

/**
 * Competitive tournament score combining highest accuracy with minimum total time:
 *   points = round(solved * 1000 * (avgAccuracy / 100)^2 * (10 / (5 + avgTimePerSolve)))
 * - Rewards solving more constellations (prevents 1-solve quitting)
 * - Strongly rewards higher accuracy (quadratic precision scaling from 85% -> 100%)
 * - Rewards lower total time (faster average solve time scales speed multiplier up to 2.0x)
 */
export function calculateCompetitiveScore(
  solvedCount: number,
  avgAccuracy: number,
  totalTimeSec: number
): number {
  if (solvedCount <= 0 || avgAccuracy <= 0) return 0;
  const clampedAcc = Math.max(0, Math.min(100, avgAccuracy));
  const avgTime = Math.max(0.1, totalTimeSec / solvedCount);
  const accuracyFactor = Math.pow(clampedAcc / 100, 2);
  const speedMultiplier = 10 / (5 + avgTime);
  return Math.round(solvedCount * 1000 * accuracyFactor * speedMultiplier);
}

const LEADERBOARD_STORAGE_KEY = 'starc_devfest_leaderboard';

// Default seeded booth records so leaderboard looks exciting immediately on arrival
const SEED_LEADERBOARD: LeaderboardEntry[] = [
  {
    id: 'seed-1',
    playerName: 'GDG_ApexStargazer',
    points: calculateCompetitiveScore(28, 98.7, 84.6),
    score: 28,
    totalConstellations: 88,
    totalTimeSec: 84.6,
    avgAccuracy: 98.7,
    avgOffsetDeg: 1.1,
    date: '10:15 AM',
    isAllCleared: false,
  },
  {
    id: 'seed-2',
    playerName: 'CosmicVoyager',
    points: calculateCompetitiveScore(21, 98.1, 68.2),
    score: 21,
    totalConstellations: 88,
    totalTimeSec: 68.2,
    avgAccuracy: 98.1,
    avgOffsetDeg: 1.5,
    date: '10:42 AM',
    isAllCleared: false,
  },
  {
    id: 'seed-3',
    playerName: 'DevFestLead',
    points: calculateCompetitiveScore(16, 97.6, 54.0),
    score: 16,
    totalConstellations: 88,
    totalTimeSec: 54.0,
    avgAccuracy: 97.6,
    avgOffsetDeg: 1.9,
    date: '11:05 AM',
    isAllCleared: false,
  },
  {
    id: 'seed-4',
    playerName: 'AstroNova',
    points: calculateCompetitiveScore(11, 97.2, 39.8),
    score: 11,
    totalConstellations: 88,
    totalTimeSec: 39.8,
    avgAccuracy: 97.2,
    avgOffsetDeg: 2.2,
    date: '11:30 AM',
    isAllCleared: false,
  },
];

/**
 * Compare two leaderboard entries according to competitive accuracy + speed criteria:
 * 1. Primary: Competitive Points (descending - highest accuracy with minimum time wins!)
 * 2. Tie-breaker 1: Average accuracy % (descending - higher precision wins)
 * 3. Tie-breaker 2: Total time taken (ascending - minimum elapsed time wins)
 * 4. Tie-breaker 3: Constellations solved (descending)
 * 5. Tie-breaker 4: Average residual offset alpha in degrees (ascending - closest to 0° wins)
 */
export function compareLeaderboardEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  const pointsA = a.points ?? calculateCompetitiveScore(a.score, a.avgAccuracy, a.totalTimeSec);
  const pointsB = b.points ?? calculateCompetitiveScore(b.score, b.avgAccuracy, b.totalTimeSec);

  if (pointsB !== pointsA) {
    return pointsB - pointsA;
  }
  if (Math.abs(b.avgAccuracy - a.avgAccuracy) > 0.05) {
    return b.avgAccuracy - a.avgAccuracy;
  }
  if (Math.abs(a.totalTimeSec - b.totalTimeSec) > 0.05) {
    return a.totalTimeSec - b.totalTimeSec;
  }
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  return a.avgOffsetDeg - b.avgOffsetDeg;
}

/**
 * Load and rank leaderboard from localStorage
 */
export function loadLeaderboard(): LeaderboardEntry[] {
  if (typeof window === 'undefined') return [...SEED_LEADERBOARD];

  try {
    const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    let entries: LeaderboardEntry[] = [];
    if (raw) {
      entries = JSON.parse(raw);
    } else {
      entries = [...SEED_LEADERBOARD];
      localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(entries));
    }

    // Ensure legacy entries without points have their competitive score computed
    entries = entries.map((entry) => ({
      ...entry,
      points:
        typeof entry.points === 'number'
          ? entry.points
          : calculateCompetitiveScore(entry.score, entry.avgAccuracy, entry.totalTimeSec),
    }));

    entries.sort(compareLeaderboardEntries);
    return entries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  } catch {
    return [...SEED_LEADERBOARD].map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }
}

/**
 * Add a new player's session result to the leaderboard and persist
 */
export function saveLeaderboardEntry(
  entryData: Omit<LeaderboardEntry, 'id' | 'rank' | 'date' | 'points'> & { points?: number }
): { entry: LeaderboardEntry; rank: number; entries: LeaderboardEntry[] } {
  const currentEntries = loadLeaderboard();

  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const points =
    typeof entryData.points === 'number'
      ? entryData.points
      : calculateCompetitiveScore(entryData.score, entryData.avgAccuracy, entryData.totalTimeSec);

  const newEntry: LeaderboardEntry = {
    ...entryData,
    points,
    id: `devfest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: timeString,
  };

  const updatedEntries = [...currentEntries, newEntry];
  updatedEntries.sort(compareLeaderboardEntries);

  const rankedEntries = updatedEntries.map((e, index) => ({
    ...e,
    rank: index + 1,
  }));

  const savedRank = rankedEntries.find((e) => e.id === newEntry.id)?.rank || rankedEntries.length;

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(rankedEntries));
    } catch {}
  }

  return {
    entry: { ...newEntry, rank: savedRank },
    rank: savedRank,
    entries: rankedEntries,
  };
}

/**
 * Clear leaderboard for booth organizers (writes empty array so seed records are not re-inserted)
 */
export function clearLeaderboard(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify([]));
  } catch {}
}

/**
 * Export leaderboard data as JSON for post-event analytics
 */
export function exportLeaderboardJSON(): string {
  const entries = loadLeaderboard();
  return JSON.stringify(entries, null, 2);
}

/**
 * Generate a deterministic sequential 1-to-88 constellation ladder.
 * Every player gets the exact same ordered sequence from #1 through #88
 * (no randomization) for fair competitive play, while each constellation's
 * Easy / Medium / Hard bonus tier is still determined by its star count.
 */
export function generateArcadeQueue(
  constellations: { id: string; starCount: number }[]
): string[] {
  return constellations.map((c) => c.id);
}
