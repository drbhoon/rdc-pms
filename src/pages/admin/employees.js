/**
 * Admin – Employee / Cycle Selection
 * Module 2: Select employees for assessment.
 * Clicking an employee row toggles selection (turns purple).
 */
import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import EmployeeTable from '../../components/EmployeeTable';

export default function EmployeeSelection() {
  const [roles, setRoles]             = useState([]);
  const [roleKey, setRoleKey]         = useState('PI');
  const [cycles, setCycles]           = useState([]);
  const [cycle, setCycle]             = useState('');
  const [employees, setEmployees]     = useState([]);
  const [loading, setLoading]         = useState(false);
  const [loadingPairId, setLoadingPairId] = useState('');
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  // New cycle form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newRow, setNewRow]           = useState({
    empCode: '', empName: '', cycle: '', rmName: '', rmEmail: '', bhName: '', bhEmail: '',
  });

  // Load roles
  useEffect(() => {
    fetch('/api/roles')
      .then((r) => r.json())
      .then((d) => {
        setRoles(d.roles || []);
        if (d.roles?.length) setRoleKey(d.roles[0].key);
      });
  }, []);

  // Load cycles when role changes
  useEffect(() => {
    if (!roleKey) return;
    fetch(`/api/roles/${roleKey}/cycles`)
      .then((r) => r.json())
      .then((d) => {
        setCycles(d.cycles || []);
        setCycle(d.cycles?.[0] || '');
      });
  }, [roleKey]);

  // Load employees when cycle changes
  const loadEmployees = useCallback(async () => {
    if (!roleKey || !cycle) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch(
        `/api/roles/${encodeURIComponent(roleKey)}/employees?cycle=${encodeURIComponent(cycle)}`
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setEmployees(d.employees || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [roleKey, cycle]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  // Toggle selection
  async function handleToggleSelect(pairId) {
    setLoadingPairId(pairId);
    setError('');
    setSuccess('');
    try {
      const r = await fetch('/api/assessment/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-pms-user': 'hr@rdcconcrete.com' },
        body: JSON.stringify({ roleKey, pairId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSuccess(d.selected ? `Selected: ${pairId}` : `Unselected: ${pairId}`);
      loadEmployees();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPairId('');
    }
  }

  // Create new cycle row
  async function handleCreateNewRow(e) {
    e.preventDefault();
    setError('');
    try {
      const r = await fetch('/api/assessment/new-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-pms-user': 'hr@rdcconcrete.com' },
        body: JSON.stringify({ roleKey, ...newRow }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSuccess(`Created new RM row: ${d.pairId}`);
      setShowNewForm(false);
      setNewRow({ empCode: '', empName: '', cycle: cycle, rmName: '', rmEmail: '', bhName: '', bhEmail: '' });
      loadEmployees();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Layout title="Employee / Cycle Selection">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <label className="form-label">Role</label>
          <select className="form-select w-48" value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
            {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Cycle</label>
          <select className="form-select w-48" value={cycle} onChange={(e) => setCycle(e.target.value)}>
            {cycles.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex gap-2 items-end" style={{paddingTop:'16px'}}>
          <button onClick={loadEmployees} className="btn-secondary" disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button onClick={() => setShowNewForm((v) => !v)} className="btn-primary">
            + Add New Cycle Row
          </button>
        </div>
      </div>

      {/* Status messages */}
      {error && <div className="bg-red-50 border border-red-200 rounded px-4 py-2 text-red-700 text-sm mb-3">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 rounded px-4 py-2 text-green-700 text-sm mb-3">{success}</div>}

      {/* New cycle row form */}
      {showNewForm && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold text-gray-600 uppercase mb-3">Add New RM Row</h3>
          <form onSubmit={handleCreateNewRow} className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: 'empCode',  label: 'Emp Code *',   required: true },
              { name: 'empName',  label: 'Emp Name *',   required: true },
              { name: 'cycle',    label: 'Cycle *',      required: true },
              { name: 'rmName',   label: 'RM Name',      required: false },
              { name: 'rmEmail',  label: 'RM Email',     required: false },
              { name: 'bhName',   label: 'BH Name',      required: false },
              { name: 'bhEmail',  label: 'BH Email',     required: false },
            ].map(({ name, label, required }) => (
              <div key={name}>
                <label className="form-label">{label}</label>
                <input
                  type="text"
                  value={newRow[name]}
                  onChange={(e) => setNewRow((p) => ({ ...p, [name]: e.target.value }))}
                  required={required}
                  className="form-input"
                  placeholder={name === 'cycle' ? cycle : ''}
                />
              </div>
            ))}
            <div className="col-span-2 md:col-span-4 flex gap-2">
              <button type="submit" className="btn-primary">Create Row</button>
              <button type="button" onClick={() => setShowNewForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Employee table */}
      <EmployeeTable
        employees={employees}
        onToggleSelect={handleToggleSelect}
        loadingPairId={loadingPairId}
      />

      <div className="mt-3 text-xs text-gray-400">
        {employees.length} record(s) shown for <strong>{roleKey}</strong> – <strong>{cycle}</strong>.
        Click <em>Select</em> to assign for RM assessment (row turns purple).
      </div>
    </Layout>
  );
}
