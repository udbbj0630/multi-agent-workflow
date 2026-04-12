import { config } from 'dotenv';

// dotenv 必须在所有其他 import 之前加载
config();

const { default: Fastify } = await import('fastify');
const { default: cors } = await import('@fastify/cors');
const { Server } = await import('socket.io');
const { chatStream, extractMemories } = await import('./services/llm.js');

import type { ChatMessage } from './services/llm.js';
import * as store from './services/store.js';
import { assessSession } from './services/assessment.js';

const PORT = parseInt(process.env.PORT || '4000', 10);
const LLM_KEY = process.env.LLM_API_KEY || '';

// 每个 socket 的完整对话上下文
const sessionContexts = new Map<string, {
  messages: ChatMessage[];
  sessionId?: string;
  childId?: string;
  childAge?: number;
  childName?: string;
  childTexts: string[]; // 孩子说的所有话，用于测评
}>();

// ============ 演示数据：首次运行创建，之后复用 ============

const { parent: DEMO_PARENT, child: DEMO_CHILD } = store.ensureDemoData();

async function main() {
  const fastify = Fastify({ logger: true });

  await fastify.register(cors, { origin: true });

  // ============ REST API ============

  fastify.get('/api/health', async () => ({
    status: 'ok',
    service: 'uli-server',
    llm: LLM_KEY ? `configured (${process.env.LLM_MODEL})` : 'no-key (mock mode)',
  }));

  // 获取演示孩子信息
  fastify.get('/api/demo/child', async () => ({
    child: DEMO_CHILD,
    parentId: DEMO_PARENT.id,
  }));

  // 家长端：获取孩子基线
  fastify.get('/api/children/:childId/baseline', async (req: any) => {
    const { childId } = req.params;
    return {
      baselines: store.getBaselines(childId),
      radar: store.getRadarData(childId),
    };
  });

  // 家长端：获取雷达图数据
  fastify.get('/api/children/:childId/radar', async (req: any) => {
    return store.getRadarData(req.params.childId);
  });

  // 家长端：获取成长趋势
  fastify.get('/api/children/:childId/trend', async (req: any) => {
    return store.getTrendData(req.params.childId);
  });

  // 家长端：获取历史评分
  fastify.get('/api/children/:childId/scores', async (req: any) => {
    return store.getScoresByChild(req.params.childId);
  });

  // 家长端：获取里程碑
  fastify.get('/api/children/:childId/milestones', async (req: any) => {
    return store.getMilestones(req.params.childId);
  });

  // 家长端：获取对话历史
  fastify.get('/api/children/:childId/sessions', async (req: any) => {
    const sessions = store.getSessionsByChild(req.params.childId);
    return sessions.slice(0, 50); // 最近 50 条
  });

  // 家长端：获取单次对话详情
  fastify.get('/api/sessions/:sessionId', async (req: any) => {
    const session = store.getSession(req.params.sessionId);
    if (!session) return { error: 'not found' };
    return {
      session,
      turns: store.getTurnsBySession(req.params.sessionId),
    };
  });

  // 家长端：获取孩子记忆
  fastify.get('/api/children/:childId/memories', async (req: any) => {
    return store.getMemories(req.params.childId);
  });

  // ============ Socket.io ============

  const io = new Server(fastify.server, {
    cors: { origin: '*' },
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);
    sessionContexts.set(socket.id, { messages: [], childTexts: [] });

    socket.on('start_session', (data?: { childId?: string; childAge?: number; childName?: string }) => {
      const ctx = sessionContexts.get(socket.id)!;
      const childId = data?.childId || DEMO_CHILD.id;
      const child = store.getChild(childId);
      const childName = data?.childName || child?.nickname || '小朋友';
      const childAge = data?.childAge || (child ? Math.floor((Date.now() - new Date(child.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000)) : 5);

      ctx.childId = childId;
      ctx.childAge = childAge;
      ctx.childName = childName;
      ctx.childTexts = [];

      // 创建 session 记录
      const baselines = store.getBaselines(childId);
      const maxDifficulty = Math.max(...baselines.map((b) => b.difficultyLevel));
      const session = store.createSession(childId, maxDifficulty);
      ctx.sessionId = session.id;

      // 构建记忆上下文
      const memoryContext = store.getMemoryContext(childId);

      let greeting = '';
      if (memoryContext) {
        // 有记忆：个性化开场
        greeting = `嗨${childName}！呜哩好想你呀！你还记得上次我们聊的吗？今天想聊什么呀？`;
      } else {
        greeting = `嗨！我是呜哩！你是谁呀？我们来聊天吧！`;
      }

      socket.emit('session_started', { greeting });
      store.addTurn(session.id, 'uli', greeting);
      ctx.messages.push({ role: 'assistant', content: greeting });
    });

    socket.on('text', async (data: { text: string }) => {
      const ctx = sessionContexts.get(socket.id);
      if (!ctx) return;

      socket.emit('thinking', { animation: 'uli_think' });

      // 记录孩子的发言
      if (ctx.sessionId) {
        store.addTurn(ctx.sessionId, 'child', data.text);
      }
      ctx.childTexts.push(data.text);

      if (!LLM_KEY) {
        await new Promise((r) => setTimeout(r, 1000));
        const mockReplies = [
          '哇！你说的话好好听！呜哩还在学习怎么听懂地球话呢～你能再说一次吗？',
          '嗯嗯！呜哩觉得你说得好有道理！那你觉得为什么呢？',
          '哇！这个呜哩还不知道呢！你能给呜哩讲讲吗？',
          '嘿嘿，呜哩也想试试！你说怎么玩呀？',
          '你猜呜哩刚才在想什么？我在想 Z 星球上有没有和你一样厉害的小朋友！',
        ];
        const reply = mockReplies[Math.floor(Math.random() * mockReplies.length)];
        socket.emit('audio', { data: '', text: reply, animation: 'uli_talk' });
        ctx.messages.push({ role: 'user', content: data.text }, { role: 'assistant', content: reply });
        if (ctx.sessionId) store.addTurn(ctx.sessionId, 'uli', reply);
        return;
      }

      try {
        ctx.messages.push({ role: 'user', content: data.text });
        const recentMessages = ctx.messages.slice(-20);

        // 注入记忆上下文
        const memoryContext = ctx.childId ? store.getMemoryContext(ctx.childId) : '';

        let fullReply = '';
        for await (const chunk of chatStream(recentMessages, {
          childAge: ctx.childAge,
          childName: ctx.childName,
          memoryContext: memoryContext || undefined,
        })) {
          fullReply += chunk;
        }

        console.log(`[llm] Q: ${data.text} | A: ${fullReply.slice(0, 50)}...`);

        ctx.messages.push({ role: 'assistant', content: fullReply });
        if (ctx.sessionId) store.addTurn(ctx.sessionId, 'uli', fullReply);

        socket.emit('audio', { data: '', text: fullReply, animation: 'uli_talk' });
      } catch (err) {
        console.error('[llm] error:', err);
        socket.emit('audio', {
          data: '',
          text: '嗯……呜哩脑子有点转不过来了，你能再说一次吗？',
          animation: 'uli_think',
        });
      }
    });

    // 语音（Web Speech API 已在前端转文字，走 text 通道）
    socket.on('audio', async () => {
      socket.emit('audio', {
        data: '',
        text: '呜哩收到啦！试试用文字和呜哩聊天吧～',
        animation: 'uli_talk',
      });
    });

    socket.on('tap_uli', () => {
      const reactions = [
        { animation: 'uli_giggle', text: '好痒！嘿嘿嘿～' },
        { animation: 'uli_giggle', text: '哇你戳到呜哩的肚子了！' },
        { animation: 'uli_giggle', text: '嘻嘻～呜哩喜欢你！' },
        { animation: 'uli_giggle', text: '哎呀！呜哩吓了一跳！嘿嘿～' },
      ];
      socket.emit('reaction', reactions[Math.floor(Math.random() * reactions.length)]);
    });

    socket.on('end_session', async () => {
      const ctx = sessionContexts.get(socket.id);
      if (!ctx) return;

      const childName = ctx.childName || '小朋友';
      const goodbye = `今天和${childName}聊得好开心呀！下次再来找呜哩玩哦！拜拜～`;
      socket.emit('session_ended', { goodbye });

      // === session 结束处理 ===

      if (ctx.sessionId && ctx.childId && ctx.childTexts.length > 0) {
        // 1. 保存结束状态
        store.endSession(ctx.sessionId);

        // 2. 4C 测评
        const assessment = assessSession(ctx.childTexts);
        store.saveSessionScore(ctx.sessionId, ctx.childId, assessment);
        console.log(`[assessment] C:${assessment.creativity} CT:${assessment.criticalThinking} CM:${assessment.communication} CB:${assessment.collaboration} | signals: ${assessment.detectedSignals.join(', ')}`);

        // 3. 检查里程碑
        const baselines = store.getBaselines(ctx.childId);
        for (const bl of baselines) {
          if (bl.currentScore >= 80 && bl.sessionCount === 1) {
            store.addMilestone(ctx.childId, bl.dimension, 'first_80', `${bl.dimension}首次突破80分！`);
          }
          if (bl.trend === 'rising' && bl.sessionCount >= 3) {
            store.addMilestone(ctx.childId, bl.dimension, 'trend_rising', `${bl.dimension}持续上升中！`);
          }
        }

        // 4. 提取记忆（异步，不阻塞）
        if (LLM_KEY) {
          try {
            const existingMemories = store.getMemories(ctx.childId).map((m) => `${m.key}:${m.value}`);
            const allTurns = store.getTurnsBySession(ctx.sessionId);
            const newMemories = await extractMemories(
              allTurns.map((t) => ({ role: t.role, text: t.text })),
              existingMemories,
            );
            for (const mem of newMemories) {
              store.saveMemory(ctx.childId, mem.category as any, mem.key, mem.value);
            }
            if (newMemories.length > 0) {
              console.log(`[memory] extracted ${newMemories.length} new memories`);
            }
          } catch (err) {
            console.error('[memory] extraction failed:', err);
          }
        }
      }

      sessionContexts.delete(socket.id);
    });

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.id}`);
      sessionContexts.delete(socket.id);
    });
  });

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[uli-server] running on http://localhost:${PORT}`);
    console.log(`[uli-server] LLM: ${LLM_KEY ? process.env.LLM_MODEL : 'mock mode'}`);
    console.log(`[uli-server] demo child: ${DEMO_CHILD.nickname} (${DEMO_CHILD.id})`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
