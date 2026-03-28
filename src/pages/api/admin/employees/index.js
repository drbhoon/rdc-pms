/**
 * GET /api/admin/employees?roleKey=X
 * Returns all active employees for a given role.
 */
import { requireAuth } from '../../../../lib/auth';
import { getEmployeesByRole } from '../../../../lib/queries';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireAuth(req, res);
  if (!user) return;

  const { roleKey } = req.query;
  if (!roleKey) return res.status(400).json({ error: 'roleKey is required' });

  try {
    const employees = await getEmployeesByRole(roleKey);
    return res.status(200).json({ employees });
  } catch (err) {
    console.error('[employees/index]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
