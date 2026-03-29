/**
 * POST /api/admin/employees/bulk
 * Bulk upserts employees from a parsed spreadsheet upload.
 * Body: { roleKey, rows: [{ ...rawExcelHeaders }] }
 *
 * Uses the RoleTemplate to:
 *  - Find which column is EMP_CODE and which is EMP_NAME (by synonym matching)
 *  - Exclude assessment question columns (those belong in AssessmentPair, not Employee)
 *  - Store everything else (routing, profile, date, number) in profileData JSONB
 */
import { requireAuth } from '../../../../lib/auth';
import { bulkUpsertEmployees, getRole } from '../../../../lib/queries';

const EMP_CODE_SYNONYMS = new Set([
  'EMP_CODE', 'EMPCODE', 'EMPLOYEE_CODE', 'EMPLOYEE_ID',
  'EMP CODE', 'EMPLOYEE CODE', 'EMPID', 'EMP_ID',
]);
const EMP_NAME_SYNONYMS = new Set([
  'EMP_NAME', 'EMPNAME', 'EMPLOYEE_NAME', 'EMPLOYEE NAME',
  'EMP NAME', 'NAME', 'FULL_NAME', 'FULLNAME',
]);

function normalise(s) {
  return String(s || '').toUpperCase().replace(/\s+/g, '_').trim();
}

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
    // ── Load template to understand column roles ────────────────────────────
    const template = await getRole(roleKey);
    if (!template) {
      return res.status(400).json({ error: `No template found for role "${roleKey}". Create the template first.` });
    }

    // Build set of question keys to exclude (normalised: lowercase + trimmed)
    // Use both exact and normalised for robust matching across Excel re-exports
    const questionKeys = new Set(
      (template.questions || []).flatMap((q) => {
        const k = q.question_key || '';
        return [k, k.toLowerCase().trim()];
      })
    );

    // ── Find empCode / empName column headers ───────────────────────────────
    const firstRow = rows[0] || {};
    const rowKeys = Object.keys(firstRow);

    // First try template profileCols (most reliable — set by HR at template time)
    const profileCols = Array.isArray(template.profileCols) ? template.profileCols : [];
    const identityCols = profileCols.filter((c) => c.field_type === 'identity');

    let empCodeHeader = identityCols.find((c) => EMP_CODE_SYNONYMS.has(normalise(c.key)))?.key;
    let empNameHeader = identityCols.find((c) => EMP_NAME_SYNONYMS.has(normalise(c.key)))?.key;

    // Fallback: scan actual row keys
    if (!empCodeHeader) {
      empCodeHeader = rowKeys.find((k) => EMP_CODE_SYNONYMS.has(normalise(k)));
    }
    if (!empNameHeader) {
      empNameHeader = rowKeys.find((k) => EMP_NAME_SYNONYMS.has(normalise(k)));
    }

    if (!empCodeHeader) {
      return res.status(400).json({
        error: `Could not find employee code column. Expected one of: EMP_CODE, EMPCODE, EMPLOYEE_CODE. Found: ${rowKeys.slice(0, 8).join(', ')}`,
      });
    }
    if (!empNameHeader) {
      return res.status(400).json({
        error: `Could not find employee name column. Expected one of: EMP_NAME, EMPNAME, EMPLOYEE_NAME. Found: ${rowKeys.slice(0, 8).join(', ')}`,
      });
    }

    // ── Map rows ────────────────────────────────────────────────────────────
    const mapped = rows
      .map((row) => {
        const empCode = String(row[empCodeHeader] ?? '').trim();
        const empName = String(row[empNameHeader] ?? '').trim();
        if (!empCode) return null; // skip blank rows

        const profileData = {};
        for (const [k, v] of Object.entries(row)) {
          // Skip empCode/empName identity cols (already captured above)
          if (k === empCodeHeader || k === empNameHeader) continue;
          // Skip assessment question columns (case-insensitive + trimmed match)
          if (questionKeys.has(k) || questionKeys.has(k.toLowerCase().trim())) continue;
          // Skip XLSX placeholder empty-header columns (__EMPTY, __EMPTY_1 …)
          if (/^__EMPTY/.test(k)) continue;
          profileData[k] = v;
        }

        return { empCode, empName, roleKey, profileData };
      })
      .filter(Boolean);

    if (!mapped.length) {
      return res.status(400).json({ error: 'No valid employee rows found (empCode column was empty for all rows).' });
    }

    await bulkUpsertEmployees(mapped);

    return res.status(200).json({
      upserted: mapped.length,
      empCodeColumn: empCodeHeader,
      empNameColumn: empNameHeader,
      skippedQuestionColumns: questionKeys.size,
    });
  } catch (err) {
    console.error('[employees/bulk]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
