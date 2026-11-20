export type ConstellationTier = 'EASY' | 'MEDIUM' | 'HARD';

export interface TierInfo {
  tier: ConstellationTier;
  label: string;
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
      bonusSec: 2.5,
      starRange: '2–5 Stars',
      badgeBg: 'bg-purple-950/40',
      badgeBorder: 'border-purple-600/40',
      badgeText: 'text-purple-300',
      glowColor: 'rgba(168,85,247,0.25)',
      bonusLabel: '+2.5s',
    };
  } else if (starCount <= 12) {
    return {
      tier: 'MEDIUM',
      label: 'Medium',
      bonusSec: 4.0,
      starRange: '6–12 Stars',
      badgeBg: 'bg-purple-900/40',
      badgeBorder: 'border-purple-500/50',
      badgeText: 'text-purple-200',
      glowColor: 'rgba(192,132,252,0.3)',
      bonusLabel: '+4.0s',
    };
  } else {
    return {
      tier: 'HARD',
      label: 'Hard',
      bonusSec: 6.0,
      starRange: '13+ Stars',
      badgeBg: 'bg-purple-800/40',
      badgeBorder: 'border-purple-400/60',
      badgeText: 'text-purple-100',
      glowColor: 'rgba(216,180,254,0.35)',
      bonusLabel: '+6.0s',
    };
  }
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

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number; // Constellations solved (0-88)
  totalConstellations: number; // 88
  totalTimeSec: number; // Total active puzzle time in seconds
  avgAccuracy: number; // e.g. 98.4%
  avgOffsetDeg: number; // Average residual alpha degree e.g. 1.2°
  date: string;
  rank?: number;
  isAllCleared?: boolean;
  history?: SolvedConstellationRecord[];
}

const LEADERBOARD_STORAGE_KEY = 'starc_devfest_leaderboard';

// Default seeded booth records so leaderboard looks exciting immediately on arrival
const SEED_LEADERBOARD: LeaderboardEntry[] = [
  {
    id: 'seed-1',
    playerName: 'GDG_ApexStargazer',
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
 * Compare two leaderboard entries according to DevFest tournament criteria:
 * 1. Score: Number of constellations solved (descending - highest wins)
 * 2. Tie-breaker 1: Total time taken (ascending - least elapsed time wins!)
 * 3. Tie-breaker 2: Average accuracy % (descending - higher precision wins)
 * 4. Tie-breaker 3: Average residual offset alpha in degrees (ascending - closest to 0° wins)
 */
export function compareLeaderboardEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  if (Math.abs(a.totalTimeSec - b.totalTimeSec) > 0.05) {
    return a.totalTimeSec - b.totalTimeSec;
  }
  if (Math.abs(b.avgAccuracy - a.avgAccuracy) > 0.05) {
    return b.avgAccuracy - a.avgAccuracy;
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
  entryData: Omit<LeaderboardEntry, 'id' | 'rank' | 'date'>
): { entry: LeaderboardEntry; rank: number; entries: LeaderboardEntry[] } {
  const currentEntries = loadLeaderboard();

  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const newEntry: LeaderboardEntry = {
    ...entryData,
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
 * Clear leaderboard for booth organizers
 */
export function clearLeaderboard(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LEADERBOARD_STORAGE_KEY);
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
 * Generate a progressive 88-constellation arcade ladder:
 * - Tier 1: Easy constellations (2–5 stars) shuffled
 * - Tier 2: Medium constellations (6–12 stars) shuffled
 * - Tier 3: Hard constellations (13+ stars) shuffled
 *
 * This provides a smooth progression curve for attendees:
 * Start with approachable patterns, build up time reserves, then face hard challenges.
 */
export function generateArcadeQueue(
  constellations: { id: string; starCount: number }[]
): string[] {
  const easy: string[] = [];
  const medium: string[] = [];
  const hard: string[] = [];

  for (const c of constellations) {
    if (c.starCount <= 5) {
      easy.push(c.id);
    } else if (c.starCount <= 12) {
      medium.push(c.id);
    } else {
      hard.push(c.id);
    }
  }

  // Fisher-Yates shuffle
  const shuffle = (arr: string[]) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  return [...shuffle(easy), ...shuffle(medium), ...shuffle(hard)];
}
