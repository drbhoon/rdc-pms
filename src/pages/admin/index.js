/**
 * admin/index.js
 * HR Admin Dashboard — stats, selectors, assessment pairs table with auto-refresh.
 */
import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/AdminLayout';

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    PENDING_RM:   { label: 'Pending RM',    cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    RM_SUBMITTED: { label: 'RM Submitted',  cls: 'bg-purple-100 text-purple-700 border-purple-200' },
    PENDING_BH:   { label: 'Pending BH',    cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    FINALIZED:    { label: 'Finalized',     cls: 'bg-green-100  text-green-700  border-green-200'  },
  };
  const { label, cls } = map[status] || { label: status, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, borderColor, textColor }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm pl-5 pr-6 py-5 border-l-4 ${borderColor} flex items-center gap-4`}>
      <div>
        <div className={`text-3xl font-bold ${textColor}`}>{value ?? '—'}</div>
        <div className="text-xs text-slate-500 mt-0.5 font-medium">{label}</div>
      </div>
    </div>
  );
}

// ── Copy-to-clipboard icon button ─────────────────────────────────────────────
function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  return (
    <button
      onClick={handleCopy}
      title={`Copy ${label} link`}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all"
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
          <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
        </svg>
      )}
      {copied ? 'Copied' : label}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage({ user }) {
  const [roles, setRoles]         = useState([]);
  const [cycles, setCycles]       = useState([]);
  const [roleKey, setRoleKey]     = useState('');
  const [cycle, setCycle]         = useState('');
  const [stats, setStats]         = useState(null);
  const [pairs, setPairs]         = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingPairs, setLoadingPairs] = useState(false);

  // Load roles once
  useEffect(() => {
    fetch('/api/admin/roles')
      .then((r) => r.json())
      .then((d) => {
        setRoles(d.roles || []);
        if (d.roles?.length) setRoleKey(d.roles[0].roleKey);
      })
      .catch(console.error);
  }, []);

  // Load cycles when role changes
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

  // Load stats + pairs
  const loadData = useCallback(() => {
    if (!roleKey || !cycle) return;
    setLoadingStats(true);
    setLoadingPairs(true);

    const qs = `roleKey=${encodeURIComponent(roleKey)}&cycle=${encodeURIComponent(cycle)}`;

    fetch(`/api/admin/stats?${qs}`)
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(console.error)
      .finally(() => setLoadingStats(false));

    fetch(`/api/admin/pairs?${qs}`)
      .then((r) => r.json())
      .then((d) => setPairs(d.pairs || []))
      .catch(console.error)
      .finally(() => setLoadingPairs(false));
  }, [roleKey, cycle]);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 30000);
    return () => clearInterval(id);
  }, [loadData]);

  const host = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <AdminLayout title="Dashboard" user={user}>
      {/* ── Selectors ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Role</label>
          <select
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-w-[160px]"
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
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-w-[160px]"
          >
            {cycles.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse" />
          Auto-refreshes every 30s
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {loadingStats && !stats ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 h-24 animate-pulse" />
          ))
        ) : (
          <>
            <StatCard label="Total Selected"  value={stats?.totalSelected}  borderColor="border-l-blue-500"   textColor="text-blue-600" />
            <StatCard label="Pending RM"      value={stats?.pendingRm}      borderColor="border-l-orange-500" textColor="text-orange-600" />
            <StatCard label="RM Submitted"    value={stats?.rmSubmitted}    borderColor="border-l-purple-500" textColor="text-purple-600" />
            <StatCard label="Pending BH"      value={stats?.pendingBh}      borderColor="border-l-yellow-500" textColor="text-yellow-600" />
            <StatCard label="Finalized"       value={stats?.finalized}      borderColor="border-l-green-500"  textColor="text-green-600" />
          </>
        )}
      </div>

      {/* ── Pairs Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Assessment Pairs</h2>
          <span className="text-xs text-slate-400">{pairs.length} record{pairs.length !== 1 ? 's' : ''}</span>
        </div>

        {loadingPairs && pairs.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">Loading…</div>
        ) : pairs.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            No assessment pairs found for this role and cycle.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Emp Code', 'Name', 'RM', 'BH', 'Status', 'Last Updated', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pairs.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.empCode}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.empName}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{p.rmName || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{p.bhName || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {p.updatedAt
                        ? new Date(p.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.rmToken && (
                          <CopyButton text={`${host}/form/rm/${p.rmToken}`} label="RM Link" />
                        )}
                        {p.bhToken && (
                          <CopyButton text={`${host}/form/bh/${p.bhToken}`} label="BH Link" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export async function getServerSideProps({ req }) {
  const raw = req.cookies?.pms_session;
  if (!raw) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }
  try {
    const user = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    return { props: { user } };
  } catch {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }
}
