import type { Server, Socket } from 'socket.io';

import { verifyToken } from '../services/auth.js';
import { assessSession } from '../services/assessment.js';
import { chatStream, extractMemories, generateGuidance } from '../services/llm.js';
import { detectConcept, getKnowledgeBoundary } from '../services/knowledge.js';
import { callBrainWithFallback } from '../services/brain-client.js';
import {
  addTurn,
  createSession,
  endSession,
  getBaseline,
  getBaselines,
  getChild,
  getChildrenByParent,
  getMemories,
  getMemoryContext,
  getTurnsBySession,
  logAudit,
  saveMemory,
} from '../services/store.js';

interface SessionContext {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  sessionId?: string;
  childId?: string;
  childAge?: number;
  childName?: string;
  childTexts: string[];
  finalized: boolean;
}

interface StartSessionPayload {
  childId?: string;
  childName?: string;
}

interface TextPayload {
  text?: string;
}

interface ObserveSessionPayload {
  childId?: string;
}

const sessionContexts = new Map<string, SessionContext>();

function getOrCreateContext(socketId: string): SessionContext {
  const existing = sessionContexts.get(socketId);
  if (existing) return existing;

  const created: SessionContext = {
    messages: [],
    childTexts: [],
    finalized: false,
  };
  sessionContexts.set(socketId, created);
  return created;
}

function getChildAgeFromBirthDate(birthDate: string): number {
  const age = Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return Math.max(3, age || 5);
}

function pickGreeting(childName: string, memoryContext: string): string {
  if (memoryContext.trim()) {
    return `嗨${childName}！呜哩好想你呀！我记得你说过一些有趣的事情呢，今天想先聊哪一个呀？`;
  }
  return `嗨${childName}！我是呜哩！今天我们想聊什么呀？`;
}

function emitObservedMessage(io: Server, childId: string | undefined, sender: 'child' | 'uli', text: string): void {
  if (!childId) return;
  io.to(`observe:${childId}`).emit('observed_message', { sender, text });
}

async function finalizeSession(io: Server, socket: Socket): Promise<void> {
  const ctx = sessionContexts.get(socket.id);
  if (!ctx || ctx.finalized || !ctx.sessionId || !ctx.childId) {
    sessionContexts.delete(socket.id);
    return;
  }

  ctx.finalized = true;

  try {
    endSession(ctx.sessionId);

    if (ctx.childTexts.length > 0) {
      const assessment = await assessSession(
        ctx.childTexts,
        ctx.childAge || 5,
        ctx.childId,
      );

      // assessSession already calls updateBaselines + checkMilestones
      // when childId is provided — no duplicate saveSessionScore needed

      try {
        const existingMemories = getMemories(ctx.childId).map((memory) => `${memory.key}:${memory.value}`);
        const turns = getTurnsBySession(ctx.sessionId);
        const newMemories = await extractMemories(
          turns.map((turn) => ({ role: turn.role, text: turn.text })),
          existingMemories,
        );

        for (const memory of newMemories) {
          if (
            typeof memory.category === 'string' &&
            typeof memory.key === 'string' &&
            typeof memory.value === 'string'
          ) {
            saveMemory(ctx.childId, memory.category as 'interest' | 'relation' | 'event' | 'emotion' | 'preference', memory.key, memory.value);
          }
        }
      } catch (error) {
        console.warn('[socket] memory extraction failed:', error);
      }

      logAudit(ctx.childId, 'session_finalized', JSON.stringify({
        sessionId: ctx.sessionId,
        childTurns: ctx.childTexts.length,
        childName: ctx.childName,
      }));
    }
  } finally {
    sessionContexts.delete(socket.id);
  }
}

export function registerSocketHandlers(io: Server): void {
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      next(new Error('Unauthorized'));
      return;
    }

    const parentId = verifyToken(token);
    if (!parentId) {
      next(new Error('Unauthorized'));
      return;
    }

    const childId = socket.handshake.query?.childId as string | undefined;
    if (childId) {
      const children = getChildrenByParent(parentId);
      const owns = children.some((c) => c.id === childId);
      if (!owns) {
        next(new Error('Forbidden'));
        return;
      }
    }

    (socket as Socket & { parentId?: string }).parentId = parentId;
    next();
  });

  io.on('connection', (socket) => {
    const ctx = getOrCreateContext(socket.id);

    socket.on('observe_session', (payload: ObserveSessionPayload) => {
      if (!payload?.childId) return;
      socket.join(`observe:${payload.childId}`);
    });

    socket.on('start_session', async (payload?: StartSessionPayload) => {
      const childId = payload?.childId;
      const socketParentId = (socket as Socket & { parentId?: string }).parentId;

      if (!childId) {
        socket.emit('session_started', {
          greeting: '嗨！我是呜哩！今天想聊什么呀？',
        });
        return;
      }

      const child = getChild(childId);
      if (!child || child.parentId !== socketParentId) {
        socket.emit('session_started', {
          greeting: '嗯……呜哩暂时还找不到这位小朋友，我们先随便聊聊吧！',
        });
        logAudit(childId, 'auth_blocked_start_session', `parentId=${socketParentId}`);
        return;
      }

      const baselines = getBaselines(child.id);
      const difficultyLevel = Math.max(1, ...baselines.map((baseline) => baseline.difficultyLevel));
      const session = createSession(child.id, difficultyLevel);
      const memoryContext = getMemoryContext(child.id);
      const greeting = pickGreeting(payload?.childName || child.nickname, memoryContext);

      ctx.messages = [];
      ctx.sessionId = session.id;
      ctx.childId = child.id;
      ctx.childAge = getChildAgeFromBirthDate(child.birthDate);
      ctx.childName = payload?.childName || child.nickname;
      ctx.childTexts = [];
      ctx.finalized = false;

      addTurn(session.id, 'uli', greeting);
      ctx.messages.push({ role: 'assistant', content: greeting });

      socket.emit('session_started', { greeting });
      emitObservedMessage(io, child.id, 'uli', greeting);

      logAudit(child.id, 'session_started', JSON.stringify({
        sessionId: session.id,
        childName: ctx.childName,
      }));
    });

    socket.on('text', async (payload: TextPayload) => {
      const text = payload?.text?.trim();
      if (!text) return;
      if (text.length > 2000) {
        socket.emit('audio', { text: '你说得太多啦，呜哩记不住这么多呢！能简单说一点吗？', animation: 'giggle' });
        return;
      }

      const current = getOrCreateContext(socket.id);
      if (!current.sessionId || !current.childId) return;

      socket.emit('thinking');

      addTurn(current.sessionId, 'child', text);
      current.childTexts.push(text);
      current.messages.push({ role: 'user', content: text });

      emitObservedMessage(io, current.childId, 'child', text);

      try {
        const radar = {
          creativity: getBaseline(current.childId, 'creativity')?.currentScore || 50,
          criticalThinking: getBaseline(current.childId, 'critical_thinking')?.currentScore || 50,
          communication: getBaseline(current.childId, 'communication')?.currentScore || 50,
          collaboration: getBaseline(current.childId, 'collaboration')?.currentScore || 50,
        };

        const memoryContext = getMemoryContext(current.childId);

        // Call Brain service with fallback to direct LLM
        const brainResult = await callBrainWithFallback(
          {
            childText: text,
            childAge: current.childAge || 5,
            childName: current.childName || '小朋友',
            childId: current.childId,
            sessionHistory: current.messages.slice(-20),
            memoryContext: memoryContext || undefined,
            assessmentScores: radar,
          },
          // Fallback: use existing direct LLM path
          async () => {
            const memories = getMemories(current.childId!).map((memory) => ({
              category: memory.category,
              value: memory.value,
            }));
            const assessmentHint = generateGuidance(radar, memories);
            const concept = detectConcept(text);
            const knowledgeBoundary = concept && current.childAge
              ? getKnowledgeBoundary(concept, current.childAge)
              : null;

            let reply = '';
            for await (const chunk of chatStream(current.messages.slice(-20), {
              childAge: current.childAge,
              childName: current.childName,
              memoryContext: memoryContext || undefined,
              assessmentHint,
              knowledgeBoundary: knowledgeBoundary || undefined,
            })) {
              reply += chunk;
            }
            return reply || '嗯……呜哩想了想，你可以再多告诉我一点吗？';
          },
        );

        let fullReply = brainResult.reply;

        if (!fullReply.trim()) {
          fullReply = '嗯……呜哩想了想，你可以再多告诉我一点吗？';
        }
        // Suppress unused variable warning in non-Brain path
        void brainResult;

        addTurn(current.sessionId, 'uli', fullReply);
        current.messages.push({ role: 'assistant', content: fullReply });

        socket.emit('audio', {
          text: fullReply,
          animation: 'talking',
        });

        emitObservedMessage(io, current.childId, 'uli', fullReply);
      } catch (error) {
        console.error('[socket] chat failed:', error);
        const fallbackReply = '嗯……呜哩脑袋转得有点慢，你能再说一次吗？';

        addTurn(current.sessionId, 'uli', fallbackReply);
        current.messages.push({ role: 'assistant', content: fallbackReply });

        socket.emit('audio', {
          text: fallbackReply,
          animation: 'thinking',
        });

        emitObservedMessage(io, current.childId, 'uli', fallbackReply);
      }
    });

    socket.on('tap_uli', () => {
      const reactions = [
        { animation: 'giggle', text: '好痒！嘿嘿嘿～' },
        { animation: 'giggle', text: '哇你戳到呜哩的肚子了！' },
        { animation: 'giggle', text: '嘻嘻～呜哩喜欢你！' },
        { animation: 'giggle', text: '哎呀！呜哩吓了一跳！嘿嘿～' },
      ];

      const reaction = reactions[Math.floor(Math.random() * reactions.length)];
      socket.emit('reaction', reaction);
    });

    socket.on('end_session', async () => {
      const current = sessionContexts.get(socket.id);

      if (current?.childName) {
        socket.emit('session_ended', {
          goodbye: `今天和${current.childName}聊得好开心呀！下次再来找呜哩玩哦！拜拜～`,
        });
      } else {
        socket.emit('session_ended', {
          goodbye: '今天和你聊得好开心呀！下次再来找呜哩玩哦！拜拜～',
        });
      }

      await finalizeSession(io, socket);
    });

    socket.on('disconnect', () => {
      void finalizeSession(io, socket);
    });
  });
}