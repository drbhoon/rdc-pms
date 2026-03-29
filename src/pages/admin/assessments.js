/**
 * admin/assessments.js
 * Cycle Management — launch assessments, view pair status, copy links.
 */
import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/AdminLayout';

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    PENDING_RM:   { label: 'Pending RM',   cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    RM_SUBMITTED: { label: 'RM Submitted', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
    PENDING_BH:   { label: 'Pending BH',   cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    FINALIZED:    { label: 'Finalized',    cls: 'bg-green-100  text-green-700  border-green-200'  },
  };
  const { label, cls } = map[status] || { label: status || 'Not Started', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ text, label }) {
  const [copied, setCopied] = useState(false);
  if (!text) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      title={`Copy ${label}`}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all"
    >
      {copied
        ? <svg className="w-3.5 h-3.5 text-green-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
        : <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" /><path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" /></svg>
      }
      {copied ? 'Copied!' : label}
    </button>
  );
}

// ── Launch modal ──────────────────────────────────────────────────────────────
// role includes rmNameCol / rmEmailCol / bhNameCol / bhEmailCol so we can
// auto-populate from employee.profileData (stored during bulk upload).
function LaunchModal({ employee, cycle, roleKey, role, onClose, onLaunched }) {
  const pd = employee.profileData || {};

  const [form, setForm] = useState({
    rmName:  String(pd[role?.rmNameCol]  || ''),
    rmEmail: String(pd[role?.rmEmailCol] || ''),
    bhName:  String(pd[role?.bhNameCol]  || ''),
    bhEmail: String(pd[role?.bhEmailCol] || ''),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const autoFilled = role?.rmNameCol && (
    form.rmName || form.rmEmail || form.bhName || form.bhEmail
  );

  function set(field, val) { setForm((f) => ({ ...f, [field]: val })); }

  async function handleConfirm() {
    if (!form.rmName || !form.rmEmail || !form.bhName || !form.bhEmail) {
      return setError('All four fields are required.');
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/pairs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleKey,
          cycle,
          empCode: employee.empCode,
          empName: employee.empName,
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create pair');
      onLaunched();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Launch Assessment</h3>
            <p className="text-xs text-slate-500 mt-0.5">{employee.empName} ({employee.empCode}) · {cycle}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {autoFilled && (
          <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
            Pre-filled from employee data — verify before launching.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Reporting Manager</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                RM Name <span className="text-red-500">*</span>
                {role?.rmNameCol && <span className="ml-1 text-slate-400">({role.rmNameCol})</span>}
              </label>
              <input value={form.rmName} onChange={(e) => set('rmName', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Full name" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                RM Email <span className="text-red-500">*</span>
                {role?.rmEmailCol && <span className="ml-1 text-slate-400">({role.rmEmailCol})</span>}
              </label>
              <input type="email" value={form.rmEmail} onChange={(e) => set('rmEmail', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="rm@rdcconcrete.com" />
            </div>
          </div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-1">Business Head</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                BH Name <span className="text-red-500">*</span>
                {role?.bhNameCol && <span className="ml-1 text-slate-400">({role.bhNameCol})</span>}
              </label>
              <input value={form.bhName} onChange={(e) => set('bhName', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Full name" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                BH Email <span className="text-red-500">*</span>
                {role?.bhEmailCol && <span className="ml-1 text-slate-400">({role.bhEmailCol})</span>}
              </label>
              <input type="email" value={form.bhEmail} onChange={(e) => set('bhEmail', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="bh@rdcconcrete.com" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button onClick={onClose} className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {saving ? 'Launching…' : 'Launch Assessment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AssessmentsPage({ user }) {
  const [roles, setRoles]         = useState([]);
  const [cycles, setCycles]       = useState([]);
  const [roleKey, setRoleKey]     = useState('');
  const [cycle, setCycle]         = useState('');
  const [newCycleName, setNewCycleName] = useState('');
  const [employees, setEmployees] = useState([]);
  const [pairs, setPairs]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [launchTarget, setLaunchTarget] = useState(null);

  const host = typeof window !== 'undefined' ? window.location.origin : '';

  // Load roles (includes routing column names for auto-fill)
  useEffect(() => {
    fetch('/api/admin/roles')
      .then((r) => r.json())
      .then((d) => {
        setRoles(d.roles || []);
        if (d.roles?.length) setRoleKey(d.roles[0].roleKey);
      })
      .catch(console.error);
  }, []);

  // Load cycles on role change
  useEffect(() => {
    if (!roleKey) return;
    setCycle('');
    fetch(`/api/admin/cycles?roleKey=${encodeURIComponent(roleKey)}`)
      .then((r) => r.json())
      .then((d) => {
        setCycles(d.cycles || []);
        if (d.cycles?.length) setCycle(d.cycles[0]);
      })
      .catch(console.error);
  }, [roleKey]);

  // Load employees + pairs
  const loadData = useCallback(() => {
    if (!roleKey || !cycle) return;
    setLoading(true);
    const qs = `roleKey=${encodeURIComponent(roleKey)}&cycle=${encodeURIComponent(cycle)}`;
    Promise.all([
      fetch(`/api/admin/employees?roleKey=${encodeURIComponent(roleKey)}`).then((r) => r.json()),
      fetch(`/api/admin/pairs?${qs}`).then((r) => r.json()),
    ])
      .then(([empData, pairData]) => {
        setEmployees(empData.employees || []);
        setPairs(pairData.pairs || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [roleKey, cycle]);

  useEffect(() => { loadData(); }, [loadData]);

  function handleAddCycle() {
    const name = newCycleName.trim();
    if (!name) return;
    if (!cycles.includes(name)) {
      setCycles((prev) => [name, ...prev]);
    }
    setCycle(name);
    setNewCycleName('');
  }

  // Map pair data by empCode for quick lookup
  const pairMap = {};
  pairs.forEach((p) => { pairMap[p.empCode] = p; });

  // Current role object (includes routing column names)
  const currentRole = roles.find((r) => r.roleKey === roleKey) || null;

  return (
    <AdminLayout title="Cycle Management" user={user}>
      {/* ── Top controls ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Role</label>
          <select
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-w-[150px]"
          >
            {roles.map((r) => (
              <option key={r.roleKey} value={r.roleKey}>{r.roleLabel || r.roleKey}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Cycle</label>
          <select
            value={cycle}
            onChange={(e) => setCycle(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-w-[150px]"
          >
            {cycles.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input
            value={newCycleName}
            onChange={(e) => setNewCycleName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCycle()}
            placeholder="New cycle name…"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-44"
          />
          <button
            onClick={handleAddCycle}
            disabled={!newCycleName.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            + New Cycle
          </button>
        </div>
      </div>

      {/* ── Main table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            {cycle ? `${roleKey} — ${cycle}` : 'Select a role and cycle'}
          </h2>
          <span className="text-xs text-slate-400">{employees.length} employees</span>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">Loading…</div>
        ) : employees.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            No employees found for this role. Add employees in the Employees section first.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Emp Code', 'Name', 'Profile', 'Status', 'RM Link', 'BH Link', 'Action'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => {
                  const pair = pairMap[emp.empCode];
                  const profileSummary = Object.entries(emp.profileData || {})
                    .filter(([, v]) => v != null && v !== '')
                    .slice(0, 2)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' · ');

                  return (
                    <tr key={emp.id || emp.empCode} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{emp.empCode}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{emp.empName}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">{profileSummary || '—'}</td>
                      <td className="px-4 py-3">
                        {pair ? <StatusBadge status={pair.status} /> : <span className="text-xs text-slate-400">Not launched</span>}
                      </td>
                      <td className="px-4 py-3">
                        {pair?.rmToken
                          ? <CopyBtn text={`${host}/form/rm/${pair.rmToken}`} label="RM Link" />
                          : <span className="text-slate-300 text-xs">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {pair?.bhToken
                          ? <CopyBtn text={`${host}/form/bh/${pair.bhToken}`} label="BH Link" />
                          : <span className="text-slate-300 text-xs">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {!pair ? (
                          <button
                            onClick={() => setLaunchTarget(emp)}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-all"
                          >
                            Launch
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Active</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Launch modal ── */}
      {launchTarget && (
        <LaunchModal
          employee={launchTarget}
          cycle={cycle}
          roleKey={roleKey}
          role={currentRole}
          onClose={() => setLaunchTarget(null)}
          onLaunched={loadData}
        />
      )}
    </AdminLayout>
  );
}

export async function getServerSideProps({ req }) {
  const raw = req.cookies?.pms_session;
  if (!raw) return { redirect: { destination: '/admin/login', permanent: false } };
  try {
    const user = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    return { props: { user } };
  } catch {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }
}
