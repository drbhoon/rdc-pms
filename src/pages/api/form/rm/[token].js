/**
 * /api/form/rm/[token]
 *
 * GET  — returns pair data, questions, and employee profile for the RM form
 * POST — submits RM answers and advances status to RM_SUBMITTED
 */
import { getPairByRmToken, getRole, submitRmAnswers, appendAudit } from '../../../../lib/queries';

export default async function handler(req, res) {
  const { token } = req.query;

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const pair = await getPairByRmToken(token);
      if (!pair) return res.status(404).json({ error: 'Token not found' });

      const role = await getRole(pair.roleKey);
      // Normalise to camelCase for the form page
      const questions = (Array.isArray(role?.questions) ? role.questions : []).map((q) => ({
        key:       q.question_key  || q.key,
        label:     q.question_label || q.label,
        fieldType: q.field_type    || q.fieldType || 'rating',
        order:     q.display_order || q.order || 0,
      })).sort((a, b) => a.order - b.order);

      // Return safe pair fields — no bhToken
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
      };

      // Fetch employee profile from the included relation if available
      let employee = null;
      if (pair.employee) {
        employee = { profileData: pair.employee.profileData || {} };
      } else {
        // Try to look up via the pair's employee record if not included
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
      console.error('[form/rm GET]', err);
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
      const pair = await getPairByRmToken(token);
      if (!pair) return res.status(404).json({ error: 'Token not found' });

      if (pair.status !== 'PENDING_RM') {
        return res.status(400).json({ error: 'Already submitted or locked' });
      }

      await submitRmAnswers(pair.pairId, answers, 'rm:' + pair.rmEmail);

      await appendAudit({
        action:      'RM_SUBMITTED',
        pairId:      pair.pairId,
        empCode:     pair.empCode,
        empName:     pair.empName,
        roleKey:     pair.roleKey,
        cycle:       pair.cycle,
        performedBy: 'rm:' + pair.rmEmail,
        details:     {},
      });

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[form/rm POST]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
