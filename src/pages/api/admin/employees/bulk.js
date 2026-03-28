/**
 * POST /api/admin/employees/bulk
 * Bulk upserts employees from a parsed spreadsheet upload.
 * Body: { roleKey, rows: [{ empCode, empName, ...rest }] }
 */
import { requireAuth } from '../../../../lib/auth';
import { bulkUpsertEmployees } from '../../../../lib/queries';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireAuth(req, res);
  if (!user) return;

  const { roleKey, rows } = req.body || {};
  if (!roleKey) return res.status(400).json({ error: 'roleKey is required' });
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows must be a non-empty array' });
  }

  try {
    const mapped = rows.map(({ empCode, empName, ...rest }) => ({
      empCode,
      empName,
      roleKey,
      profileData: rest,
    }));

    await bulkUpsertEmployees(mapped);

    return res.status(200).json({ count: rows.length });
  } catch (err) {
    console.error('[employees/bulk]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
