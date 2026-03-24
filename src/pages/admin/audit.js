/**
 * Admin – Audit Log Viewer
 * Shows all audit actions with timestamps, filterable by role.
 * Also provides the super-admin unlock interface.
 */
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';

const ACTION_COLORS = {
  ROW_SELECTED:   'bg-purple-100 text-purple-800',
  ROW_UNSELECTED: 'bg-gray-100 text-gray-600',
  RM_SUBMITTED:   'bg-blue-100 text-blue-800',
  BH_ROW_CREATED: 'bg-teal-100 text-teal-800',
  BH_SUBMITTED:   'bg-green-100 text-green-800',
  ROW_LOCKED:     'bg-red-100 text-red-700',
  ROW_UNLOCKED:   'bg-yellow-100 text-yellow-800',
  CYCLE_CREATED:  'bg-indigo-100 text-indigo-800',
};

export default function AuditLog() {
  const [roles, setRoles]     = useState([]);
  const [roleKey, setRoleKey] = useState('PI');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Unlock form
  const [unlockForm, setUnlockForm] = useState({ pairId: '', rowType: 'RM', reason: '' });
  const [unlockMsg, setUnlockMsg]   = useState('');

  useEffect(() => {
    fetch('/api/roles')
      .then((r) => r.json())
      .then((d) => {
        setRoles(d.roles || []);
        if (d.roles?.length) setRoleKey(d.roles[0].key);
      });
  }, []);

  useEffect(() => { if (roleKey) loadAudit(); }, [roleKey]);

  async function loadAudit() {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/audit?roleKey=${encodeURIComponent(roleKey)}&limit=200`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setEntries(d.entries || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlock(e) {
    e.preventDefault();
    setUnlockMsg('');
    try {
      const r = await fetch('/api/admin/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-pms-user': 'admin@rdcconcrete.com' },
        body: JSON.stringify({ roleKey, ...unlockForm }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setUnlockMsg('Row unlocked successfully. Audit entry created.');
      loadAudit();
    } catch (err) {
      setUnlockMsg(`Error: ${err.message}`);
    }
  }

  return (
    <Layout title="Audit Log & Admin Override">
      {/* Role selector */}
      <div className="flex items-center gap-3 mb-6">
        <select className="form-select w-48" value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
          {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <button onClick={loadAudit} className="btn-secondary" disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Super admin unlock */}
      <div className="card mb-6">
        <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-3">
          Super Admin – Unlock Row
        </h3>
        <form onSubmit={handleUnlock} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="form-label">Assessment Pair ID</label>
            <input
              type="text"
              className="form-input w-64"
              value={unlockForm.pairId}
              onChange={(e) => setUnlockForm((p) => ({ ...p, pairId: e.target.value }))}
              placeholder="EMP001_PI_2026_Annual_0001"
              required
            />
          </div>
          <div>
            <label className="form-label">Row Type</label>
            <select className="form-select" value={unlockForm.rowType} onChange={(e) => setUnlockForm((p) => ({ ...p, rowType: e.target.value }))}>
              <option value="RM">RM</option>
              <option value="BH">BH</option>
            </select>
          </div>
          <div>
            <label className="form-label">Reason (required)</label>
            <input
              type="text"
              className="form-input w-64"
              value={unlockForm.reason}
              onChange={(e) => setUnlockForm((p) => ({ ...p, reason: e.target.value }))}
              placeholder="Enter unlock reason…"
              required
              minLength={5}
            />
          </div>
          <button type="submit" className="btn-danger">Unlock Row</button>
        </form>
        {unlockMsg && (
          <div className={`mt-2 text-sm ${unlockMsg.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {unlockMsg}
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded px-4 py-2 text-red-700 text-sm mb-4">{error}</div>}

      {/* Audit table */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">
            Audit Entries ({entries.length})
          </h3>
        </div>

        {entries.length === 0 && !loading ? (
          <div className="text-center text-gray-400 py-6">No audit entries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Pair ID</th>
                  <th>Emp Code</th>
                  <th>Name</th>
                  <th>Cycle</th>
                  <th>Performed By</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="text-xs font-mono text-gray-500">{e.TIMESTAMP?.slice(0, 16)}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[e.ACTION] || 'bg-gray-100 text-gray-600'}`}>
                        {e.ACTION}
                      </span>
                    </td>
                    <td className="text-xs font-mono">{e.ASSESSMENT_PAIR_ID}</td>
                    <td className="font-mono text-sm">{e.EMP_CODE}</td>
                    <td>{e.EMP_NAME}</td>
                    <td className="text-xs">{e.CYCLE}</td>
                    <td className="text-xs">{e.PERFORMED_BY}</td>
                    <td className="text-xs text-gray-500">{e.DETAILS}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
