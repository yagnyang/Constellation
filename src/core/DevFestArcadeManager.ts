export type ConstellationTier = 'EASY' | 'MEDIUM' | 'HARD';

export const MIN_PASS_ACCURACY = 85.0;
export const MAX_ARCADE_ATTEMPTS = 2;

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
  attemptNumber: number; // 1 or 2
  points: number;
  score: number; // Constellations solved (0-88)
  totalConstellations: number; // 88
  totalTimeSec: number;
  avgAccuracy: number;
  avgOffsetDeg: number;
  isAllCleared: boolean;
  history: SolvedConstellationRecord[];
}

export interface CompactLeaderboardRecord {
  name: string;
  email?: string;
  phone?: string;
  score: number; // Competitive score (points)
  accuracy: number; // Average accuracy %
  constellationsSolved: number; // Number of constellations solved (0-88)
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  email?: string;
  phone?: string;
  points: number; // Competitive score derived from accuracy & minimum time across solved constellations
  score: number; // Constellations solved (0-88)
  avgAccuracy: number; // e.g. 98.4%
  totalTimeSec?: number; // Optional in-memory metric for active GameOver summary (not persisted in JSON)
  rank?: number;
  isAllCleared?: boolean;
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
    avgAccuracy: candidate.avgAccuracy,
    totalTimeSec: candidate.totalTimeSec,
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
const SEED_LEADERBOARD: CompactLeaderboardRecord[] = [
  {
    name: 'GDG_ApexStargazer',
    score: calculateCompetitiveScore(28, 98.7, 84.6),
    accuracy: 98.7,
    constellationsSolved: 28,
  },
  {
    name: 'CosmicVoyager',
    score: calculateCompetitiveScore(21, 98.1, 68.2),
    accuracy: 98.1,
    constellationsSolved: 21,
  },
  {
    name: 'DevFestLead',
    score: calculateCompetitiveScore(16, 97.6, 54.0),
    accuracy: 97.6,
    constellationsSolved: 16,
  },
  {
    name: 'AstroNova',
    score: calculateCompetitiveScore(11, 97.2, 39.8),
    accuracy: 97.2,
    constellationsSolved: 11,
  },
];

function makeEntryId(entry: Pick<LeaderboardEntry, 'playerName' | 'email' | 'points' | 'avgAccuracy' | 'score'>, index: number): string {
  return `${index}:${entry.playerName}:${entry.email ?? ''}:${entry.points}:${entry.avgAccuracy}:${entry.score}`;
}

/**
 * Convert a runtime LeaderboardEntry to the minimal JSON record stored in localStorage & exported:
 * only name, email (if present), phone (only if entered), score, accuracy, and constellationsSolved.
 */
export function toCompactLeaderboardRecord(
  entry: Pick<LeaderboardEntry, 'playerName' | 'email' | 'phone' | 'points' | 'avgAccuracy' | 'score'>
): CompactLeaderboardRecord {
  const name = entry.playerName.trim();
  const email = entry.email?.trim();
  const phone = entry.phone?.trim();

  const record: CompactLeaderboardRecord = {
    name,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    score: Math.round(entry.points),
    accuracy: +Number(entry.avgAccuracy).toFixed(2),
    constellationsSolved: Math.max(0, Math.round(entry.score)),
  };
  return record;
}

/**
 * Normalize either a compact JSON record or a legacy bloated localStorage record into a LeaderboardEntry.
 */
function parseStoredEntry(raw: unknown): { entry: LeaderboardEntry; wasLegacy: boolean } | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  // New compact format: { name, email?, phone?, score, accuracy, constellationsSolved }
  if (typeof obj.name === 'string' && typeof obj.constellationsSolved === 'number') {
    const scoreVal = typeof obj.score === 'number' && Number.isFinite(obj.score) ? Math.round(obj.score) : 0;
    const accuracyVal =
      typeof obj.accuracy === 'number' && Number.isFinite(obj.accuracy) ? +obj.accuracy.toFixed(2) : 0;
    const solvedVal = Number.isFinite(obj.constellationsSolved)
      ? Math.max(0, Math.round(obj.constellationsSolved))
      : 0;
    const email = typeof obj.email === 'string' && obj.email.trim() ? obj.email.trim() : undefined;
    const phone = typeof obj.phone === 'string' && obj.phone.trim() ? obj.phone.trim() : undefined;

    const allowedKeys = new Set(['name', 'email', 'phone', 'score', 'accuracy', 'constellationsSolved']);
    const hasExtraKeys = Object.keys(obj).some((k) => !allowedKeys.has(k));

    return {
      entry: {
        id: '',
        playerName: obj.name.trim() || 'Stargazer',
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        points: scoreVal,
        score: solvedVal,
        avgAccuracy: accuracyVal,
        isAllCleared: solvedVal >= 88,
      },
      wasLegacy: hasExtraKeys,
    };
  }

  // Legacy format: { playerName, points?, score (solved), avgAccuracy, totalTimeSec?, history?, ... }
  if (typeof obj.playerName === 'string') {
    const solvedVal = typeof obj.score === 'number' && Number.isFinite(obj.score) ? Math.max(0, Math.round(obj.score)) : 0;
    const accuracyVal =
      typeof obj.avgAccuracy === 'number' && Number.isFinite(obj.avgAccuracy)
        ? +obj.avgAccuracy.toFixed(2)
        : 0;
    const totalTimeSec =
      typeof obj.totalTimeSec === 'number' && Number.isFinite(obj.totalTimeSec) ? obj.totalTimeSec : 0;
    const pointsVal =
      typeof obj.points === 'number' && Number.isFinite(obj.points)
        ? Math.round(obj.points)
        : calculateCompetitiveScore(solvedVal, accuracyVal, totalTimeSec);
    const email = typeof obj.email === 'string' && obj.email.trim() ? obj.email.trim() : undefined;
    const phone = typeof obj.phone === 'string' && obj.phone.trim() ? obj.phone.trim() : undefined;

    return {
      entry: {
        id: '',
        playerName: obj.playerName.trim() || 'Stargazer',
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        points: pointsVal,
        score: solvedVal,
        avgAccuracy: accuracyVal,
        isAllCleared: solvedVal >= 88,
      },
      wasLegacy: true,
    };
  }

  return null;
}

/**
 * Compare two leaderboard entries according to competitive accuracy + score criteria:
 * 1. Primary: Competitive Score / Points (descending)
 * 2. Tie-breaker 1: Average accuracy % (descending)
 * 3. Tie-breaker 2: Constellations solved (descending)
 */
export function compareLeaderboardEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (b.points !== a.points) {
    return b.points - a.points;
  }
  if (Math.abs(b.avgAccuracy - a.avgAccuracy) > 0.05) {
    return b.avgAccuracy - a.avgAccuracy;
  }
  return b.score - a.score;
}

function hydrateAndRank(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const sorted = [...entries].sort(compareLeaderboardEntries);
  return sorted.map((entry, index) => ({
    ...entry,
    id: makeEntryId(entry, index),
    rank: index + 1,
    isAllCleared: entry.score >= 88,
  }));
}

function persistCompactEntries(entries: LeaderboardEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    const compact = entries.map(toCompactLeaderboardRecord);
    localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(compact));
  } catch {}
}

/**
 * Load and rank leaderboard from localStorage (automatically compacting any legacy entries)
 */
export function loadLeaderboard(): LeaderboardEntry[] {
  const seedHydrated = () =>
    hydrateAndRank(
      SEED_LEADERBOARD.map((s) => ({
        id: '',
        playerName: s.name,
        points: s.score,
        score: s.constellationsSolved,
        avgAccuracy: s.accuracy,
        isAllCleared: s.constellationsSolved >= 88,
      }))
    );

  if (typeof window === 'undefined') return seedHydrated();

  try {
    const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(SEED_LEADERBOARD));
      return seedHydrated();
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return seedHydrated();
    }

    let needsCompaction = false;
    const entries: LeaderboardEntry[] = [];
    for (const item of parsed) {
      const normalized = parseStoredEntry(item);
      if (normalized) {
        entries.push(normalized.entry);
        if (normalized.wasLegacy) needsCompaction = true;
      } else {
        needsCompaction = true;
      }
    }

    const ranked = hydrateAndRank(entries);

    // Rewrite legacy bloated records (e.g. with per-constellation history) in compact format immediately
    if (needsCompaction) {
      persistCompactEntries(ranked);
    }

    return ranked;
  } catch {
    return seedHydrated();
  }
}

/**
 * Add a new player's session result to the leaderboard and persist in compact JSON format
 */
export function saveLeaderboardEntry(entryData: {
  playerName: string;
  email?: string;
  phone?: string;
  points?: number;
  score: number;
  avgAccuracy: number;
  totalTimeSec?: number;
}): { entry: LeaderboardEntry; rank: number; entries: LeaderboardEntry[] } {
  const currentEntries = loadLeaderboard();

  const points =
    typeof entryData.points === 'number' && Number.isFinite(entryData.points)
      ? Math.round(entryData.points)
      : calculateCompetitiveScore(entryData.score, entryData.avgAccuracy, entryData.totalTimeSec ?? 0);

  const email = entryData.email?.trim() || undefined;
  const phone = entryData.phone?.trim() || undefined;
  const solvedCount = Math.max(0, Math.round(entryData.score));
  const roundedAcc = +Number(entryData.avgAccuracy).toFixed(2);

  const newEntry: LeaderboardEntry = {
    id: '',
    playerName: entryData.playerName.trim() || 'Stargazer',
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    points,
    score: solvedCount,
    avgAccuracy: roundedAcc,
    isAllCleared: solvedCount >= 88,
  };

  const updatedEntries = [...currentEntries, newEntry];
  updatedEntries.sort(compareLeaderboardEntries);

  const savedIdx = updatedEntries.indexOf(newEntry);
  const rankedEntries = updatedEntries.map((e, index) => ({
    ...e,
    id: makeEntryId(e, index),
    rank: index + 1,
    isAllCleared: e.score >= 88,
  }));

  persistCompactEntries(rankedEntries);

  const savedEntry = rankedEntries[savedIdx >= 0 ? savedIdx : rankedEntries.length - 1];
  const savedRank = savedEntry.rank ?? rankedEntries.length;

  return {
    entry: {
      ...savedEntry,
      ...(typeof entryData.totalTimeSec === 'number' ? { totalTimeSec: entryData.totalTimeSec } : {}),
    },
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
 * Export leaderboard data as lean JSON containing only:
 * name, email, phone (if provided), score, accuracy, and constellationsSolved
 */
export function exportLeaderboardJSON(): string {
  const entries = loadLeaderboard();
  const compact = entries.map(toCompactLeaderboardRecord);
  return JSON.stringify(compact, null, 2);
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
