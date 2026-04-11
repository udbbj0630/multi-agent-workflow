import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// OpenRouter 兼容 OpenAI SDK，只需改 baseURL 和 key
const client = new OpenAI({
  apiKey: process.env.LLM_API_KEY || 'sk-placeholder',
  baseURL: process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://uli.app',
    'X-Title': 'Uli App',
  },
});

const MODEL = process.env.LLM_MODEL || 'deepseek/deepseek-chat-v3-0324';

// 加载呜哩人格 prompt
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

/**
 * 构建完整的 system prompt
 */
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

/**
 * 发送对话请求，流式返回
 */
export async function* chatStream(
  messages: ChatMessage[],
  options: LLMOptions = {},
) {
  const systemMessage: ChatMessage = {
    role: 'system',
    content: buildSystemPrompt(options),
  };

  const stream = await client.chat.completions.create({
    model: MODEL,
    messages: [systemMessage, ...messages],
    stream: true,
    temperature: 0.8,
    max_tokens: 300, // 呜哩说话简短
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
    // 尝试从返回文本中提取 JSON
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    console.warn('[llm] failed to parse memories:', text);
    return [];
  }
}

export { client, MODEL };
