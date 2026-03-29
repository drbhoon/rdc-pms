/**
 * POST /api/admin/pairs/create
 * Creates a new assessment pair. Requires HR admin session.
 */
import { requireAuth } from '../../../../lib/auth';
import { createPair, appendAudit } from '../../../../lib/queries';
import { sendRmLink } from '../../../../lib/mailer';

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

    // Send RM email (non-blocking — don't fail the request if email fails)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    sendRmLink({
      rmName,
      rmEmail,
      empName,
      empCode,
      roleKey,
      cycle,
      formUrl: `${appUrl}/form/rm/${pair.rmToken}`,
    }).catch((e) => console.error('[pairs/create] RM email failed:', e.message));

    return res.status(201).json({ pair });
  } catch (err) {
    console.error('[pairs/create]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
