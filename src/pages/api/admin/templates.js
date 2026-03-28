/**
 * GET  /api/admin/templates  — list all role templates with questions
 * POST /api/admin/templates  — create or update a role template
 */
import { requireAuth } from '../../../lib/auth';
import { getAllRoles, upsertRole } from '../../../lib/queries';

export default async function handler(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;

  // ── GET ──
  if (req.method === 'GET') {
    try {
      const roles = await getAllRoles();
      return res.status(200).json({ roles });
    } catch (err) {
      console.error('[templates GET]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── POST ──
  if (req.method === 'POST') {
    const { roleKey, roleLabel, questions } = req.body || {};
    if (!roleKey || !roleLabel) {
      return res.status(400).json({ error: 'roleKey and roleLabel are required' });
    }
    if (!Array.isArray(questions)) {
      return res.status(400).json({ error: 'questions must be an array' });
    }

    try {
      const role = await upsertRole(roleKey, roleLabel, questions);
      return res.status(200).json({ role });
    } catch (err) {
      console.error('[templates POST]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
