/**
 * 数据存储层 — SQLite 持久化存储
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { config } from '../config.js';

mkdirSync(dirname(config.DB_PATH), { recursive: true });

const db = new Database(config.DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function getDB(): Database.Database {
  return db;
}

export interface Parent {
  id: string;
  phone: string;
  passwordHash: string;
  nickname?: string;
  tokenVersion: number;
  createdAt: string;
}

export interface Child {
  id: string;
  parentId: string;
  nickname: string;
  birthDate: string;
  gender?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Session {
  id: string;
  childId: string;
  startedAt: string;
  endedAt?: string;
  durationSec?: number;
  turnCount: number;
  scenarioType?: string;
  difficultyLevel: number;
  summary?: string;
  emotionArc?: string[];
  keyMoments?: Array<{ turn: number; type: string; description: string }>;
}

export interface Turn {
  id: string;
  sessionId: string;
  turnNumber: number;
  role: 'child' | 'uli';
  text: string;
  emotionTag?: string;
  assessmentTag?: string;
  createdAt: string;
}

export interface SessionScore {
  id: string;
  sessionId: string;
  childId: string;
  creativity: number;
  criticalThinking: number;
  communication: number;
  collaboration: number;
  overall: number;
  sampleCount: number;
  confidence: number;
  createdAt: string;
}

export interface ChildBaseline {
  childId: string;
  dimension: string;
  currentScore: number;
  difficultyLevel: number;
  trend: 'rising' | 'stable' | 'declining';
  sessionCount: number;
  updatedAt: string;
}

export interface ChildMemory {
  id: string;
  childId: string;
  category: 'interest' | 'relation' | 'event' | 'emotion' | 'preference';
  key: string;
  value: string;
  source: 'extracted' | 'explicit' | 'parent';
  confidence: number;
  mentionCount: number;
  lastMentioned: string;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  childId: string;
  dimension: string;
  eventType: string;
  description: string;
  triggeredAt: string;
}

export interface AuditLog {
  id: string;
  childId?: string;
  action: string;
  details?: string;
  createdAt: string;
}

interface Migration {
  id: string;
  description: string;
  up: () => void;
}

function mapParentRow(row: any): Parent {
  return {
    id: row.id,
    phone: row.phone,
    passwordHash: row.password_hash,
    nickname: row.nickname ?? undefined,
    tokenVersion: row.token_version ?? 1,
    createdAt: row.created_at,
  };
}

function mapChildRow(row: any): Child {
  return {
    id: row.id,
    parentId: row.parent_id,
    nickname: row.nickname,
    birthDate: row.birth_date,
    gender: row.gender ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    createdAt: row.created_at,
  };
}

function mapSessionRow(row: any): Session {
  return {
    id: row.id,
    childId: row.child_id,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    durationSec: row.duration_sec ?? undefined,
    turnCount: row.turn_count,
    scenarioType: row.scenario_type ?? undefined,
    difficultyLevel: row.difficulty_level,
    summary: row.summary ?? undefined,
    emotionArc: row.emotion_arc ? JSON.parse(row.emotion_arc) : undefined,
    keyMoments: row.key_moments ? JSON.parse(row.key_moments) : undefined,
  };
}

function mapTurnRow(row: any): Turn {
  return {
    id: row.id,
    sessionId: row.session_id,
    turnNumber: row.turn_number,
    role: row.role,
    text: row.text,
    emotionTag: row.emotion_tag ?? undefined,
    assessmentTag: row.assessment_tag ?? undefined,
    createdAt: row.created_at,
  };
}

function mapScoreRow(row: any): SessionScore {
  return {
    id: row.id,
    sessionId: row.session_id,
    childId: row.child_id,
    creativity: row.creativity,
    criticalThinking: row.critical_thinking,
    communication: row.communication,
    collaboration: row.collaboration,
    overall: row.overall,
    sampleCount: row.sample_count,
    confidence: row.confidence,
    createdAt: row.created_at,
  };
}

function mapBaselineRow(row: any): ChildBaseline {
  return {
    childId: row.child_id,
    dimension: row.dimension,
    currentScore: row.current_score,
    difficultyLevel: row.difficulty_level,
    trend: row.trend,
    sessionCount: row.session_count,
    updatedAt: row.updated_at,
  };
}

function mapMemoryRow(row: any): ChildMemory {
  return {
    id: row.id,
    childId: row.child_id,
    category: row.category,
    key: row.key,
    value: row.value,
    source: row.source,
    confidence: row.confidence,
    mentionCount: row.mention_count,
    lastMentioned: row.last_mentioned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMilestoneRow(row: any): Milestone {
  return {
    id: row.id,
    childId: row.child_id,
    dimension: row.dimension,
    eventType: row.event_type,
    description: row.description,
    triggeredAt: row.triggered_at,
  };
}

function mapAuditRow(row: any): AuditLog {
  return {
    id: row.id,
    childId: row.child_id ?? undefined,
    action: row.action,
    details: row.details ?? undefined,
    createdAt: row.created_at,
  };
}

const migrations: Migration[] = [
  {
    id: '001_initial_schema',
    description: 'Create base tables and indexes',
    up: () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS parents (
          id TEXT PRIMARY KEY,
          phone TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          nickname TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS children (
          id TEXT PRIMARY KEY,
          parent_id TEXT NOT NULL REFERENCES parents(id),
          nickname TEXT NOT NULL,
          birth_date TEXT NOT NULL,
          gender TEXT,
          avatar_url TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          child_id TEXT NOT NULL REFERENCES children(id),
          started_at TEXT DEFAULT (datetime('now')),
          ended_at TEXT,
          duration_sec INTEGER,
          turn_count INTEGER DEFAULT 0,
          scenario_type TEXT,
          difficulty_level INTEGER DEFAULT 1,
          summary TEXT,
          emotion_arc TEXT,
          key_moments TEXT
        );

        CREATE TABLE IF NOT EXISTS turns (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES sessions(id),
          turn_number INTEGER NOT NULL,
          role TEXT NOT NULL,
          text TEXT NOT NULL,
          emotion_tag TEXT,
          assessment_tag TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS session_scores (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES sessions(id),
          child_id TEXT NOT NULL REFERENCES children(id),
          creativity REAL,
          critical_thinking REAL,
          communication REAL,
          collaboration REAL,
          overall REAL,
          sample_count INTEGER DEFAULT 0,
          confidence REAL,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS child_baselines (
          child_id TEXT NOT NULL REFERENCES children(id),
          dimension TEXT NOT NULL,
          current_score REAL DEFAULT 50,
          difficulty_level INTEGER DEFAULT 1,
          trend TEXT DEFAULT 'stable',
          session_count INTEGER DEFAULT 0,
          updated_at TEXT DEFAULT (datetime('now')),
          PRIMARY KEY (child_id, dimension)
        );

        CREATE TABLE IF NOT EXISTS child_memories (
          id TEXT PRIMARY KEY,
          child_id TEXT NOT NULL REFERENCES children(id),
          category TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          source TEXT DEFAULT 'extracted',
          confidence REAL DEFAULT 0.5,
          mention_count INTEGER DEFAULT 1,
          last_mentioned TEXT DEFAULT (datetime('now')),
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS milestones (
          id TEXT PRIMARY KEY,
          child_id TEXT NOT NULL REFERENCES children(id),
          dimension TEXT NOT NULL,
          event_type TEXT NOT NULL,
          description TEXT NOT NULL,
          triggered_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_child ON sessions(child_id);
        CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id);
        CREATE INDEX IF NOT EXISTS idx_scores_child ON session_scores(child_id);
        CREATE INDEX IF NOT EXISTS idx_memories_child ON child_memories(child_id);
        CREATE INDEX IF NOT EXISTS idx_milestones_child ON milestones(child_id);
      `);
    },
  },
  {
    id: '002_audit_logs',
    description: 'Create audit_logs table',
    up: () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          child_id TEXT REFERENCES children(id),
          action TEXT NOT NULL,
          details TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_audit_logs_child ON audit_logs(child_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      `);
    },
  },
  {
    id: '003_token_version',
    description: 'Add token_version to parents for token invalidation',
    up: () => {
      db.exec(`ALTER TABLE parents ADD COLUMN token_version INTEGER DEFAULT 1;`);
    },
  },
];

export function runMigrations(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const appliedRows = db.prepare(`SELECT id FROM _migrations`).all() as Array<{ id: string }>;
  const applied = new Set(appliedRows.map((row) => row.id));

  const insertMigration = db.prepare(`INSERT INTO _migrations (id, description) VALUES (?, ?)`);
  const wrapped = db.transaction(() => {
    for (const migration of migrations) {
      if (applied.has(migration.id)) continue;
      migration.up();
      insertMigration.run(migration.id, migration.description);
    }
  });

  wrapped();
}

runMigrations();

console.log(`[store] SQLite: ${config.DB_PATH}`);

export function logAudit(childId: string | undefined, action: string, details?: string): AuditLog {
  const id = randomUUID();
  db.prepare(`INSERT INTO audit_logs (id, child_id, action, details) VALUES (?, ?, ?, ?)`)
    .run(id, childId ?? null, action, details ?? null);

  return {
    id,
    childId,
    action,
    details,
    createdAt: new Date().toISOString(),
  };
}

// ============ 家长 ============

export function createParent(data: { phone: string; passwordHash: string; nickname?: string }): Parent {
  const id = randomUUID();
  db.prepare(`INSERT INTO parents (id, phone, password_hash, nickname) VALUES (?, ?, ?, ?)`)
    .run(id, data.phone, data.passwordHash, data.nickname || null);

  return {
    id,
    phone: data.phone,
    passwordHash: data.passwordHash,
    nickname: data.nickname,
    tokenVersion: 1,
    createdAt: new Date().toISOString(),
  };
}

export function findParentByPhone(phone: string): Parent | undefined {
  const row = db.prepare(`SELECT * FROM parents WHERE phone = ?`).get(phone) as any;
  if (!row) return undefined;
  return mapParentRow(row);
}

export function getParentById(id: string): Parent | undefined {
  const row = db.prepare(`SELECT * FROM parents WHERE id = ?`).get(id) as any;
  if (!row) return undefined;
  return mapParentRow(row);
}

export function incrementTokenVersion(parentId: string): void {
  db.prepare(`UPDATE parents SET token_version = token_version + 1 WHERE id = ?`).run(parentId);
}

// ============ 孩子 ============

export function createChild(data: { parentId: string; nickname: string; birthDate: string; gender?: string }): Child {
  const id = randomUUID();
  db.prepare(`INSERT INTO children (id, parent_id, nickname, birth_date, gender) VALUES (?, ?, ?, ?, ?)`)
    .run(id, data.parentId, data.nickname, data.birthDate, data.gender || null);

  const dims = ['creativity', 'critical_thinking', 'communication', 'collaboration'];
  const insertBaseline = db.prepare(`INSERT INTO child_baselines (child_id, dimension) VALUES (?, ?)`);
  for (const dim of dims) {
    insertBaseline.run(id, dim);
  }

  return {
    id,
    parentId: data.parentId,
    nickname: data.nickname,
    birthDate: data.birthDate,
    gender: data.gender,
    createdAt: new Date().toISOString(),
  };
}

export function getChildrenByParent(parentId: string): Child[] {
  const rows = db.prepare(`SELECT * FROM children WHERE parent_id = ?`).all(parentId) as any[];
  return rows.map(mapChildRow);
}

export function getChild(id: string): Child | undefined {
  const row = db.prepare(`SELECT * FROM children WHERE id = ?`).get(id) as any;
  if (!row) return undefined;
  return mapChildRow(row);
}

// ============ Session ============

export function createSession(childId: string, difficultyLevel = 1): Session {
  const id = randomUUID();
  db.prepare(`INSERT INTO sessions (id, child_id, difficulty_level) VALUES (?, ?, ?)`)
    .run(id, childId, difficultyLevel);

  return {
    id,
    childId,
    startedAt: new Date().toISOString(),
    turnCount: 0,
    difficultyLevel,
  };
}

export function getSession(id: string): Session | undefined {
  const row = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as any;
  if (!row) return undefined;
  return mapSessionRow(row);
}

export function endSession(id: string, summary?: string, emotionArc?: string[]): void {
  const session = getSession(id);
  if (!session) return;

  const durationSec = Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000);
  db.prepare(`
    UPDATE sessions
    SET ended_at = datetime('now'), duration_sec = ?, summary = ?, emotion_arc = ?
    WHERE id = ?
  `).run(durationSec, summary || null, emotionArc ? JSON.stringify(emotionArc) : null, id);
}

export function getSessionsByChild(childId: string): Session[] {
  const rows = db.prepare(`SELECT * FROM sessions WHERE child_id = ? ORDER BY started_at DESC`).all(childId) as any[];
  return rows.map(mapSessionRow);
}

// ============ Turn ============

const addTurnStmt = db.prepare(`
  INSERT INTO turns (id, session_id, turn_number, role, text, assessment_tag)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const updateTurnCountStmt = db.prepare(`UPDATE sessions SET turn_count = ? WHERE id = ?`);
const countTurnsStmt = db.prepare(`SELECT COUNT(*) as count FROM turns WHERE session_id = ?`);

const addTurnTx = db.transaction((sessionId: string, role: 'child' | 'uli', text: string, assessmentTag?: string): Turn => {
  const existing = countTurnsStmt.get(sessionId) as any;
  const turnNumber = (existing?.count || 0) + 1;
  const id = randomUUID();

  addTurnStmt.run(id, sessionId, turnNumber, role, text, assessmentTag || null);
  updateTurnCountStmt.run(turnNumber, sessionId);

  return {
    id,
    sessionId,
    turnNumber,
    role,
    text,
    assessmentTag,
    createdAt: new Date().toISOString(),
  };
});

export function addTurn(sessionId: string, role: 'child' | 'uli', text: string, assessmentTag?: string): Turn {
  return addTurnTx(sessionId, role, text, assessmentTag);
}

export function getTurnsBySession(sessionId: string): Turn[] {
  const rows = db.prepare(`SELECT * FROM turns WHERE session_id = ? ORDER BY turn_number`).all(sessionId) as any[];
  return rows.map(mapTurnRow);
}

// ============ 评分 ============

export function saveSessionScore(
  sessionId: string,
  childId: string,
  scoreData: {
    creativity: number;
    criticalThinking: number;
    communication: number;
    collaboration: number;
    overall: number;
    sampleCount: number;
    confidence: number;
  },
): SessionScore {
  const id = randomUUID();

  db.prepare(`
    INSERT INTO session_scores (
      id, session_id, child_id, creativity, critical_thinking, communication, collaboration, overall, sample_count, confidence
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    sessionId,
    childId,
    scoreData.creativity,
    scoreData.criticalThinking,
    scoreData.communication,
    scoreData.collaboration,
    scoreData.overall,
    scoreData.sampleCount,
    scoreData.confidence,
  );

  updateBaselines(childId, scoreData);

  return {
    id,
    sessionId,
    childId,
    ...scoreData,
    createdAt: new Date().toISOString(),
  };
}

export function getScoresByChild(childId: string): SessionScore[] {
  const rows = db.prepare(`SELECT * FROM session_scores WHERE child_id = ? ORDER BY created_at`).all(childId) as any[];
  return rows.map(mapScoreRow);
}

// ============ 基线 ============

export function getBaselines(childId: string): ChildBaseline[] {
  const rows = db.prepare(`SELECT * FROM child_baselines WHERE child_id = ?`).all(childId) as any[];
  return rows.map(mapBaselineRow);
}

export function getBaseline(childId: string, dimension: string): ChildBaseline | undefined {
  const row = db.prepare(`SELECT * FROM child_baselines WHERE child_id = ? AND dimension = ?`).get(childId, dimension) as any;
  if (!row) return undefined;
  return mapBaselineRow(row);
}

function updateBaselines(
  childId: string,
  scoreData: { creativity: number; criticalThinking: number; communication: number; collaboration: number },
): void {
  const mapping: Record<string, number> = {
    creativity: scoreData.creativity,
    critical_thinking: scoreData.criticalThinking,
    communication: scoreData.communication,
    collaboration: scoreData.collaboration,
  };

  const updateStmt = db.prepare(`
    UPDATE child_baselines
    SET current_score = ?, difficulty_level = ?, trend = ?, session_count = session_count + 1, updated_at = datetime('now')
    WHERE child_id = ? AND dimension = ?
  `);

  for (const [dim, newScore] of Object.entries(mapping)) {
    const baseline = getBaseline(childId, dim);
    if (!baseline) continue;

    const oldScore = baseline.currentScore;
    const smoothed = Math.round(oldScore * 0.7 + newScore * 0.3);

    let trend: ChildBaseline['trend'] = 'stable';
    if (smoothed > oldScore + 2) trend = 'rising';
    else if (smoothed < oldScore - 2) trend = 'declining';

    let diffLevel = baseline.difficultyLevel;
    if (smoothed > 70 && diffLevel < 4) diffLevel += 1;
    else if (smoothed < 30 && diffLevel > 1) diffLevel -= 1;

    updateStmt.run(smoothed, diffLevel, trend, childId, dim);
  }
}

// ============ 记忆 ============

const saveMemoryTx = db.transaction((
  childId: string,
  category: ChildMemory['category'],
  key: string,
  value: string,
): ChildMemory => {
  const existing = db.prepare(`SELECT * FROM child_memories WHERE child_id = ? AND key = ?`).get(childId, key) as any;

  if (existing) {
    db.prepare(`
      UPDATE child_memories
      SET value = ?, mention_count = mention_count + 1, last_mentioned = datetime('now'),
          updated_at = datetime('now'), confidence = MIN(1, confidence + 0.1)
      WHERE id = ?
    `).run(value, existing.id);

    const updated = db.prepare(`SELECT * FROM child_memories WHERE id = ?`).get(existing.id) as any;
    return mapMemoryRow(updated);
  }

  const id = randomUUID();
  db.prepare(`INSERT INTO child_memories (id, child_id, category, key, value) VALUES (?, ?, ?, ?, ?)`)
    .run(id, childId, category, key, value);

  return {
    id,
    childId,
    category,
    key,
    value,
    source: 'extracted',
    confidence: 0.5,
    mentionCount: 1,
    lastMentioned: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
});

export function saveMemory(
  childId: string,
  category: ChildMemory['category'],
  key: string,
  value: string,
): ChildMemory {
  return saveMemoryTx(childId, category, key, value);
}

export function getMemories(childId: string): ChildMemory[] {
  const rows = db.prepare(`
    SELECT * FROM child_memories
    WHERE child_id = ?
    ORDER BY mention_count DESC, updated_at DESC
  `).all(childId) as any[];

  return rows.map(mapMemoryRow);
}

export function getMemoryContext(childId: string): string {
  const mems = getMemories(childId);
  if (mems.length === 0) return '';

  const parts: string[] = [];
  const interests = mems.filter((m) => m.category === 'interest');
  const relations = mems.filter((m) => m.category === 'relation');
  const events = mems.filter((m) => m.category === 'event');
  const emotions = mems.filter((m) => m.category === 'emotion');

  if (interests.length > 0) parts.push(`喜欢：${interests.map((m) => m.value).join('、')}`);
  if (relations.length > 0) parts.push(`认识的人：${relations.map((m) => m.value).join('、')}`);
  if (events.length > 0) parts.push(`经历：${events.map((m) => m.value).join('、')}`);
  if (emotions.length > 0) parts.push(`情绪：${emotions.map((m) => m.value).join('、')}`);

  return parts.join('\n');
}

// ============ 里程碑 ============

export function addMilestone(childId: string, dimension: string, eventType: string, description: string): Milestone {
  const id = randomUUID();
  db.prepare(`INSERT INTO milestones (id, child_id, dimension, event_type, description) VALUES (?, ?, ?, ?, ?)`)
    .run(id, childId, dimension, eventType, description);

  return {
    id,
    childId,
    dimension,
    eventType,
    description,
    triggeredAt: new Date().toISOString(),
  };
}

export function getMilestones(childId: string): Milestone[] {
  const rows = db.prepare(`SELECT * FROM milestones WHERE child_id = ? ORDER BY triggered_at DESC`).all(childId) as any[];
  return rows.map(mapMilestoneRow);
}

// ============ 统计 ============

export function getRadarData(childId: string): {
  creativity: number;
  criticalThinking: number;
  communication: number;
  collaboration: number;
} {
  const bls = getBaselines(childId);
  return {
    creativity: bls.find((b) => b.dimension === 'creativity')?.currentScore || 50,
    criticalThinking: bls.find((b) => b.dimension === 'critical_thinking')?.currentScore || 50,
    communication: bls.find((b) => b.dimension === 'communication')?.currentScore || 50,
    collaboration: bls.find((b) => b.dimension === 'collaboration')?.currentScore || 50,
  };
}

export function getTrendData(childId: string): Array<{
  date: string;
  creativity: number;
  criticalThinking: number;
  communication: number;
  collaboration: number;
}> {
  const scores = getScoresByChild(childId);
  return scores.map((s) => ({
    date: s.createdAt.slice(0, 10),
    creativity: s.creativity,
    criticalThinking: s.criticalThinking,
    communication: s.communication,
    collaboration: s.collaboration,
  }));
}

// ============ 确保演示数据（只在首次运行时创建） ============

export function ensureDemoData(): { parent: Parent; child: Child } {
  let parent = findParentByPhone('13800000000');

  if (!parent) {
    parent = createParent({
      phone: '13800000000',
      passwordHash: '$2a$10$kdEnsZkbeNVAAostwQ7sBuZNs0QqiTX88NoGoPNS6VDxgttFG6FSK',
      nickname: '演示家长',
    });

    const child = createChild({
      parentId: parent.id,
      nickname: '小宇',
      birthDate: '2020-06-15',
      gender: 'male',
    });

    console.log(`[store] 创建演示数据: parent=${parent.id} child=${child.id} (${child.nickname})`);
    return { parent, child };
  }

  const children = getChildrenByParent(parent.id);
  let child = children[0];

  if (!child) {
    child = createChild({
      parentId: parent.id,
      nickname: '小宇',
      birthDate: '2020-06-15',
      gender: 'male',
    });
  }

  console.log(
    `[store] 已有演示数据: parent=${parent.id} child=${child.id} (${child.nickname}) | sessions=${getSessionsByChild(child.id).length} memories=${getMemories(child.id).length}`,
  );

  return { parent, child };
}

export function getAuditLogsByChild(childId: string): AuditLog[] {
  const rows = db.prepare(`SELECT * FROM audit_logs WHERE child_id = ? ORDER BY created_at DESC`).all(childId) as any[];
  return rows.map(mapAuditRow);
}

// ============ 账号删除 ============

/**
 * Delete a parent account and ALL associated data (children, sessions, turns, scores, memories, milestones, audit logs).
 * This is irreversible — required for privacy law compliance (个保法 / GDPR).
 */
export function deleteParentAccount(parentId: string): void {
  return deleteParentAccountTx(parentId);
}

const deleteParentAccountTx = db.transaction((parentId: string): void => {
  const children = getChildrenByParent(parentId);
  const childIds = children.map((c) => c.id);

  for (const childId of childIds) {
    // Delete in dependency order
    const sessionIds = db.prepare(`SELECT id FROM sessions WHERE child_id = ?`).all(childId) as Array<{ id: string }>;
    for (const { id: sid } of sessionIds) {
      db.prepare(`DELETE FROM turns WHERE session_id = ?`).run(sid);
      db.prepare(`DELETE FROM session_scores WHERE session_id = ?`).run(sid);
    }
    db.prepare(`DELETE FROM sessions WHERE child_id = ?`).run(childId);
    db.prepare(`DELETE FROM child_baselines WHERE child_id = ?`).run(childId);
    db.prepare(`DELETE FROM child_memories WHERE child_id = ?`).run(childId);
    db.prepare(`DELETE FROM milestones WHERE child_id = ?`).run(childId);
    db.prepare(`DELETE FROM audit_logs WHERE child_id = ?`).run(childId);
  }

  db.prepare(`DELETE FROM children WHERE parent_id = ?`).run(parentId);
  db.prepare(`DELETE FROM parents WHERE id = ?`).run(parentId);
});  // end deleteParentAccountTx

// ============ 数据清理 ============

/**
 * Prune stale data to prevent unbounded growth.
 * - audit_logs older than 90 days
 * - low-confidence memories older than 60 days (never reinforced)
 */
export function pruneStaleData(): { auditDeleted: number; memoriesDeleted: number } {
  const auditResult = db.prepare(`
    DELETE FROM audit_logs WHERE created_at < datetime('now', '-90 days')
  `).run();

  const memoryResult = db.prepare(`
    DELETE FROM child_memories
    WHERE mention_count <= 1
      AND confidence < 0.5
      AND updated_at < datetime('now', '-60 days')
  `).run();

  return {
    auditDeleted: auditResult.changes,
    memoriesDeleted: memoryResult.changes,
  };
}