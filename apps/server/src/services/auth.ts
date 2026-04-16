import crypto from 'crypto';
import { config } from '../config.js';
import { getParentById } from './store.js';

interface JwtHeader {
  alg: 'HS256';
  typ: 'JWT';
}

interface JwtPayload {
  parentId: string;
  tv: number; // token version — invalidated when password changes
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(unsignedToken: string): string {
  return crypto.createHmac('sha256', config.JWT_SECRET).update(unsignedToken).digest('base64url');
}

function timingSafeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function parseExpiryToSeconds(value: string): number {
  const normalized = value.trim();
  const match = normalized.match(/^(\d+)([smhd])$/i);
  if (!match) {
    throw new Error(`[auth] Unsupported JWT_EXPIRES_IN format: ${value}`);
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return amount * multipliers[unit];
}

const jwtExpirySeconds = parseExpiryToSeconds(config.JWT_EXPIRES_IN);

export function createToken(parentId: string, tokenVersion = 1): string {
  const now = Math.floor(Date.now() / 1000);
  const header: JwtHeader = { alg: 'HS256', typ: 'JWT' };
  const payload: JwtPayload = {
    parentId,
    tv: tokenVersion,
    iat: now,
    exp: now + jwtExpirySeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(unsignedToken);

  return `${unsignedToken}.${signature}`;
}

export function verifyToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, receivedSignature] = parts;
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = sign(unsignedToken);

    if (!timingSafeEqualString(expectedSignature, receivedSignature)) {
      return null;
    }

    const header = JSON.parse(base64UrlDecode(encodedHeader)) as Partial<JwtHeader>;
    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<JwtPayload>;
    if (!payload.parentId || typeof payload.parentId !== 'string') {
      return null;
    }

    if (typeof payload.exp !== 'number' || typeof payload.iat !== 'number') {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      return null;
    }

    // Check token version — reject tokens issued before password change
    if (typeof payload.tv === 'number') {
      const parent = getParentById(payload.parentId);
      if (parent && parent.tokenVersion > payload.tv) {
        return null;
      }
    }

    return payload.parentId;
  } catch {
    return null;
  }
}