/**
 * 数据存储层 — MVP 用内存存储，部署时切换为 PG + Redis
 *
 * 所有数据操作都走这个模块，换数据库只改这一个文件
 */

import { randomUUID } from 'crypto';

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

// ============ 内存存储 ============

const parents = new Map<string, Parent>();
const children = new Map<string, Child>();
const sessions = new Map<string, Session>();
const turns = new Map<string, Turn[]>();
const scores = new Map<string, SessionScore[]>();
const baselines = new Map<string, ChildBaseline>();
const memories = new Map<string, ChildMemory[]>();
const milestones = new Map<string, Milestone[]>();

// ============ 工具函数 ============

const now = () => new Date().toISOString();

function getBaselineKey(childId: string, dimension: string) {
  return `${childId}:${dimension}`;
}

// ============ 家长 ============

export function createParent(data: Omit<Parent, 'id' | 'createdAt'>): Parent {
  const parent: Parent = { id: randomUUID(), ...data, createdAt: now() };
  parents.set(parent.id, parent);
  return parent;
}

export function findParentByPhone(phone: string): Parent | undefined {
  for (const p of parents.values()) {
    if (p.phone === phone) return p;
  }
  return undefined;
}

// ============ 孩子 ============

export function createChild(data: Omit<Child, 'id' | 'createdAt'>): Child {
  const child: Child = { id: randomUUID(), ...data, createdAt: now() };
  children.set(child.id, child);

  // 初始化 4C 基线
  const dimensions = ['creativity', 'critical_thinking', 'communication', 'collaboration'];
  for (const dim of dimensions) {
    const key = getBaselineKey(child.id, dim);
    baselines.set(key, {
      childId: child.id,
      dimension: dim,
      currentScore: 50,
      difficultyLevel: 1,
      trend: 'stable',
      sessionCount: 0,
      updatedAt: now(),
    });
  }

  return child;
}

export function getChildrenByParent(parentId: string): Child[] {
  return [...children.values()].filter((c) => c.parentId === parentId);
}

export function getChild(id: string): Child | undefined {
  return children.get(id);
}

// ============ Session ============

export function createSession(childId: string, difficultyLevel = 1): Session {
  const session: Session = {
    id: randomUUID(),
    childId,
    startedAt: now(),
    turnCount: 0,
    difficultyLevel,
  };
  sessions.set(session.id, session);
  turns.set(session.id, []);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function endSession(id: string, summary?: string, emotionArc?: string[]) {
  const session = sessions.get(id);
  if (!session) return;
  session.endedAt = now();
  session.durationSec = Math.round(
    (Date.now() - new Date(session.startedAt).getTime()) / 1000,
  );
  if (summary) session.summary = summary;
  if (emotionArc) session.emotionArc = emotionArc;
}

export function getSessionsByChild(childId: string): Session[] {
  return [...sessions.values()]
    .filter((s) => s.childId === childId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

// ============ Turn ============

export function addTurn(sessionId: string, role: 'child' | 'uli', text: string, assessmentTag?: string): Turn {
  const sessionTurns = turns.get(sessionId) || [];
  const turn: Turn = {
    id: randomUUID(),
    sessionId,
    turnNumber: sessionTurns.length + 1,
    role,
    text,
    assessmentTag,
    createdAt: now(),
  };
  sessionTurns.push(turn);

  // 更新 session 的 turnCount
  const session = sessions.get(sessionId);
  if (session) session.turnCount = sessionTurns.length;

  return turn;
}

export function getTurnsBySession(sessionId: string): Turn[] {
  return turns.get(sessionId) || [];
}

// ============ 评分 ============

export function saveSessionScore(
  sessionId: string,
  childId: string,
  scoreData: {
    creativity: number; criticalThinking: number;
    communication: number; collaboration: number;
    overall: number; sampleCount: number; confidence: number;
  },
): SessionScore {
  const score: SessionScore = { id: randomUUID(), sessionId, childId, ...scoreData, createdAt: now() };
  if (!scores.has(childId)) scores.set(childId, []);
  scores.get(childId)!.push(score);

  // 更新基线
  updateBaselines(childId, scoreData);

  return score;
}

export function getScoresByChild(childId: string): SessionScore[] {
  return scores.get(childId) || [];
}

// ============ 基线 ============

export function getBaselines(childId: string): ChildBaseline[] {
  const dims = ['creativity', 'critical_thinking', 'communication', 'collaboration'];
  return dims.map((dim) => {
    const key = getBaselineKey(childId, dim);
    return baselines.get(key) || {
      childId, dimension: dim, currentScore: 50, difficultyLevel: 1,
      trend: 'stable' as const, sessionCount: 0, updatedAt: now(),
    };
  });
}

export function getBaseline(childId: string, dimension: string): ChildBaseline | undefined {
  return baselines.get(getBaselineKey(childId, dimension));
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

  for (const [dim, newScore] of Object.entries(mapping)) {
    const key = getBaselineKey(childId, dim);
    const baseline = baselines.get(key);
    if (!baseline) continue;

    const oldScore = baseline.currentScore;
    // 指数移动平均（EMA），权重 0.3 给新分数
    baseline.currentScore = Math.round(oldScore * 0.7 + newScore * 0.3);
    baseline.sessionCount += 1;
    baseline.updatedAt = now();

    // 趋势判断
    if (baseline.currentScore > oldScore + 2) baseline.trend = 'rising';
    else if (baseline.currentScore < oldScore - 2) baseline.trend = 'declining';
    else baseline.trend = 'stable';

    // 自适应难度
    if (baseline.currentScore > 70 && baseline.difficultyLevel < 4) {
      baseline.difficultyLevel += 1;
    } else if (baseline.currentScore < 30 && baseline.difficultyLevel > 1) {
      baseline.difficultyLevel -= 1;
    }
  }
}

// ============ 记忆 ============

export function saveMemory(
  childId: string,
  category: ChildMemory['category'],
  key: string,
  value: string,
): ChildMemory {
  const childMemories = memories.get(childId) || [];

  // 如果已有相同 key，更新
  const existing = childMemories.find((m) => m.key === key);
  if (existing) {
    existing.value = value;
    existing.mentionCount += 1;
    existing.lastMentioned = now();
    existing.updatedAt = now();
    existing.confidence = Math.min(1, existing.confidence + 0.1);
    return existing;
  }

  // 新建
  const memory: ChildMemory = {
    id: randomUUID(),
    childId,
    category,
    key,
    value,
    source: 'extracted',
    confidence: 0.5,
    mentionCount: 1,
    lastMentioned: now(),
    createdAt: now(),
    updatedAt: now(),
  };
  childMemories.push(memory);
  memories.set(childId, childMemories);
  return memory;
}

export function getMemories(childId: string): ChildMemory[] {
  return memories.get(childId) || [];
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
  if (!milestones.has(childId)) milestones.set(childId, []);
  const m: Milestone = { id: randomUUID(), childId, dimension, eventType, description, triggeredAt: now() };
  milestones.get(childId)!.push(m);
  return m;
}

export function getMilestones(childId: string): Milestone[] {
  return milestones.get(childId) || [];
}

// ============ 统计（家长端用） ============

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
  const childScores = getScoresByChild(childId);
  return childScores.map((s) => ({
    date: s.createdAt.slice(0, 10),
    creativity: s.creativity,
    criticalThinking: s.criticalThinking,
    communication: s.communication,
    collaboration: s.collaboration,
  }));
}
