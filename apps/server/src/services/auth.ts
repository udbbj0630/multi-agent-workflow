import crypto from 'crypto';

function createToken(parentId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = { parentId, iat: Date.now(), exp: Date.now() + 30 * 24 * 3600 * 1000 };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET || 'uli-secret')
    .update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const sig = crypto.createHmac('sha256', process.env.JWT_SECRET || 'uli-secret')
      .update(`${parts[0]}.${parts[1]}`).digest('base64url');
    if (sig !== parts[2]) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload.parentId;
  } catch {
    return null;
  }
}

export { createToken, verifyToken };
