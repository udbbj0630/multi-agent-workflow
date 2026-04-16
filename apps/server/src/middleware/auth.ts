import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { verifyToken } from '../services/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    parentId?: string;
  }
}

function getBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;

  return token;
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('parentId', undefined);

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: any) => {
    const token = getBearerToken(request);
    if (!token) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const parentId = verifyToken(token);
    if (!parentId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    request.parentId = parentId;
  });
};

export default fp(authPlugin, {
  name: 'auth-middleware',
});