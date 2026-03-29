/**
 * admin/setup.js
 * Role Templates — upload Excel → headers auto-become questions.
 * No mandatory column structure. System classifies each header automatically.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import AdminLayout from '../../components/AdminLayout';

// Column classification logic (mirrors server-side columnMap.js)
const ROUTING_COLS = new Set(['RM_NAME', 'RM_EMAIL', 'BH_NAME', 'BH_EMAIL']);
const IDENTITY_COLS = new Set([
  'EMP_CODE', 'EMP_NAME', 'ROLE', 'CYCLE', 'ROW_TYPE',
  'EMPLOYEE_CODE', 'EMPLOYEE_NAME', 'EMPLOYEE_ID',
]);
const SYSTEM_COLS = new Set([
  'STATUS', 'LOCK_STATUS', 'SELECTION_FLAG', 'SELECTED_BY', 'SELECTED_ON',
  'PARENT_RM_ROW', 'RM_SUBMITTED_ON', 'BH_SUBMITTED_ON',
  'LAST_UPDATED_BY', 'LAST_UPDATED_ON', 'ASSESSMENT_PAIR_ID',
]);

function classifyHeader(header) {
  const h = header.trim().toUpperCase();
  if (ROUTING_COLS.has(h)) return 'routing';
  if (IDENTITY_COLS.has(h)) return 'identity';
  if (SYSTEM_COLS.has(h)) return 'system';
  if (/^Q\d+_RATING$/i.test(h)) return 'rating';
  if (/^\d+[\.\)]\s/.test(header.trim())) return 'rating';
  if (/\b(DATE|DOJ|DOB|JOINING|BORN|SINCE|EXPIR)\b/.test(h)) return 'date';
  if (/\b(STIPEND|SALARY|AMOUNT|VOLUME|COUNT|STRENGTH|NUMBER)\b/.test(h)) return 'number';
  if (/\bRECOMMEND(ATION)?\b/.test(h)) return 'narrative';
  if (/\b(COMMENT|REMARK|OBSERVATION|FEEDBACK|SUMMARY|POTENTIAL|SUGGESTION)\b/.test(h)) return 'narrative';
  return 'rating';
}

const TYPE_OPTIONS = ['rating', 'narrative', 'number', 'date'];
const TYPE_LABEL = {
  rating: 'Rating (1-5)',
  narrative: 'Narrative (text)',
  number: 'Number',
  date: 'Date',
};

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const id = setTimeout(onClose, 4000);
    return () => clearTimeout(id);
  }, [onClose]);
  const base =
    'fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5 shadow-2xl text-sm font-medium max-w-sm';
  return (
    <div className={`${base} ${type === 'error' ? 'bg-red-600' : 'bg-emerald-600'} text-white`}>
      {type === 'error' ? (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {message}
    </div>
  );
}

function UploadPanel({ onSaved }) {
  const [roleKey, setRoleKey] = useState('');
  const [roleLabel, setRoleLabel] = useState('');
  const [fileName, setFileName] = useState('');
  const [columns, setColumns] = useState([]); // [{header, type}]
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const fileRef = useRef();

  function parseFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        const headers = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
          if (cell && cell.v) headers.push(String(cell.v).trim());
        }
        if (!headers.length) {
          return setToast({ message: 'No headers found in Excel.', type: 'error' });
        }
        setColumns(headers.map((h) => ({ header: h, type: classifyHeader(h) })));
        setFileName(file.name);
      } catch {
        setToast({ message: 'Could not parse Excel file.', type: 'error' });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const questionCols = columns.filter((c) => !['routing', 'identity', 'system'].includes(c.type));
  const workflowCols = columns.filter((c) => ['routing', 'identity'].includes(c.type));

  function updateType(idx, newType) {
    setColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, type: newType } : c)));
  }

  async function handleSave() {
    if (!roleKey.trim()) return setToast({ message: 'Role Key is required.', type: 'error' });
    if (!roleLabel.trim()) return setToast({ message: 'Role Label is required.', type: 'error' });
    if (!columns.length) return setToast({ message: 'Please upload an Excel file first.', type: 'error' });
    if (!questionCols.length)
      return setToast({ message: 'No question columns found. Check your Excel headers.', type: 'error' });

    const questions = questionCols.map((c, i) => ({
      question_key: c.header,
      question_label: c.header,
      field_type: c.type,
      display_order: i + 1,
    }));

    setSaving(true);
    try {
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleKey: roleKey.trim().toUpperCase(),
          roleLabel: roleLabel.trim(),
          questions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setToast({
        message: `Template "${roleKey.toUpperCase()}" saved — ${questions.length} questions.`,
        type: 'success',
      });
      setRoleKey('');
      setRoleLabel('');
      setColumns([]);
      setFileName('');
      onSaved();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
      <h2 className="text-sm font-semibold text-slate-700">Upload New Template</h2>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Role Key <span className="text-red-500">*</span>
        </label>
        <input
          value={roleKey}
          onChange={(e) => setRoleKey(e.target.value)}
          placeholder="e.g. COLTS, PI, GET"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Role Label <span className="text-red-500">*</span>
        </label>
        <input
          value={roleLabel}
          onChange={(e) => setRoleLabel(e.target.value)}
          placeholder="e.g. COLTS Trainee, Plant Incharge"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {/* Drop zone */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Assessment Excel File</label>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) parseFile(f);
          }}
          onClick={() => fileRef.current?.click()}
          className={`rounded-xl border-2 border-dashed px-6 py-7 text-center cursor-pointer transition-all ${
            dragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/40'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files[0];
              if (f) parseFile(f);
            }}
          />
          <svg
            className="mx-auto w-8 h-8 text-slate-400 mb-2"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.091 11.096H6.75z"
            />
          </svg>
          {fileName ? (
            <p className="text-sm font-medium text-blue-600 truncate">{fileName}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-600">
                Drop your Excel here or <span className="text-blue-600">browse</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Column headers become questions — no fixed format required
              </p>
            </>
          )}
        </div>
      </div>

      {/* Column preview */}
      {columns.length > 0 && (
        <>
          {workflowCols.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5">
                Workflow / Employee fields{' '}
                <span className="font-normal text-slate-400">(auto-excluded from questions)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {workflowCols.map((c) => (
                  <span
                    key={c.header}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    {c.header}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">
              Assessment Questions ({questionCols.length}){' '}
              <span className="font-normal text-slate-400">— adjust type if needed</span>
            </p>
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-500 font-medium w-8">#</th>
                    <th className="px-3 py-2 text-left text-slate-500 font-medium">Column Header</th>
                    <th className="px-3 py-2 text-left text-slate-500 font-medium w-36">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {columns.map((c, idx) => {
                    if (['routing', 'identity', 'system'].includes(c.type)) return null;
                    const qNum = questionCols.findIndex((q) => q === c) + 1;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2 text-slate-400">{qNum}</td>
                        <td className="px-3 py-2 text-slate-700 truncate max-w-xs" title={c.header}>
                          {c.header}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={c.type}
                            onChange={(e) => updateType(idx, e.target.value)}
                            className="w-full text-xs rounded border border-slate-200 px-1.5 py-1 focus:border-blue-400 focus:outline-none bg-white"
                          >
                            {TYPE_OPTIONS.map((t) => (
                              <option key={t} value={t}>
                                {TYPE_LABEL[t]}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-all"
      >
        {saving ? 'Saving…' : `Save Template${questionCols.length ? ` (${questionCols.length} questions)` : ''}`}
      </button>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function TemplateList({ refreshKey }) {
  const [roles, setRoles] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/templates')
      .then((r) => r.json())
      .then((d) => setRoles(d.roles || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading)
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Existing Templates</h2>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">Existing Templates</h2>
      {roles.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="mx-auto w-10 h-10 text-slate-300 mb-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <p className="text-sm text-slate-400">No templates yet. Upload one on the left.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((r) => (
            <div key={r.roleKey} className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    {r.roleKey}
                  </span>
                  <span className="text-sm font-medium text-slate-700">{r.roleLabel}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{r.questions?.length ?? 0} questions</span>
                  <button
                    onClick={() => setExpanded(expanded === r.roleKey ? null : r.roleKey)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {expanded === r.roleKey ? 'Hide' : 'View'}
                  </button>
                </div>
              </div>
              {expanded === r.roleKey && r.questions?.length > 0 && (
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-white border-b border-slate-100 sticky top-0">
                      <tr>
                        {['#', 'Question / Column', 'Type'].map((h) => (
                          <th key={h} className="px-4 py-2 text-left font-semibold text-slate-500">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {r.questions.map((q, i) => {
                        const badge =
                          {
                            rating: 'bg-blue-100 text-blue-700',
                            narrative: 'bg-purple-100 text-purple-700',
                            number: 'bg-amber-100 text-amber-700',
                            date: 'bg-green-100 text-green-700',
                          }[q.field_type] || 'bg-slate-100 text-slate-500';
                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                            <td
                              className="px-4 py-2 text-slate-700 max-w-xs truncate"
                              title={q.question_label}
                            >
                              {q.question_label}
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge}`}
                              >
                                {q.field_type}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SetupPage({ user }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const handleSaved = useCallback(() => setRefreshKey((k) => k + 1), []);
  return (
    <AdminLayout title="Role Templates" user={user}>
      <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 leading-relaxed">
        <strong>How templates work:</strong> Upload your assessment Excel file. The system reads column
        headers and builds questions from them automatically. Columns named{' '}
        <strong>RM_NAME, RM_EMAIL, BH_NAME, BH_EMAIL, EMP_CODE, EMP_NAME, CYCLE</strong> are
        treated as workflow fields and auto-excluded. You can adjust the detected type (Rating /
        Narrative / Number / Date) for any column before saving.
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UploadPanel onSaved={handleSaved} />
        <TemplateList refreshKey={refreshKey} />
      </div>
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
