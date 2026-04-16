import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';

import { config } from './config.js';
import authPlugin from './middleware/auth.js';
import rateLimitPlugin from './middleware/rateLimit.js';
import authRoutes from './routes/auth.js';
import childrenRoutes from './routes/children.js';
import legalRoutes from './routes/legal.js';
import { ensureDemoData, pruneStaleData, runMigrations } from './services/store.js';
import { registerSocketHandlers } from './websocket/session.js';

async function buildServer() {
  const fastify = Fastify({ logger: true });

  await fastify.register(cors, {
    origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  });
  await fastify.register(authPlugin);
  await fastify.register(rateLimitPlugin);

  fastify.get('/health', async (_request, reply) => {
    try {
      const { getDB } = await import('./services/store.js');
      const row = getDB().prepare('SELECT 1 AS ok').get() as { ok: number } | undefined;
      if (row?.ok !== 1) throw new Error('DB check failed');
      return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
    } catch (error) {
      return reply.code(503).send({ status: 'error', message: 'Database unavailable' });
    }
  });

  await fastify.register(authRoutes);
  await fastify.register(childrenRoutes);
  await fastify.register(legalRoutes);

  return fastify;
}

async function start(): Promise<void> {
  runMigrations();

  const pruned = pruneStaleData();
  if (pruned.auditDeleted > 0 || pruned.memoriesDeleted > 0) {
    console.log(`[startup] Pruned ${pruned.auditDeleted} audit logs, ${pruned.memoriesDeleted} stale memories`);
  }

  if (config.NODE_ENV !== 'production') {
    ensureDemoData();
  }

  const fastify = await buildServer();

  const io = new Server(fastify.server, {
    cors: {
      origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    },
    path: '/socket.io',
  });

  registerSocketHandlers(io);

  try {
    await fastify.listen({ port: config.PORT, host: '0.0.0.0' });
    fastify.log.info(`[uli-server] running on http://localhost:${config.PORT}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

// Catch unhandled errors to prevent silent crashes
process.on('uncaughtException', (error) => {
  console.error('[FATAL] uncaughtException:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason);
  process.exit(1);
});

void start();