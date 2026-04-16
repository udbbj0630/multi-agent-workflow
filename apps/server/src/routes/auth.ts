import fp from 'fastify-plugin';
import bcrypt from 'bcryptjs';
import type { FastifyPluginAsync } from 'fastify';

import { createToken } from '../services/auth.js';
import {
  createChild,
  createParent,
  deleteParentAccount,
  findParentByPhone,
  getChildrenByParent,
  logAudit,
} from '../services/store.js';

interface RegisterBody {
  phone?: string;
  password?: string;
  nickname?: string;
  childName?: string;
  childBirth?: string;
}

interface LoginBody {
  phone?: string;
  password?: string;
}

const PHONE_REGEX = /^\d{11}$/;
const CHILD_NAME_REGEX = /^[\u4e00-\u9fff\u3400-\u4dbfa-zA-Z0-9·\- ]{1,20}$/;
const UNSAFE_CHARS = /[<>{}\\\/'"&]/;

function sanitize(str: string): string {
  return str.trim();
}

interface DeleteAccountBody {
  password?: string;
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: RegisterBody }>('/api/auth/register', async (request, reply) => {
    const {
      phone,
      password,
      nickname,
      childName,
      childBirth,
    } = request.body || {};

    if (!phone || !PHONE_REGEX.test(phone)) {
      return reply.code(400).send({ error: '请输入11位手机号' });
    }

    if (!password || password.length < 8) {
      return reply.code(400).send({ error: '密码至少8位' });
    }

    const rawName = childName || '';
    if (UNSAFE_CHARS.test(rawName)) {
      return reply.code(400).send({ error: '孩子名字不能包含特殊符号' });
    }
    const safeName = sanitize(rawName);
    if (!safeName || !CHILD_NAME_REGEX.test(safeName)) {
      return reply.code(400).send({ error: '孩子名字需要1-20个字符（中文、字母、数字）' });
    }

    if (!childBirth?.trim()) {
      return reply.code(400).send({ error: '请输入孩子出生日期' });
    }

    const existing = findParentByPhone(phone);
    if (existing) {
      return reply.code(409).send({ error: '该手机号已注册' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const parent = createParent({
      phone,
      passwordHash,
      nickname: nickname?.trim() || undefined,
    });

    const child = createChild({
      parentId: parent.id,
      nickname: safeName,
      birthDate: childBirth.trim(),
    });

    logAudit(child.id, 'auth_register', JSON.stringify({
      parentId: parent.id,
      phone,
    }));

    const token = createToken(parent.id, parent.tokenVersion);

    return reply.send({
      token,
      parentId: parent.id,
      childId: child.id,
      childName: child.nickname,
    });
  });

  fastify.post<{ Body: LoginBody }>('/api/auth/login', async (request, reply) => {
    const { phone, password } = request.body || {};

    if (!phone || !password) {
      return reply.code(400).send({ error: '请输入手机号和密码' });
    }

    const parent = findParentByPhone(phone);
    if (!parent) {
      return reply.code(404).send({ error: '账号不存在' });
    }

    const matched = await bcrypt.compare(password, parent.passwordHash);
    if (!matched) {
      return reply.code(401).send({ error: '密码错误' });
    }

    const children = getChildrenByParent(parent.id);
    const child = children[0];

    logAudit(child?.id, 'auth_login', JSON.stringify({
      parentId: parent.id,
      phone,
    }));

    const token = createToken(parent.id, parent.tokenVersion);

    return reply.send({
      token,
      parentId: parent.id,
      childId: child?.id,
      childName: child?.nickname,
    });
  });
  // Delete account — requires password confirmation
  fastify.delete<{ Body: DeleteAccountBody }>('/api/auth/account', {
    preHandler: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const parentId = request.parentId;
    if (!parentId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { password } = request.body || {};
    if (!password) {
      return reply.code(400).send({ error: '请输入密码以确认删除' });
    }

    const { getParentById } = await import('../services/store.js');
    const parentRecord = getParentById(parentId);
    if (!parentRecord) {
      return reply.code(404).send({ error: '账号不存在' });
    }

    const matched = await bcrypt.compare(password, parentRecord.passwordHash);
    if (!matched) {
      return reply.code(401).send({ error: '密码错误' });
    }

    deleteParentAccount(parentId);

    return reply.send({ success: true, message: '账号已删除' });
  });
};

export default fp(authRoutes, {
  name: 'auth-routes',
});