/**
 * GET    /api/admin/templates        — list all role templates
 * POST   /api/admin/templates        — create or update a role template
 * DELETE /api/admin/templates?key=X  — delete a role template by roleKey
 */
import { requireAuth } from '../../../lib/auth';
import { getAllRoles, upsertRole, deleteRole } from '../../../lib/queries';

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

  // ── POST (create / update) ──
  if (req.method === 'POST') {
    const {
      roleKey, roleLabel, questions,
      filename, profileCols,
      rmNameCol, rmEmailCol, bhNameCol, bhEmailCol,
    } = req.body || {};

    if (!roleKey || !roleLabel)
      return res.status(400).json({ error: 'roleKey and roleLabel are required' });
    if (!Array.isArray(questions))
      return res.status(400).json({ error: 'questions must be an array' });

    try {
      const role = await upsertRole(roleKey, roleLabel, questions, {
        filename, profileCols, rmNameCol, rmEmailCol, bhNameCol, bhEmailCol,
      });
      return res.status(200).json({ role });
    } catch (err) {
      console.error('[templates POST]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── DELETE ──
  if (req.method === 'DELETE') {
    const { key } = req.query;
    if (!key) return res.status(400).json({ error: 'key query param required' });
    try {
      await deleteRole(key);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[templates DELETE]', err);
      if (err.code === 'P2025')
        return res.status(404).json({ error: 'Template not found' });
      if (err.code === 'P2003')
        return res.status(409).json({
          error: 'Cannot delete — template has existing assessments.',
        });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
