import {
  getChild,
  getMemories,
  getRadarData,
  getScoresByChild,
} from './store.js';
import { generateNarrative } from './llm.js';

interface NarrativeCacheEntry {
  content: string;
  generatedAt: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
const cache = new Map<string, NarrativeCacheEntry>();

export async function generateWeeklyNarrative(childId: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(childId);

  if (cached && now - cached.generatedAt < ONE_DAY_MS) {
    return cached.content;
  }

  const child = getChild(childId);
  if (!child) {
    throw new Error(`Child not found: ${childId}`);
  }

  const cutoff = now - SEVEN_DAYS_MS;
  const recentMemories = getMemories(childId)
    .filter((memory) => new Date(memory.updatedAt).getTime() >= cutoff)
    .slice(0, 8)
    .map((memory) => ({
      category: memory.category,
      value: memory.value,
    }));

  const currentScores = getRadarData(childId);

  const weeklyTrend = getScoresByChild(childId)
    .filter((score) => new Date(score.createdAt).getTime() >= cutoff)
    .slice(-7)
    .map((score) => ({
      date: score.createdAt.slice(0, 10),
      creativity: score.creativity,
      criticalThinking: score.criticalThinking,
      communication: score.communication,
      collaboration: score.collaboration,
    }));

  const content = await generateNarrative(
    child.nickname,
    recentMemories,
    currentScores,
    weeklyTrend,
  );

  cache.set(childId, {
    content,
    generatedAt: now,
  });

  return content;
}