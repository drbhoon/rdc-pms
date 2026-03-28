/**
 * /api/form/bh/[token]
 *
 * GET  — returns pair data (including rmAnswers), questions, and employee profile for the BH form
 * POST — submits BH answers and finalises the assessment
 */
import { getPairByBhToken, getRole, submitBhAnswers, appendAudit } from '../../../../lib/queries';

export default async function handler(req, res) {
  const { token } = req.query;

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const pair = await getPairByBhToken(token);
      if (!pair) return res.status(404).json({ error: 'Token not found' });

      const role = await getRole(pair.roleKey);
      const questions = role?.questions
        ? (Array.isArray(role.questions) ? role.questions : [])
        : [];

      // Return safe pair fields — include rmAnswers for BH reference, no rmToken
      const safePair = {
        pairId:    pair.pairId,
        empCode:   pair.empCode,
        empName:   pair.empName,
        roleKey:   pair.roleKey,
        cycle:     pair.cycle,
        rmName:    pair.rmName,
        bhName:    pair.bhName,
        status:    pair.status,
        rmAnswers: pair.rmAnswers || {},
        bhAnswers: pair.bhAnswers || {},
      };

      // Fetch employee profile
      let employee = null;
      if (pair.employee) {
        employee = { profileData: pair.employee.profileData || {} };
      } else {
        try {
          const { prisma } = await import('../../../../lib/db');
          const emp = await prisma.employee.findUnique({
            where: { empCode_roleKey: { empCode: pair.empCode, roleKey: pair.roleKey } },
            select: { profileData: true },
          });
          if (emp) employee = { profileData: emp.profileData || {} };
        } catch {
          // non-critical — continue without profile
        }
      }

      return res.status(200).json({ pair: safePair, questions, employee });
    } catch (err) {
      console.error('[form/bh GET]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { answers } = req.body || {};
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'answers object is required' });
    }

    try {
      const pair = await getPairByBhToken(token);
      if (!pair) return res.status(404).json({ error: 'Token not found' });

      if (pair.status !== 'RM_SUBMITTED') {
        return res.status(400).json({ error: 'Not ready for BH review' });
      }

      await submitBhAnswers(pair.pairId, answers, 'bh:' + pair.bhEmail);

      await appendAudit({
        action:      'BH_SUBMITTED',
        pairId:      pair.pairId,
        empCode:     pair.empCode,
        empName:     pair.empName,
        roleKey:     pair.roleKey,
        cycle:       pair.cycle,
        performedBy: 'bh:' + pair.bhEmail,
        details:     {},
      });

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[form/bh POST]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
