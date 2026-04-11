import { config } from 'dotenv';

// dotenv 必须在所有其他 import 之前加载
config();

const { default: Fastify } = await import('fastify');
const { default: cors } = await import('@fastify/cors');
const { Server } = await import('socket.io');
const { chatStream } = await import('./services/llm.js');
const { default: fs } = await import('fs');

import type { ChatMessage } from './services/llm.js';

const PORT = parseInt(process.env.PORT || '4000', 10);
const LLM_KEY = process.env.LLM_API_KEY || '';

// 每个 socket 的对话上下文
const sessionContexts = new Map<string, {
  messages: ChatMessage[];
  childId?: string;
  childAge?: number;
  childName?: string;
}>();

async function main() {
  const fastify = Fastify({ logger: true });

  await fastify.register(cors, { origin: true });

  // 健康检查
  fastify.get('/api/health', async () => ({
    status: 'ok',
    service: 'uli-server',
    llm: LLM_KEY ? `configured (${process.env.LLM_MODEL})` : 'no-key (mock mode)',
  }));

  // Socket.io
  const io = new Server(fastify.server, {
    cors: { origin: '*' },
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // 初始化该 socket 的对话上下文
    sessionContexts.set(socket.id, { messages: [] });

    socket.on('start_session', (data?: { childId?: string; childAge?: number; childName?: string }) => {
      const ctx = sessionContexts.get(socket.id);
      if (ctx && data) {
        ctx.childId = data.childId;
        ctx.childAge = data.childAge;
        ctx.childName = data.childName;
      }

      const greeting = ctx?.childName
        ? `嗨${ctx.childName}！我是呜哩！你今天想和呜哩聊什么呀？`
        : '嗨！我是呜哩！你是谁呀？我们来聊天吧！';

      socket.emit('session_started', { greeting });

      // 记录到上下文
      if (ctx) {
        ctx.messages.push({ role: 'assistant', content: greeting });
      }
    });

    // 接收文本消息
    socket.on('text', async (data: { text: string }) => {
      const ctx = sessionContexts.get(socket.id);
      if (!ctx) return;

      // 告诉孩子呜哩在思考
      socket.emit('thinking', { animation: 'uli_think' });

      if (!LLM_KEY) {
        // Mock 模式：没有 API key 时用预设回复
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
        ctx.messages.push(
          { role: 'user', content: data.text },
          { role: 'assistant', content: reply },
        );
        return;
      }

      // 真实 LLM 对话
      try {
        ctx.messages.push({ role: 'user', content: data.text });

        // 只保留最近 20 轮，避免 token 过长
        const recentMessages = ctx.messages.slice(-20);

        let fullReply = '';
        for await (const chunk of chatStream(recentMessages, {
          childAge: ctx.childAge,
          childName: ctx.childName,
        })) {
          fullReply += chunk;
        }

        console.log(`[llm] Q: ${data.text} | A: ${fullReply.slice(0, 50)}...`);

        ctx.messages.push({ role: 'assistant', content: fullReply });

        socket.emit('audio', {
          data: '',
          text: fullReply,
          animation: 'uli_talk',
        });
      } catch (err) {
        console.error('[llm] error:', err);
        socket.emit('audio', {
          data: '',
          text: '嗯……呜哩脑子有点转不过来了，你能再说一次吗？',
          animation: 'uli_think',
        });
      }
    });

    // 接收语音（后续接讯飞 STT）
    socket.on('audio', async (data: { data: string }) => {
      socket.emit('thinking', { animation: 'uli_think' });
      await new Promise((r) => setTimeout(r, 1000));
      socket.emit('audio', {
        data: '',
        text: '呜哩听到你的声音了！好好听！等呜哩学会听懂地球话就能和你聊天啦～',
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
      const reaction = reactions[Math.floor(Math.random() * reactions.length)];
      socket.emit('reaction', reaction);
    });

    socket.on('end_session', () => {
      const ctx = sessionContexts.get(socket.id);
      const goodbye = ctx?.childName
        ? `今天和${ctx.childName}聊得好开心呀！下次再来找呜哩玩哦！拜拜～`
        : '今天聊得好开心呀！下次再来找呜哩玩哦！拜拜～';

      socket.emit('session_ended', { goodbye });

      // TODO: 保存 session 到数据库，生成摘要
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
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
