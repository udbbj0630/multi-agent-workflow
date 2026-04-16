import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new OpenAI({
  apiKey: config.LLM_API_KEY,
  baseURL: config.LLM_BASE_URL,
  defaultHeaders: {
    'HTTP-Referer': 'https://uli.app',
    'X-Title': 'Uli App',
  },
});

const MODEL = config.LLM_MODEL;

let personalityPrompt = '';
try {
  personalityPrompt = fs.readFileSync(
    path.join(__dirname, '../prompts/personality.md'),
    'utf-8',
  );
} catch {
  console.warn('[llm] personality.md not found, using empty personality');
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  childAge?: number;
  childName?: string;
  memoryContext?: string;
  assessmentHint?: string;
  knowledgeBoundary?: string;
}

export interface AssessmentDimensionResult {
  score: number;
  evidence: string;
}

export interface AssessmentResult {
  creativity: AssessmentDimensionResult;
  criticalThinking: AssessmentDimensionResult;
  communication: AssessmentDimensionResult;
  collaboration: AssessmentDimensionResult;
}

function buildSystemPrompt(options: LLMOptions = {}): string {
  let prompt = personalityPrompt;

  if (options.childAge) {
    prompt += `\n\n你现在在和 ${options.childAge} 岁的地球小朋友聊天。请用适合这个年龄的语言。`;
  }

  if (options.childName) {
    prompt += `\n\n这个小朋友叫${options.childName}。`;
  }

  if (options.memoryContext) {
    prompt += `\n\n## 你记得关于这个小朋友的事\n${options.memoryContext}`;
  }

  if (options.assessmentHint) {
    prompt += `\n\n## 当前对话策略\n${options.assessmentHint}`;
  }

  if (options.knowledgeBoundary) {
    prompt += `\n\n## 知识边界\n${options.knowledgeBoundary}`;
  }

  return prompt;
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 50;
  return Math.max(30, Math.min(100, Math.round(score)));
}

function sanitizeEvidence(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 120);
}

function parseJsonObject<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

function normalizeAssessmentResult(raw: unknown): AssessmentResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, any>;

  const creativity = data.creativity;
  const criticalThinking = data.criticalThinking;
  const communication = data.communication;
  const collaboration = data.collaboration;

  if (!creativity || !criticalThinking || !communication || !collaboration) {
    return null;
  }

  return {
    creativity: {
      score: clampScore(Number(creativity.score)),
      evidence: sanitizeEvidence(creativity.evidence),
    },
    criticalThinking: {
      score: clampScore(Number(criticalThinking.score)),
      evidence: sanitizeEvidence(criticalThinking.evidence),
    },
    communication: {
      score: clampScore(Number(communication.score)),
      evidence: sanitizeEvidence(communication.evidence),
    },
    collaboration: {
      score: clampScore(Number(collaboration.score)),
      evidence: sanitizeEvidence(collaboration.evidence),
    },
  };
}

/**
 * 发送对话请求，流式返回
 */
export async function* chatStream(
  messages: ChatMessage[],
  options: LLMOptions = {},
): AsyncGenerator<string> {
  const systemMessage: ChatMessage = {
    role: 'system',
    content: buildSystemPrompt(options),
  };

  const stream = await client.chat.completions.create({
    model: MODEL,
    messages: [systemMessage, ...messages],
    stream: true,
    temperature: 0.8,
    max_tokens: 300,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

/**
 * 发送对话请求，完整返回
 */
export async function chat(
  messages: ChatMessage[],
  options: LLMOptions = {},
): Promise<string> {
  const systemMessage: ChatMessage = {
    role: 'system',
    content: buildSystemPrompt(options),
  };

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [systemMessage, ...messages],
    temperature: 0.8,
    max_tokens: 300,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * 生成 session 摘要（用于记忆系统）
 */
export async function generateSummary(
  turns: Array<{ role: string; text: string }>,
): Promise<string> {
  const prompt = `请用一段话总结以下对话内容，包括讨论的话题、小朋友的兴趣点和情绪状态。用第三人称，50字以内。

对话记录：
${turns.map((t) => `${t.role === 'child' ? '小朋友' : '呜哩'}：${t.text}`).join('\n')}

摘要：`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 100,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * 从对话中提取记忆（用于记忆系统）
 */
export async function extractMemories(
  turns: Array<{ role: string; text: string }>,
  existingMemories: string[],
): Promise<Array<{ category: string; key: string; value: string }>> {
  const prompt = `从以下对话中提取关于小朋友的重要信息。
已有的记忆（不需要重复提取）：
${existingMemories.length > 0 ? existingMemories.join('；') : '暂无'}

对话记录：
${turns.map((t) => `${t.role === 'child' ? '小朋友' : '呜哩'}：${t.text}`).join('\n')}

请提取新的信息，每条包含 category（interest/relation/event/emotion/preference）、key（关键词）、value（详细描述）。
以 JSON 数组格式返回，如果没有新信息返回空数组 []。只返回 JSON，不要其他文字。`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 500,
  });

  const text = response.choices[0]?.message?.content || '[]';
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    console.warn('[llm] failed to parse memories:', text);
    return [];
  }
}

export async function assessConversation(
  childTexts: string[],
  childAge: number,
): Promise<AssessmentResult> {
  const prompt = `你是一名儿童早期对话发展评估助手。请根据一位 ${childAge} 岁孩子在对话中的原话，评估以下4个维度：

1. creativity：发散思维、想象力、故事化表达
2. criticalThinking：因果推理、比较、解释、提问
3. communication：表达完整度、情绪表达、描述清晰度
4. collaboration：共情、轮流互动、参与感、合作意愿

评分要求：
- 每个维度输出 score，整数，范围 30-100
- 每个维度输出 evidence，必须是孩子原话中的简短引用或高度贴近的片段
- 如果证据不足，也要给出保守分数，并在 evidence 中说明“证据有限”
- 不要诊断，不要使用医学或病理化语言
- 只基于提供的文本，不要臆测家庭背景

请严格返回 JSON 对象，格式如下：
{
  "creativity": { "score": 55, "evidence": "..." },
  "criticalThinking": { "score": 52, "evidence": "..." },
  "communication": { "score": 60, "evidence": "..." },
  "collaboration": { "score": 50, "evidence": "..." }
}

孩子原话：
${childTexts.map((text, index) => `${index + 1}. ${text}`).join('\n') || '（没有内容）'}
`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const text = response.choices[0]?.message?.content || '{}';
  const parsed = parseJsonObject<unknown>(text);
  const normalized = normalizeAssessmentResult(parsed);

  if (!normalized) {
    throw new Error('[llm] Failed to parse assessment response');
  }

  return normalized;
}

export async function generateNarrative(
  childName: string,
  recentMemories: Array<{ category: string; value: string }>,
  currentScores: {
    creativity: number;
    criticalThinking: number;
    communication: number;
    collaboration: number;
  },
  weeklyTrend: Array<{
    date: string;
    creativity: number;
    criticalThinking: number;
    communication: number;
    collaboration: number;
  }>,
): Promise<string> {
  const memoriesText = recentMemories.length > 0
    ? recentMemories.map((memory) => `- ${memory.category}: ${memory.value}`).join('\n')
    : '暂无明显记忆线索';

  const trendText = weeklyTrend.length > 0
    ? weeklyTrend.map((item) =>
      `${item.date}: 创造力${item.creativity}，批判性思维${item.criticalThinking}，沟通力${item.communication}，协作力${item.collaboration}`)
      .join('\n')
    : '本周暂无趋势数据';

  const prompt = `请为家长写一封关于孩子“${childName}”的每周成长小信。

写作要求：
- 2到3段
- 语气温暖、具体、真诚，像一位细心的老师或陪伴者写给家长
- 要提到孩子最近表现出的兴趣、表达方式、互动习惯或成长变化
- 可以温柔地指出正在发展的方向，但不要像成绩单，不要列表，不要机械复述数据
- 不要说“根据数据”或“评分显示”
- 适合儿童陪伴产品场景，避免夸大、避免诊断

孩子最近的兴趣与记忆：
${memoriesText}

当前能力参考：
- 创造力：${currentScores.creativity}
- 批判性思维：${currentScores.criticalThinking}
- 沟通力：${currentScores.communication}
- 协作力：${currentScores.collaboration}

近7天趋势参考：
${trendText}

请直接输出正文，不要标题，不要落款。`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 500,
  });

  return (response.choices[0]?.message?.content || '').trim();
}

export function generateGuidance(
  scores: {
    creativity: number;
    criticalThinking: number;
    communication: number;
    collaboration: number;
  },
  memories: Array<{ category: string; value: string }>,
): string {
  const dimensions = [
    { key: 'creativity', label: '创造力', score: scores.creativity },
    { key: 'criticalThinking', label: '批判性思维', score: scores.criticalThinking },
    { key: 'communication', label: '沟通力', score: scores.communication },
    { key: 'collaboration', label: '协作力', score: scores.collaboration },
  ] as const;

  const weakest = [...dimensions].sort((a, b) => a.score - b.score)[0];
  const interests = memories
    .filter((memory) => memory.category === 'interest' || memory.category === 'preference')
    .slice(0, 3)
    .map((memory) => memory.value);

  const interestText = interests.length > 0
    ? `可优先围绕孩子喜欢的${interests.join('、')}展开。`
    : '可优先围绕孩子熟悉的日常、玩具、朋友或经历展开。';

  const strategyMap: Record<typeof weakest.key, string> = {
    creativity: '多用“如果……会怎样”“我们还可以怎么想”这类开放式想象提问，鼓励编故事和替代方案。',
    criticalThinking: '多问原因、比较和预测，例如“为什么会这样”“哪个更像”“接下来可能发生什么”。',
    communication: '多鼓励孩子说完整一点，追问感受、细节和顺序，例如“后来呢”“你当时感觉怎么样”。',
    collaboration: '多设计一起完成的小任务或角色互助场景，鼓励孩子回应、安慰、邀请和轮流表达。',
  };

  return `当前可轻轻加强${weakest.label}。${strategyMap[weakest.key]}${interestText}`;
}

export { client, MODEL };