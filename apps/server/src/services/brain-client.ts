/**
 * Brain Client — HTTP client for calling the Brain service.
 *
 * Provides callBrain() for direct calls and callBrainWithFallback()
 * for graceful degradation when Brain is unavailable.
 */

import { config } from '../config.js';

interface ChatRequest {
  childText: string;
  childAge: number;
  childName: string;
  childId: string;
  sessionHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  memoryContext?: string;
  assessmentScores?: {
    creativity: number;
    criticalThinking: number;
    communication: number;
    collaboration: number;
  };
}

interface ChatResponse {
  reply: string;
  detectedTopics: string[];
  vocabularyLevel: number;
  emotionalState: string;
  assessmentSignals: string[];
  metadata: {
    safetyPassed: boolean;
    readabilityScore: number;
    rewriteCount: number;
    latencyMs: number;
  };
}

const BRAIN_URL = config.BRAIN_URL;
const BRAIN_TIMEOUT = config.BRAIN_TIMEOUT;

/**
 * Call the Brain service's /api/chat endpoint.
 */
export async function callBrain(request: ChatRequest): Promise<ChatResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    BRAIN_TIMEOUT,
  );

  try {
    const response = await fetch(`${BRAIN_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown error');
      throw new Error(`Brain returned ${response.status}: ${errorBody}`);
    }

    return (await response.json()) as ChatResponse;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Call Brain with a fallback function.
 * If Brain is unavailable, calls the fallback and returns its result.
 */
export async function callBrainWithFallback(
  request: ChatRequest,
  fallback: () => Promise<string>,
): Promise<{ reply: string; fromBrain: boolean }> {
  try {
    const brainResponse = await callBrain(request);
    return { reply: brainResponse.reply, fromBrain: true };
  } catch (err) {
    console.warn('[brain-client] Brain unavailable, using fallback:', err);
    const reply = await fallback();
    return { reply, fromBrain: false };
  }
}

/**
 * Check if Brain service is healthy.
 */
export async function isBrainHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${BRAIN_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
