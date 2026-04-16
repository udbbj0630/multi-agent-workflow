/**
 * 4C 测评引擎
 *
 * 默认使用 LLM 测评；
 * 如果 LLM 失败，则回退到基础关键词规则 + CHILDES 常模基准。
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { assessConversation, type AssessmentResult as LlmAssessmentResult } from './llm.js';
import {
  addMilestone,
  getBaseline,
  getBaselines,
  saveSessionScore,
  type ChildBaseline,
  type SessionScore,
} from './store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load CHILDES age norms
interface AgeNorms {
  _meta: { source: string; description: string };
  norms: Record<string, {
    mlu: number; ttr: number; question_ratio: number;
    causal_ratio: number; emotion_word_ratio: number;
    unique_words_per_utt: number; utterance_count: number;
  }>;
  scoring_guide: Record<string, {
    overall_mean: number; overall_std: number;
    by_age: Record<string, { mean: number; std: number }>;
  }>;
}

let normsData: AgeNorms | null = null;

function getNorms(): AgeNorms | null {
  if (!normsData) {
    try {
      const raw = readFileSync(join(__dirname, 'assessment_norms.json'), 'utf-8');
      normsData = JSON.parse(raw) as AgeNorms;
    } catch {
      console.warn('[assessment] assessment_norms.json not found, scoring without age norms');
    }
  }
  return normsData;
}

/**
 * Convert a raw metric value to a percentile using age norms.
 * Returns a score 0-100 where 50 = age average.
 */
function normScore(metricName: string, rawValue: number, childAge: number): number {
  const norms = getNorms();
  if (!norms) return 50; // no norms available

  const guide = norms.scoring_guide[metricName];
  if (!guide) return 50;

  const ageKey = childAge <= 3 ? 'age3' : childAge <= 4 ? 'age4' : childAge <= 5 ? 'age5' : childAge <= 6 ? 'age6' : 'age7';
  const ageNorm = guide.by_age[ageKey];
  if (!ageNorm || ageNorm.std === 0) return 50;

  // z-score: how many std devs above/below age mean
  const z = (rawValue - ageNorm.mean) / ageNorm.std;
  // Convert to 0-100 score (z=0 → 50, z=1 → 72, z=-1 → 28)
  const score = Math.round(50 + z * 22);
  return Math.max(0, Math.min(100, score));
}

type Dimension = 'creativity' | 'criticalThinking' | 'communication' | 'collaboration';

interface Signal {
  dimension: Dimension;
  weight: number;
  detected: boolean;
  description: string;
}

export interface AssessmentResult {
  creativity: number;
  criticalThinking: number;
  communication: number;
  collaboration: number;
  overall: number;
  sampleCount: number;
  confidence: number;
  detectedSignals: string[];
  evidence?: Partial<Record<Dimension, string>>;
}

function detectSignals(childText: string, allChildTexts: string[]): Signal[] {
  const signals: Signal[] = [];

  const divergentWords = ['想象', '如果', '假如', '要是', '可能', '说不定', '也许', '我觉得可以', '还可以', '另一个'];
  const hasDivergent = divergentWords.some((word) => childText.includes(word));
  signals.push({
    dimension: 'creativity',
    weight: 25,
    detected: hasDivergent,
    description: '使用发散性词汇',
  });

  const currentWords = new Set(childText.split(''));
  const prevWords = new Set(allChildTexts.flatMap((text) => text.split('')));
  const newWordRatio = allChildTexts.length > 0
    ? [...currentWords].filter((word) => !prevWords.has(word)).length / Math.max(currentWords.size, 1)
    : 0.5;
  signals.push({
    dimension: 'creativity',
    weight: 20,
    detected: newWordRatio > 0.3,
    description: '词汇多样性',
  });

  signals.push({
    dimension: 'creativity',
    weight: 15,
    detected: childText.length > 20,
    description: '回答丰富度',
  });

  const storyWords = ['然后', '后来', '有一天', '从前', '以前', '因为', '所以', '结果'];
  const hasStory = storyWords.some((word) => childText.includes(word));
  signals.push({
    dimension: 'creativity',
    weight: 15,
    detected: hasStory,
    description: '叙事能力',
  });

  const causalWords = ['因为', '所以', '原因是', '导致', '因此'];
  const hasCausal = causalWords.some((word) => childText.includes(word));
  signals.push({
    dimension: 'criticalThinking',
    weight: 30,
    detected: hasCausal,
    description: '因果推理',
  });

  const compareWords = ['但是', '不过', '相比', '一样', '不同', '更大', '更好'];
  const hasCompare = compareWords.some((word) => childText.includes(word));
  signals.push({
    dimension: 'criticalThinking',
    weight: 25,
    detected: hasCompare,
    description: '比较判断',
  });

  const questionWords = ['为什么', '怎么会', '真的吗', '不对吧', '可是', '不是'];
  const hasQuestion = questionWords.some((word) => childText.includes(word));
  signals.push({
    dimension: 'criticalThinking',
    weight: 25,
    detected: hasQuestion,
    description: '质疑追问',
  });

  const hasCompleteSentence = /[。！？.!?]/.test(childText) || childText.length > 10;
  signals.push({
    dimension: 'communication',
    weight: 25,
    detected: hasCompleteSentence,
    description: '表达完整度',
  });

  const emotionWords = ['开心', '高兴', '难过', '生气', '害怕', '喜欢', '讨厌', '惊讶', '感动', '紧张', '兴奋'];
  const hasEmotion = emotionWords.some((word) => childText.includes(word));
  signals.push({
    dimension: 'communication',
    weight: 25,
    detected: hasEmotion,
    description: '情绪表达',
  });

  const isNotSimple = childText.length > 5 && !/^(好|是|对|嗯|不行|不要|不知道)$/.test(childText.trim());
  signals.push({
    dimension: 'communication',
    weight: 20,
    detected: isNotSimple,
    description: '主动回应',
  });

  const descWords = ['很', '非常', '特别', '超级', '有点', '好像', '看起来', '感觉'];
  const hasDesc = descWords.some((word) => childText.includes(word));
  signals.push({
    dimension: 'communication',
    weight: 15,
    detected: hasDesc,
    description: '描述性表达',
  });

  const empathyWords = ['没关系', '没事', '一起', '帮你', '我们', '陪你', '理解'];
  const hasEmpathy = empathyWords.some((word) => childText.includes(word));
  signals.push({
    dimension: 'collaboration',
    weight: 30,
    detected: hasEmpathy,
    description: '共情表达',
  });

  const acceptWords = ['好的', '可以', '行', '好吧', '试试看', '那我们'];
  const hasAccept = acceptWords.some((word) => childText.includes(word));
  signals.push({
    dimension: 'collaboration',
    weight: 20,
    detected: hasAccept,
    description: '接受建议',
  });

  signals.push({
    dimension: 'collaboration',
    weight: 20,
    detected: allChildTexts.length >= 2,
    description: '积极参与',
  });

  return signals;
}

function calcScore(signals: Signal[]): number {
  if (signals.length === 0) return 50;
  const totalWeight = signals.reduce((sum, signal) => sum + signal.weight, 0);
  const detectedWeight = signals
    .filter((signal) => signal.detected)
    .reduce((sum, signal) => sum + signal.weight, 0);

  return Math.round(30 + (detectedWeight / totalWeight) * 70);
}

function fallbackAssessSession(childTurns: string[], childAge?: number): AssessmentResult {
  if (childTurns.length === 0) {
    return {
      creativity: 50,
      criticalThinking: 50,
      communication: 50,
      collaboration: 50,
      overall: 50,
      sampleCount: 0,
      confidence: 0,
      detectedSignals: [],
      evidence: {},
    };
  }

  const allSignals: Signal[] = [];
  for (let index = 0; index < childTurns.length; index += 1) {
    const prevTurns = childTurns.slice(0, index);
    allSignals.push(...detectSignals(childTurns[index], prevTurns));
  }

  const creativitySignals = allSignals.filter((signal) => signal.dimension === 'creativity');
  const criticalThinkingSignals = allSignals.filter((signal) => signal.dimension === 'criticalThinking');
  const communicationSignals = allSignals.filter((signal) => signal.dimension === 'communication');
  const collaborationSignals = allSignals.filter((signal) => signal.dimension === 'collaboration');

  // Keyword-based base scores (30-100 range)
  const baseCreativity = calcScore(creativitySignals);
  const baseCritical = calcScore(criticalThinkingSignals);
  const baseCommunication = calcScore(communicationSignals);
  const baseCollaboration = calcScore(collaborationSignals);

  let creativity = baseCreativity;
  let criticalThinking = baseCritical;
  let communication = baseCommunication;
  let collaboration = baseCollaboration;

  // If age norms are available, blend with norm-referenced metrics
  if (childAge) {
    const age = childAge;
    // Compute MLU from actual child turns
    const totalChars = childTurns.reduce((sum, t) => {
      const chars = [...t].filter(c => '\u4e00' <= c && c <= '\u9fff').length;
      return sum + chars;
    }, 0);
    const avgMlu = totalChars / childTurns.length;

    // Compute TTR
    const allTokens = childTurns.flatMap(t => {
      const tokens = t.trim().split(/\s+/);
      return tokens.map(tok => tok.replace(/[^\u4e00-\u9fff]/g, '')).filter(Boolean);
    });
    const ttr = allTokens.length > 0 ? new Set(allTokens).size / allTokens.length : 0;

    // Compute question ratio
    const questionWords = ['为什么', '怎么', '什么', '哪里', '谁', '多少', '吗', '呢'];
    const questionCount = childTurns.filter(t =>
      /[?？]/.test(t) || questionWords.some(qw => t.includes(qw))
    ).length;
    const questionRatio = questionCount / childTurns.length;

    // Compute causal ratio
    const causalWords = ['因为', '所以', '如果', '那么', '但是', '可是'];
    const causalCount = childTurns.filter(t => causalWords.some(cw => t.includes(cw))).length;
    const causalRatio = causalCount / childTurns.length;

    // Compute emotion word ratio
    const emotionWords = ['开心', '高兴', '难过', '生气', '害怕', '喜欢', '讨厌', '惊讶', '紧张', '兴奋'];
    const emotionCount = childTurns.filter(t => emotionWords.some(ew => t.includes(ew))).length;
    const emotionRatio = emotionCount / childTurns.length;

    // Get norm-referenced scores for each dimension
    // Communication: MLU is the strongest signal
    const normComm = normScore('mlu', avgMlu, age);
    // Critical thinking: causal ratio + question ratio
    const normCausal = normScore('causal_ratio', causalRatio, age);
    const normQuestion = normScore('question_ratio', questionRatio, age);
    const normCritical = Math.round((normCausal + normQuestion) / 2);
    // Creativity: TTR
    const normCreativity = normScore('ttr', ttr, age);

    // Blend: 60% keyword-based + 40% norm-referenced
    creativity = Math.round(baseCreativity * 0.6 + normCreativity * 0.4);
    criticalThinking = Math.round(baseCritical * 0.6 + normCritical * 0.4);
    communication = Math.round(baseCommunication * 0.6 + normComm * 0.4);
    // Collaboration has no strong norm metric, keep keyword-based
    collaboration = baseCollaboration;
  }

  const overall = Math.round((creativity + criticalThinking + communication + collaboration) / 4);
  const detectedSignals = allSignals.filter((signal) => signal.detected).map((signal) => signal.description);

  return {
    creativity,
    criticalThinking,
    communication,
    collaboration,
    overall,
    sampleCount: childTurns.length,
    confidence: Math.min(0.75, childTurns.length / 12),
    detectedSignals,
    evidence: {},
  };
}

function fromLlmResult(result: LlmAssessmentResult, sampleCount: number): AssessmentResult {
  const creativity = result.creativity.score;
  const criticalThinking = result.criticalThinking.score;
  const communication = result.communication.score;
  const collaboration = result.collaboration.score;

  return {
    creativity,
    criticalThinking,
    communication,
    collaboration,
    overall: Math.round((creativity + criticalThinking + communication + collaboration) / 4),
    sampleCount,
    confidence: Math.min(1, 0.45 + sampleCount * 0.08),
    detectedSignals: ['llm_assessment'],
    evidence: {
      creativity: result.creativity.evidence,
      criticalThinking: result.criticalThinking.evidence,
      communication: result.communication.evidence,
      collaboration: result.collaboration.evidence,
    },
  };
}

export async function assessSession(
  childTexts: string[],
  childAge: number,
  childId?: string,
): Promise<AssessmentResult> {
  let result: AssessmentResult;

  try {
    const llmResult = await assessConversation(childTexts, childAge);
    result = fromLlmResult(llmResult, childTexts.length);
  } catch (error) {
    console.warn('[assessment] llm assessment failed, using fallback:', error);
    result = fallbackAssessSession(childTexts, childAge);
  }

  if (childId) {
    try {
      const baselinesBefore = getBaselines(childId);
      updateBaselines(childId, result);
      checkMilestones(childId, baselinesBefore);
    } catch (error) {
      console.warn('[assessment] failed to update baselines or milestones:', error);
    }
  }

  return result;
}

/**
 * KEEP: EMA smoothing baseline update logic.
 * This implementation mirrors the existing baseline update behavior by persisting a synthetic session score row.
 */
export function updateBaselines(
  childId: string,
  assessment: Pick<AssessmentResult, 'creativity' | 'criticalThinking' | 'communication' | 'collaboration' | 'overall' | 'sampleCount' | 'confidence'>,
): SessionScore {
  const syntheticSessionId = `assessment-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return saveSessionScore(syntheticSessionId, childId, {
    creativity: assessment.creativity,
    criticalThinking: assessment.criticalThinking,
    communication: assessment.communication,
    collaboration: assessment.collaboration,
    overall: assessment.overall,
    sampleCount: assessment.sampleCount,
    confidence: assessment.confidence,
  });
}

/**
 * KEEP: milestone checks.
 */
export function checkMilestones(
  childId: string,
  baselines: ChildBaseline[] = getBaselines(childId),
): void {
  const dimNames: Record<string, string> = {
    creativity: '创造力',
    critical_thinking: '批判性思维',
    communication: '沟通力',
    collaboration: '协作力',
  };

  for (const baseline of baselines) {
    const latest = getBaseline(childId, baseline.dimension) || baseline;

    if (latest.currentScore >= 80 && latest.sessionCount <= 1) {
      addMilestone(
        childId,
        latest.dimension,
        'first_80',
        `${dimNames[latest.dimension] || latest.dimension}首次突破80分！`,
      );
    }

    if (latest.trend === 'rising' && latest.sessionCount >= 3) {
      addMilestone(
        childId,
        latest.dimension,
        'trend_rising',
        `${dimNames[latest.dimension] || latest.dimension}持续上升中！`,
      );
    }
  }
}

/**
 * 决定下一轮对话应该探测哪个维度（选最缺数据的）
 */
export function pickAssessmentDimension(baselines: Array<{ dimension: string; sessionCount: number }>): string {
  const dims = [
    { dimension: 'creativity', label: '创造力' },
    { dimension: 'critical_thinking', label: '批判性思维' },
    { dimension: 'communication', label: '沟通力' },
    { dimension: 'collaboration', label: '协作力' },
  ];

  const sorted = [...dims].sort((a, b) => {
    const aCount = baselines.find((baseline) => baseline.dimension === a.dimension)?.sessionCount || 0;
    const bCount = baselines.find((baseline) => baseline.dimension === b.dimension)?.sessionCount || 0;
    return aCount - bCount;
  });

  return sorted[0].label;
}