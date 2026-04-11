import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import { config } from 'dotenv';

config();

const PORT = parseInt(process.env.PORT || '4000', 10);

async function main() {
  const fastify = Fastify({ logger: true });

  await fastify.register(cors, { origin: true });

  // 健康检查
  fastify.get('/api/health', async () => ({ status: 'ok', service: 'uli-server' }));

  // Socket.io
  const io = new Server(fastify.server, {
    cors: { origin: '*' },
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    socket.on('start_session', () => {
      socket.emit('session_started', {
        greeting: '嗨！我是呜哩！你是谁呀？我们来聊天吧！',
      });
    });

    socket.on('audio', async (data) => {
      // 告诉孩子呜哩在思考
      socket.emit('thinking', { animation: 'uli_think' });

      // TODO: STT → LLM → TTS 完整管道
      // 目前先用 mock 回复
      await new Promise((r) => setTimeout(r, 1500));

      socket.emit('audio', {
        data: '',
        text: '哇！你说的话好好听！呜哩还在学习怎么听懂地球话呢～你能再说一次吗？',
        animation: 'uli_talk',
      });
    });

    socket.on('tap_uli', () => {
      socket.emit('reaction', {
        animation: 'uli_giggle',
        text: '好痒！嘿嘿嘿～',
      });
    });

    socket.on('end_session', () => {
      socket.emit('session_ended', {
        goodbye: '今天聊得好开心呀！下次再来找呜哩玩哦！拜拜～',
      });
    });

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.id}`);
    });
  });

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[uli-server] running on http://localhost:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
