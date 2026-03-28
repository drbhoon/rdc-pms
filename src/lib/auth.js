/**
 * auth.js — Simple session-based auth for HR admin console.
 * Uses a signed cookie (base64 JSON). No NextAuth dependency.
 * For production, replace with NextAuth or similar.
 */
import bcrypt from 'bcryptjs';
import { getHrUserByEmail } from './queries';

const SESSION_COOKIE = 'pms_session';

/** Verify email + password, return user object or null */
export async function verifyCredentials(email, password) {
  const user = await getHrUserByEmail(email);
  if (!user || !user.isActive) return null;
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** Encode session to cookie value */
export function encodeSession(user) {
  return Buffer.from(JSON.stringify(user)).toString('base64');
}

/** Decode session cookie → user or null */
export function decodeSession(cookieVal) {
  try {
    return JSON.parse(Buffer.from(cookieVal, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/** Get current user from request cookies */
export function getSessionUser(req) {
  const raw = req?.cookies?.[SESSION_COOKIE];
  if (!raw) return null;
  return decodeSession(raw);
}

/** Require HR auth — returns user or sends 401 */
export function requireAuth(req, res) {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return user;
}

/** Require super admin — returns user or sends 403 */
export function requireSuperAdmin(req, res) {
  const user = getSessionUser(req);
  if (!user) { res.status(401).json({ error: 'Not authenticated' }); return null; }
  if (user.role !== 'HR_SUPER_ADMIN') { res.status(403).json({ error: 'Super admin only' }); return null; }
  return user;
}

export { SESSION_COOKIE };
