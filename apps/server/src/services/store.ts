/**
 * 数据存储层 — SQLite 持久化存储
 *
 * 数据存在 ~/Desktop/uli/data/uli.db 文件里
 * 服务器重启不丢失，换 PostgreSQL 只改这一个文件
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../../data/uli.db');

// 确保 data 目录存在
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// 开启 WAL 模式，性能更好
db.pragma('journal_mode = WAL');

// ============ 建表 ============

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

console.log(`[store] SQLite: ${DB_PATH}`);

// ============ 类型 ============

export interface Parent {
  id: string;
  phone: string;
  passwordHash: string;
  nickname?: string;
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

// ============ 家长 ============

export function createParent(data: { phone: string; passwordHash: string; nickname?: string }): Parent {
  const id = randomUUID();
  db.prepare(`INSERT INTO parents (id, phone, password_hash, nickname) VALUES (?, ?, ?, ?)`)
    .run(id, data.phone, data.passwordHash, data.nickname || null);
  return { id, phone: data.phone, passwordHash: data.passwordHash, nickname: data.nickname, createdAt: new Date().toISOString() };
}

export function findParentByPhone(phone: string): Parent | undefined {
  const row = db.prepare(`SELECT * FROM parents WHERE phone = ?`).get(phone) as any;
  if (!row) return undefined;
  return { id: row.id, phone: row.phone, passwordHash: row.password_hash, nickname: row.nickname, createdAt: row.created_at };
}

// ============ 孩子 ============

export function createChild(data: { parentId: string; nickname: string; birthDate: string; gender?: string }): Child {
  const id = randomUUID();
  db.prepare(`INSERT INTO children (id, parent_id, nickname, birth_date, gender) VALUES (?, ?, ?, ?, ?)`)
    .run(id, data.parentId, data.nickname, data.birthDate, data.gender || null);

  // 初始化 4C 基线
  const dims = ['creativity', 'critical_thinking', 'communication', 'collaboration'];
  const insertBaseline = db.prepare(`INSERT INTO child_baselines (child_id, dimension) VALUES (?, ?)`);
  for (const dim of dims) insertBaseline.run(id, dim);

  return { id, parentId: data.parentId, nickname: data.nickname, birthDate: data.birthDate, gender: data.gender, createdAt: new Date().toISOString() };
}

export function getChildrenByParent(parentId: string): Child[] {
  const rows = db.prepare(`SELECT * FROM children WHERE parent_id = ?`).all(parentId) as any[];
  return rows.map((r) => ({ id: r.id, parentId: r.parent_id, nickname: r.nickname, birthDate: r.birth_date, gender: r.gender, avatarUrl: r.avatar_url, createdAt: r.created_at }));
}

export function getChild(id: string): Child | undefined {
  const row = db.prepare(`SELECT * FROM children WHERE id = ?`).get(id) as any;
  if (!row) return undefined;
  return { id: row.id, parentId: row.parent_id, nickname: row.nickname, birthDate: row.birth_date, gender: row.gender, avatarUrl: row.avatar_url, createdAt: row.created_at };
}

// ============ Session ============

export function createSession(childId: string, difficultyLevel = 1): Session {
  const id = randomUUID();
  db.prepare(`INSERT INTO sessions (id, child_id, difficulty_level) VALUES (?, ?, ?)`)
    .run(id, childId, difficultyLevel);
  return { id, childId, startedAt: new Date().toISOString(), turnCount: 0, difficultyLevel };
}

export function getSession(id: string): Session | undefined {
  const row = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id, childId: row.child_id, startedAt: row.started_at, endedAt: row.ended_at,
    durationSec: row.duration_sec, turnCount: row.turn_count, scenarioType: row.scenario_type,
    difficultyLevel: row.difficulty_level, summary: row.summary,
    emotionArc: row.emotion_arc ? JSON.parse(row.emotion_arc) : undefined,
  };
}

export function endSession(id: string, summary?: string, emotionArc?: string[]) {
  const session = getSession(id);
  if (!session) return;
  const durationSec = Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000);
  db.prepare(`UPDATE sessions SET ended_at = datetime('now'), duration_sec = ?, summary = ?, emotion_arc = ? WHERE id = ?`)
    .run(durationSec, summary || null, emotionArc ? JSON.stringify(emotionArc) : null, id);
}

export function getSessionsByChild(childId: string): Session[] {
  const rows = db.prepare(`SELECT * FROM sessions WHERE child_id = ? ORDER BY started_at DESC`).all(childId) as any[];
  return rows.map((r) => ({
    id: r.id, childId: r.child_id, startedAt: r.started_at, endedAt: r.ended_at,
    durationSec: r.duration_sec, turnCount: r.turn_count, scenarioType: r.scenario_type,
    difficultyLevel: r.difficulty_level, summary: r.summary,
  }));
}

// ============ Turn ============

const addTurnStmt = db.prepare(`
  INSERT INTO turns (id, session_id, turn_number, role, text, assessment_tag)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const updateTurnCountStmt = db.prepare(`UPDATE sessions SET turn_count = ? WHERE id = ?`);

export function addTurn(sessionId: string, role: 'child' | 'uli', text: string, assessmentTag?: string): Turn {
  const existing = db.prepare(`SELECT COUNT(*) as count FROM turns WHERE session_id = ?`).get(sessionId) as any;
  const turnNumber = (existing?.count || 0) + 1;
  const id = randomUUID();
  addTurnStmt.run(id, sessionId, turnNumber, role, text, assessmentTag || null);
  updateTurnCountStmt.run(turnNumber, sessionId);
  return { id, sessionId, turnNumber, role, text, assessmentTag, createdAt: new Date().toISOString() };
}

export function getTurnsBySession(sessionId: string): Turn[] {
  const rows = db.prepare(`SELECT * FROM turns WHERE session_id = ? ORDER BY turn_number`).all(sessionId) as any[];
  return rows.map((r) => ({ id: r.id, sessionId: r.session_id, turnNumber: r.turn_number, role: r.role, text: r.text, emotionTag: r.emotion_tag, assessmentTag: r.assessment_tag, createdAt: r.created_at }));
}

// ============ 评分 ============

export function saveSessionScore(
  sessionId: string,
  childId: string,
  scoreData: { creativity: number; criticalThinking: number; communication: number; collaboration: number; overall: number; sampleCount: number; confidence: number },
): SessionScore {
  const id = randomUUID();
  db.prepare(`INSERT INTO session_scores (id, session_id, child_id, creativity, critical_thinking, communication, collaboration, overall, sample_count, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, sessionId, childId, scoreData.creativity, scoreData.criticalThinking, scoreData.communication, scoreData.collaboration, scoreData.overall, scoreData.sampleCount, scoreData.confidence);

  // 更新基线
  updateBaselines(childId, scoreData);

  return { id, sessionId, childId, ...scoreData, createdAt: new Date().toISOString() };
}

export function getScoresByChild(childId: string): SessionScore[] {
  const rows = db.prepare(`SELECT * FROM session_scores WHERE child_id = ? ORDER BY created_at`).all(childId) as any[];
  return rows.map((r) => ({
    id: r.id, sessionId: r.session_id, childId: r.child_id,
    creativity: r.creativity, criticalThinking: r.critical_thinking,
    communication: r.communication, collaboration: r.collaboration,
    overall: r.overall, sampleCount: r.sample_count, confidence: r.confidence, createdAt: r.created_at,
  }));
}

// ============ 基线 ============

export function getBaselines(childId: string): ChildBaseline[] {
  const rows = db.prepare(`SELECT * FROM child_baselines WHERE child_id = ?`).all(childId) as any[];
  return rows.map((r) => ({
    childId: r.child_id, dimension: r.dimension, currentScore: r.current_score,
    difficultyLevel: r.difficulty_level, trend: r.trend, sessionCount: r.session_count, updatedAt: r.updated_at,
  }));
}

export function getBaseline(childId: string, dimension: string): ChildBaseline | undefined {
  const row = db.prepare(`SELECT * FROM child_baselines WHERE child_id = ? AND dimension = ?`).get(childId, dimension) as any;
  if (!row) return undefined;
  return { childId: row.child_id, dimension: row.dimension, currentScore: row.current_score, difficultyLevel: row.difficulty_level, trend: row.trend, sessionCount: row.session_count, updatedAt: row.updated_at };
}

function updateBaselines(
  childId: string,
  scoreData: { creativity: number; criticalThinking: number; communication: number; collaboration: number },
) {
  const mapping: Record<string, number> = {
    creativity: scoreData.creativity,
    critical_thinking: scoreData.criticalThinking,
    communication: scoreData.communication,
    collaboration: scoreData.collaboration,
  };

  const updateStmt = db.prepare(`
    UPDATE child_baselines SET current_score = ?, difficulty_level = ?, trend = ?, session_count = session_count + 1, updated_at = datetime('now')
    WHERE child_id = ? AND dimension = ?
  `);

  for (const [dim, newScore] of Object.entries(mapping)) {
    const baseline = getBaseline(childId, dim);
    if (!baseline) continue;

    const oldScore = baseline.currentScore;
    const smoothed = Math.round(oldScore * 0.7 + newScore * 0.3);
    let trend: string = 'stable';
    if (smoothed > oldScore + 2) trend = 'rising';
    else if (smoothed < oldScore - 2) trend = 'declining';

    let diffLevel = baseline.difficultyLevel;
    if (smoothed > 70 && diffLevel < 4) diffLevel += 1;
    else if (smoothed < 30 && diffLevel > 1) diffLevel -= 1;

    updateStmt.run(smoothed, diffLevel, trend, childId, dim);
  }
}

// ============ 记忆 ============

export function saveMemory(
  childId: string,
  category: ChildMemory['category'],
  key: string,
  value: string,
): ChildMemory {
  const existing = db.prepare(`SELECT * FROM child_memories WHERE child_id = ? AND key = ?`).get(childId, key) as any;

  if (existing) {
    db.prepare(`
      UPDATE child_memories SET value = ?, mention_count = mention_count + 1, last_mentioned = datetime('now'),
        updated_at = datetime('now'), confidence = MIN(1, confidence + 0.1)
      WHERE id = ?
    `).run(value, existing.id);
    return { ...existing, value, mentionCount: existing.mention_count + 1 };
  }

  const id = randomUUID();
  db.prepare(`INSERT INTO child_memories (id, child_id, category, key, value) VALUES (?, ?, ?, ?, ?)`)
    .run(id, childId, category, key, value);
  return { id, childId, category, key, value, source: 'extracted', confidence: 0.5, mentionCount: 1, lastMentioned: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export function getMemories(childId: string): ChildMemory[] {
  const rows = db.prepare(`SELECT * FROM child_memories WHERE child_id = ? ORDER BY mention_count DESC, updated_at DESC`).all(childId) as any[];
  return rows.map((r) => ({
    id: r.id, childId: r.child_id, category: r.category, key: r.key, value: r.value,
    source: r.source, confidence: r.confidence, mentionCount: r.mention_count,
    lastMentioned: r.last_mentioned, createdAt: r.created_at, updatedAt: r.updated_at,
  }));
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
  return { id, childId, dimension, eventType, description, triggeredAt: new Date().toISOString() };
}

export function getMilestones(childId: string): Milestone[] {
  const rows = db.prepare(`SELECT * FROM milestones WHERE child_id = ? ORDER BY triggered_at DESC`).all(childId) as any[];
  return rows.map((r) => ({ id: r.id, childId: r.child_id, dimension: r.dimension, eventType: r.event_type, description: r.description, triggeredAt: r.triggered_at }));
}

// ============ 统计 ============

export function getRadarData(childId: string) {
  const bls = getBaselines(childId);
  return {
    creativity: bls.find((b) => b.dimension === 'creativity')?.currentScore || 50,
    criticalThinking: bls.find((b) => b.dimension === 'critical_thinking')?.currentScore || 50,
    communication: bls.find((b) => b.dimension === 'communication')?.currentScore || 50,
    collaboration: bls.find((b) => b.dimension === 'collaboration')?.currentScore || 50,
  };
}

export function getTrendData(childId: string) {
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
    parent = createParent({ phone: '13800000000', passwordHash: '$2a$10$demo', nickname: '演示家长' });
    const child = createChild({ parentId: parent.id, nickname: '小宇', birthDate: '2020-06-15', gender: 'male' });
    console.log(`[store] 创建演示数据: parent=${parent.id} child=${child.id} (${child.nickname})`);
    return { parent, child };
  }

  const children = getChildrenByParent(parent.id);
  const child = children[0];
  console.log(`[store] 已有演示数据: parent=${parent.id} child=${child.id} (${child.nickname}) | sessions=${getSessionsByChild(child.id).length} memories=${getMemories(child.id).length}`);
  return { parent, child };
}
