import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

type BucketKey = string;

const WINDOW_MS = 60_000;
const GENERAL_LIMIT = 100;
const AUTH_LIMIT = 30;

const buckets = new Map<BucketKey, number[]>();

// Periodic cleanup: purge stale buckets every 2 minutes
const CLEANUP_INTERVAL_MS = 120_000;
setInterval(() => {
  const now = Date.now();
  for (const [key] of buckets) {
    cleanupAndGetTimestamps(key, now);
  }
}, CLEANUP_INTERVAL_MS).unref();

function isAuthRoute(url: string): boolean {
  return url.startsWith('/api/auth/');
}

function buildKey(request: FastifyRequest): BucketKey {
  const ip = request.ip || 'unknown';
  const identity = request.parentId || ip;
  const scope = isAuthRoute(request.url) ? 'auth' : 'general';
  return `${scope}:${identity}`;
}

function cleanupAndGetTimestamps(key: BucketKey, now: number): number[] {
  const existing = buckets.get(key) || [];
  const fresh = existing.filter((timestamp) => now - timestamp < WINDOW_MS);

  if (fresh.length === 0) {
    buckets.delete(key);
    return [];
  }

  buckets.set(key, fresh);
  return fresh;
}

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    const now = Date.now();
    const key = buildKey(request);
    const timestamps = cleanupAndGetTimestamps(key, now);
    const limit = isAuthRoute(request.url) ? AUTH_LIMIT : GENERAL_LIMIT;

    if (timestamps.length >= limit) {
      return reply.code(429).send({ error: 'Too Many Requests' });
    }

    timestamps.push(now);
    buckets.set(key, timestamps);
  });
};

export default fp(rateLimitPlugin, {
  name: 'rate-limit-middleware',
});