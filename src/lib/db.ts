import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface PlayerRecord {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  points: number | null;
  score: number | null;
  total_time_sec: number | null;
  avg_accuracy: number | null;
  attempts: number | null;
  created_at: string;
}

type SqliteParam = string | number | null;

interface SqliteStatement {
  get: (...params: SqliteParam[]) => unknown;
  all: (...params: SqliteParam[]) => unknown[];
}

interface SqliteDatabase {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
}

type SqliteModule = {
  DatabaseSync?: new (location: string) => SqliteDatabase;
};

function resolveDbDir(): string {
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), 'constellation-aligner-data');
  }
  const localDir = path.join(process.cwd(), 'data');
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    fs.accessSync(localDir, fs.constants.W_OK);
    return localDir;
  } catch {
    return path.join(os.tmpdir(), 'constellation-aligner-data');
  }
}

let dbInstance: SqliteDatabase | null = null;
let sqliteUnavailable = false;
const memoryPlayers: PlayerRecord[] = [];
let memoryNextId = 1;

function loadDatabaseSync(): (new (location: string) => SqliteDatabase) | null {
  try {
    const getBuiltin = (
      process as unknown as { getBuiltinModule?: (id: string) => unknown }
    ).getBuiltinModule;
    const mod = getBuiltin?.('node:sqlite') as SqliteModule | undefined;
    return typeof mod?.DatabaseSync === 'function' ? mod.DatabaseSync : null;
  } catch {
    return null;
  }
}

/**
 * Returns a singleton SQLite DatabaseSync connection and ensures the players table exists.
 * Returns null if `node:sqlite` is unavailable (falling back to in-memory storage).
 */
export function getDb(): SqliteDatabase | null {
  if (dbInstance) return dbInstance;
  if (sqliteUnavailable) return null;

  const DatabaseSync = loadDatabaseSync();
  if (!DatabaseSync) {
    sqliteUnavailable = true;
    return null;
  }

  try {
    const dbDir = resolveDbDir();
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'players.db');
    const db = new DatabaseSync(dbPath);
    db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        points INTEGER,
        score INTEGER,
        total_time_sec REAL,
        avg_accuracy REAL,
        attempts INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Safe migrations for existing databases
    const cols = db.prepare(`PRAGMA table_info(players)`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === 'points')) {
      db.exec(`ALTER TABLE players ADD COLUMN points INTEGER;`);
    }
    if (!cols.some((c) => c.name === 'attempts')) {
      db.exec(`ALTER TABLE players ADD COLUMN attempts INTEGER;`);
    }

    dbInstance = db;
    return db;
  } catch (err) {
    console.warn('SQLite unavailable, falling back to in-memory store:', err);
    sqliteUnavailable = true;
    return null;
  }
}

export function createPlayer(input: {
  name: string;
  email: string;
  phone?: string | null;
}): PlayerRecord {
  const phoneVal = input.phone && input.phone.trim() ? input.phone.trim() : null;
  const db = getDb();

  if (!db) {
    const record: PlayerRecord = {
      id: memoryNextId++,
      name: input.name.trim(),
      email: input.email.trim(),
      phone: phoneVal,
      points: null,
      score: null,
      total_time_sec: null,
      avg_accuracy: null,
      attempts: null,
      created_at: new Date().toISOString(),
    };
    memoryPlayers.push(record);
    return record;
  }

  const stmt = db.prepare(`
    INSERT INTO players (name, email, phone)
    VALUES (?, ?, ?)
    RETURNING id, name, email, phone, points, score, total_time_sec, avg_accuracy, attempts, created_at
  `);

  const row = stmt.get(input.name.trim(), input.email.trim(), phoneVal);
  return row as unknown as PlayerRecord;
}

export function updatePlayerScore(input: {
  id: number;
  points: number;
  score: number;
  totalTimeSec: number;
  avgAccuracy: number;
  attempts?: number;
}): PlayerRecord | null {
  const attemptsVal =
    typeof input.attempts === 'number' && Number.isInteger(input.attempts) ? input.attempts : 1;
  const db = getDb();

  if (!db) {
    const found = memoryPlayers.find((p) => p.id === input.id);
    if (!found) return null;
    found.points = input.points;
    found.score = input.score;
    found.total_time_sec = input.totalTimeSec;
    found.avg_accuracy = input.avgAccuracy;
    found.attempts = attemptsVal;
    return found;
  }

  const stmt = db.prepare(`
    UPDATE players
    SET points = ?, score = ?, total_time_sec = ?, avg_accuracy = ?, attempts = ?
    WHERE id = ?
    RETURNING id, name, email, phone, points, score, total_time_sec, avg_accuracy, attempts, created_at
  `);

  const row = stmt.get(
    input.points,
    input.score,
    input.totalTimeSec,
    input.avgAccuracy,
    attemptsVal,
    input.id
  );
  return (row as unknown as PlayerRecord) ?? null;
}

export function listPlayers(): PlayerRecord[] {
  const db = getDb();

  if (!db) {
    return [...memoryPlayers].sort((a, b) => {
      const ptsDiff = (b.points ?? -1) - (a.points ?? -1);
      if (ptsDiff !== 0) return ptsDiff;
      const accDiff = (b.avg_accuracy ?? -1) - (a.avg_accuracy ?? -1);
      if (accDiff !== 0) return accDiff;
      const timeDiff = (a.total_time_sec ?? 999999) - (b.total_time_sec ?? 999999);
      if (timeDiff !== 0) return timeDiff;
      return b.id - a.id;
    });
  }

  const stmt = db.prepare(`
    SELECT id, name, email, phone, points, score, total_time_sec, avg_accuracy, attempts, created_at
    FROM players
    ORDER BY COALESCE(points, -1) DESC, COALESCE(avg_accuracy, -1) DESC, COALESCE(total_time_sec, 999999) ASC, id DESC
  `);

  return stmt.all() as unknown as PlayerRecord[];
}
