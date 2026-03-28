/**
 * POST /api/auth/login
 * Validates HR admin credentials and sets a session cookie.
 */
import { verifyCredentials, encodeSession, SESSION_COOKIE } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await verifyCredentials(email, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const cookieVal = encodeSession(user);
    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE}=${cookieVal}; HttpOnly; Path=/; Max-Age=${86400 * 7}; SameSite=Lax`
    );

    return res.status(200).json({ ok: true, user: { name: user.name, role: user.role } });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
