/**
 * POST /api/admin/pairs/create
 * Creates a new assessment pair. Requires HR admin session.
 */
import { requireAuth } from '../../../../lib/auth';
import { createPair, appendAudit } from '../../../../lib/queries';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireAuth(req, res);
  if (!user) return;

  const { empCode, empName, roleKey, cycle, rmName, rmEmail, bhName, bhEmail } = req.body || {};

  if (!empCode || !empName || !roleKey || !cycle || !rmName || !rmEmail || !bhName || !bhEmail) {
    return res.status(400).json({ error: 'empCode, empName, roleKey, cycle, rmName, rmEmail, bhName, bhEmail are all required' });
  }

  try {
    const pair = await createPair({
      empCode,
      empName,
      roleKey,
      cycle,
      rmName,
      rmEmail,
      bhName,
      bhEmail,
      selectedBy: user.email,
    });

    await appendAudit({
      action:      'PAIR_CREATED',
      pairId:      pair.pairId,
      empCode:     pair.empCode,
      empName:     pair.empName,
      roleKey:     pair.roleKey,
      cycle:       pair.cycle,
      performedBy: user.email,
      details:     { rmName, rmEmail, bhName, bhEmail },
    });

    return res.status(201).json({ pair });
  } catch (err) {
    console.error('[pairs/create]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
