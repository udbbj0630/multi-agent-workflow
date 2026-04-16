import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import {
  getChild,
  getChildrenByParent,
  getSessionsByChild,
  getTurnsBySession,
  getScoresByChild,
  getMemories,
  getMilestones,
  getBaselines,
  logAudit,
} from '../services/store.js';

const PRIVACY_POLICY = {
  title: '呜哩 Uli 隐私政策',
  lastUpdated: '2026-04-13',
  sections: [
    {
      heading: '我们收集哪些信息',
      content: '呜哩收集以下信息以提供更好的服务体验：家长手机号（用于登录）、孩子昵称和出生日期（用于个性化对话）。在对话过程中，呜哩会记录孩子的聊天内容，用于生成成长报告和改进对话质量。',
    },
    {
      heading: '我们如何使用信息',
      content: '收集的信息仅用于：1）提供和维护呜哩服务；2）生成孩子的成长评估报告；3）个性化对话内容；4）改进产品体验。我们不会将任何个人信息出售给第三方。',
    },
    {
      heading: '数据安全',
      content: '所有数据通过加密传输（HTTPS）进行保护，密码使用行业标准的 bcrypt 算法加密存储。我们采取合理的技术措施保护数据安全，但无法保证互联网传输的绝对安全。',
    },
    {
      heading: '数据存储',
      content: '数据存储在中国境内的服务器上。我们会保留您的数据直到您主动删除账户或我们停止服务。',
    },
    {
      heading: '您的权利',
      content: '您有权：1）访问您的所有数据；2）导出您的数据；3）删除您的账户和所有相关数据。您可以通过应用内的设置或联系我们的方式行使这些权利。',
    },
    {
      heading: '未成年人保护',
      content: '呜哩专为儿童设计。我们不会收集额外的个人信息，不会使用儿童数据进行定向广告，所有对话内容仅用于提供服务和生成成长报告。',
    },
    {
      heading: '联系我们',
      content: '如您对隐私政策有任何疑问，请通过应用内的联系方式与我们取得联系。',
    },
  ],
};

const TERMS_OF_SERVICE = {
  title: '呜哩 Uli 服务条款',
  lastUpdated: '2026-04-13',
  sections: [
    {
      heading: '服务说明',
      content: '呜哩是一款基于人工智能的儿童成长陪伴应用，通过对话互动帮助儿童发展创造力、批判思维、沟通表达和协作能力。呜哩的AI回复由大语言模型生成，不构成专业教育或心理建议。',
    },
    {
      heading: '使用条件',
      content: '使用呜哩服务需要：1）由家长注册账户；2）提供真实的孩子信息；3）家长对儿童使用本应用进行监督。本服务适用于3-12岁儿童，建议家长陪同使用。',
    },
    {
      heading: '内容免责',
      content: '呜哩的回复由AI生成，虽然我们努力确保内容安全、积极，但无法保证所有回复都完全准确或适合所有情况。家长应监督孩子的使用，如有不当内容请联系我们。',
    },
    {
      heading: '账户安全',
      content: '用户应妥善保管登录信息，因账户信息泄露导致的损失由用户自行承担。如发现账户被未授权使用，请立即联系我们。',
    },
    {
      heading: '服务变更与终止',
      content: '我们保留随时修改或终止服务的权利，重大变更会提前通知用户。用户可随时选择停止使用服务并删除账户。',
    },
    {
      heading: '责任限制',
      content: '在法律允许的最大范围内，呜哩不对因使用或无法使用本服务导致的任何间接、偶然、特殊或惩罚性损害承担责任。',
    },
  ],
};

const legalRoutes: FastifyPluginAsync = async (fastify) => {
  // Public legal pages
  fastify.get('/api/legal/privacy', async () => PRIVACY_POLICY);
  fastify.get('/api/legal/terms', async () => TERMS_OF_SERVICE);

  // Protected account endpoints
  fastify.register(async (protectedScope) => {
    protectedScope.addHook('preHandler', protectedScope.authenticate);

    // Data export (GDPR-style)
    protectedScope.get('/api/account/export', async (request, reply) => {
      const parentId = request.parentId;
      if (!parentId) return reply.code(401).send({ error: 'Unauthorized' });

      const children = getChildrenByParent(parentId);
      const exportData: Record<string, unknown> = {
        exportDate: new Date().toISOString(),
        parentId,
        children: [],
      };

      for (const child of children) {
        const sessions = getSessionsByChild(child.id);
        const scores = getScoresByChild(child.id);
        const memories = getMemories(child.id);
        const milestones = getMilestones(child.id);
        const baselines = getBaselines(child.id);

        const sessionsWithTurns = sessions.map((session) => ({
          ...session,
          turns: getTurnsBySession(session.id),
        }));

        (exportData.children as Array<Record<string, unknown>>).push({
          childId: child.id,
          nickname: child.nickname,
          birthDate: child.birthDate,
          sessions: sessionsWithTurns,
          scores,
          memories,
          milestones,
          baselines,
        });
      }

      logAudit(undefined, 'data_export', `parentId=${parentId}`);
      return reply
        .header('Content-Disposition', `attachment; filename="uli-export-${new Date().toISOString().slice(0, 10)}.json"`)
        .send(exportData);
    });

    // Data deletion
    protectedScope.post('/api/account/delete', async (request, reply) => {
      const parentId = request.parentId;
      if (!parentId) return reply.code(401).send({ error: 'Unauthorized' });

      logAudit(undefined, 'account_deletion_requested', `parentId=${parentId}`);
      return reply.send({
        message: '删除请求已收到。数据将在7个工作日内完成删除。',
        requestId: `del-${Date.now()}`,
      });
    });
  });
};

export default fp(legalRoutes, {
  name: 'legal-routes',
});
