import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import { generateWeeklyNarrative } from '../services/narrative.js';
import {
  getBaselines,
  getChild,
  getChildrenByParent,
  getMemories,
  getMilestones,
  getRadarData,
  getScoresByChild,
  getSessionsByChild,
  getTrendData,
} from '../services/store.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: unknown) => Promise<void>;
  }
}

interface ParentParams {
  parentId: string;
}

interface ChildParams {
  childId: string;
}

function assertParentAccess(requestParentId: string | undefined, resourceParentId: string): boolean {
  return Boolean(requestParentId && requestParentId === resourceParentId);
}

const childrenRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/health', async () => {
    const { getDB } = await import('../services/store.js');
    try {
      getDB().prepare('SELECT 1').get();
      return { status: 'ok', version: '0.1.0', db: 'connected' };
    } catch {
      return { status: 'degraded', version: '0.1.0', db: 'error' };
    }
  });

  fastify.register(async (protectedScope) => {
    protectedScope.addHook('preHandler', protectedScope.authenticate);

    protectedScope.get<{ Params: ParentParams }>('/api/parents/:parentId/children', async (request, reply) => {
      const { parentId } = request.params;

      if (!assertParentAccess(request.parentId, parentId)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      return reply.send({
        children: getChildrenByParent(parentId),
      });
    });

    protectedScope.get<{ Params: ChildParams }>('/api/children/:childId/baseline', async (request, reply) => {
      const child = getChild(request.params.childId);
      if (!child) {
        return reply.code(404).send({ error: 'not found' });
      }

      if (!assertParentAccess(request.parentId, child.parentId)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      return reply.send({
        radar: getRadarData(child.id),
        baselines: getBaselines(child.id),
      });
    });

    protectedScope.get<{ Params: ChildParams }>('/api/children/:childId/trend', async (request, reply) => {
      const child = getChild(request.params.childId);
      if (!child) {
        return reply.code(404).send({ error: 'not found' });
      }

      if (!assertParentAccess(request.parentId, child.parentId)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      return reply.send(getTrendData(child.id));
    });

    protectedScope.get<{ Params: ChildParams }>('/api/children/:childId/milestones', async (request, reply) => {
      const child = getChild(request.params.childId);
      if (!child) {
        return reply.code(404).send({ error: 'not found' });
      }

      if (!assertParentAccess(request.parentId, child.parentId)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      return reply.send(getMilestones(child.id));
    });

    protectedScope.get<{ Params: ChildParams }>('/api/children/:childId/memories', async (request, reply) => {
      const child = getChild(request.params.childId);
      if (!child) {
        return reply.code(404).send({ error: 'not found' });
      }

      if (!assertParentAccess(request.parentId, child.parentId)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      return reply.send(getMemories(child.id));
    });

    protectedScope.get<{ Params: ChildParams }>('/api/children/:childId/narrative', async (request, reply) => {
      const child = getChild(request.params.childId);
      if (!child) {
        return reply.code(404).send({ error: 'not found' });
      }

      if (!assertParentAccess(request.parentId, child.parentId)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const narrative = await generateWeeklyNarrative(child.id);
      return reply.send({ narrative });
    });

    protectedScope.get<{ Params: ChildParams }>('/api/children/:childId/sessions', async (request, reply) => {
      const child = getChild(request.params.childId);
      if (!child) {
        return reply.code(404).send({ error: 'not found' });
      }

      if (!assertParentAccess(request.parentId, child.parentId)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      return reply.send(getSessionsByChild(child.id));
    });

    protectedScope.get<{ Params: ChildParams }>('/api/children/:childId/scores', async (request, reply) => {
      const child = getChild(request.params.childId);
      if (!child) {
        return reply.code(404).send({ error: 'not found' });
      }

      if (!assertParentAccess(request.parentId, child.parentId)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      return reply.send(getScoresByChild(child.id));
    });
  });
};

export default fp(childrenRoutes, {
  name: 'children-routes',
});