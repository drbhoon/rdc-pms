/**
 * admin/setup.js
 * Role Templates — upload new template from Excel, view existing templates.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import AdminLayout from '../../components/AdminLayout';

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const id = setTimeout(onClose, 3500);
    return () => clearTimeout(id);
  }, [onClose]);
  const base = 'fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5 shadow-xl text-sm font-medium';
  const cls = type === 'error'
    ? `${base} bg-red-600 text-white`
    : `${base} bg-green-600 text-white`;
  return (
    <div className={cls}>
      {type === 'error'
        ? <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
        : <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
      }
      {message}
    </div>
  );
}

// ── Upload panel ──────────────────────────────────────────────────────────────
function UploadPanel({ onSaved }) {
  const [roleKey, setRoleKey]         = useState('');
  const [roleLabel, setRoleLabel]     = useState('');
  const [questions, setQuestions]     = useState([]);
  const [fileName, setFileName]       = useState('');
  const [dragging, setDragging]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState(null);
  const fileRef = useRef();

  function parseFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        setQuestions(rows);
        setFileName(file.name);
      } catch {
        setToast({ message: 'Could not parse Excel file. Please check the format.', type: 'error' });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) parseFile(file);
  }

  async function handleSave() {
    if (!roleKey.trim()) return setToast({ message: 'Role Key is required.', type: 'error' });
    if (!roleLabel.trim()) return setToast({ message: 'Role Label is required.', type: 'error' });
    if (!questions.length) return setToast({ message: 'Please upload an Excel file first.', type: 'error' });
    setSaving(true);
    try {
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleKey: roleKey.trim().toUpperCase(), roleLabel: roleLabel.trim(), questions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setToast({ message: `Template "${roleKey.toUpperCase()}" saved successfully!`, type: 'success' });
      setRoleKey(''); setRoleLabel(''); setQuestions([]); setFileName('');
      onSaved();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-slate-700 mb-5">Upload New Template</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Role Key <span className="text-red-500">*</span></label>
          <input
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value)}
            placeholder="e.g. COLTS, PI, GET"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Role Label <span className="text-red-500">*</span></label>
          <input
            value={roleLabel}
            onChange={(e) => setRoleLabel(e.target.value)}
            placeholder="e.g. COLTS Trainee"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Drop zone */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Excel File <span className="text-red-500">*</span></label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`rounded-xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-all ${
              dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/40'
            }`}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
            <svg className="mx-auto w-8 h-8 text-slate-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.091 11.096H6.75z" />
            </svg>
            {fileName ? (
              <p className="text-sm font-medium text-blue-600">{fileName}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-600">Drop Excel file here or <span className="text-blue-600">browse</span></p>
                <p className="text-xs text-slate-400 mt-1">Supports .xlsx and .xls</p>
              </>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Required columns: <code className="bg-slate-100 px-1 rounded">question_key</code> | <code className="bg-slate-100 px-1 rounded">question_label</code> | <code className="bg-slate-100 px-1 rounded">field_type</code> | <code className="bg-slate-100 px-1 rounded">display_order</code>
            &nbsp;— field_type: <em>rating, narrative, number, date</em>
          </p>
        </div>

        {/* Preview */}
        {questions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-600 mb-1">Preview ({questions.length} questions)</p>
            <div className="overflow-x-auto max-h-48 border border-slate-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {Object.keys(questions[0]).map((k) => (
                      <th key={k} className="px-3 py-2 text-left font-semibold text-slate-500 border-b border-slate-200">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {questions.map((q, i) => (
                    <tr key={i}>
                      {Object.values(q).map((v, j) => (
                        <td key={j} className="px-3 py-2 text-slate-700 whitespace-nowrap">{String(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        >
          {saving ? 'Saving…' : 'Save Template'}
        </button>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── Templates list ────────────────────────────────────────────────────────────
function TemplateList({ refreshKey }) {
  const [templates, setTemplates] = useState([]);
  const [expanded, setExpanded]   = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/templates')
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Existing Templates</h2>
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" />
        ))}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">Existing Templates</h2>
      {templates.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No templates yet. Upload one on the left.</p>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.roleKey} className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t.roleKey}</span>
                  <span className="text-sm font-medium text-slate-700">{t.roleLabel}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{t.questions?.length ?? 0} questions</span>
                  <button
                    onClick={() => setExpanded(expanded === t.roleKey ? null : t.roleKey)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    {expanded === t.roleKey ? 'Hide' : 'View Questions'}
                  </button>
                </div>
              </div>
              {expanded === t.roleKey && t.questions?.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-white border-b border-slate-100">
                      <tr>
                        {['#', 'Key', 'Label', 'Type', 'Order'].map((h) => (
                          <th key={h} className="px-4 py-2 text-left font-semibold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {t.questions.map((q, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                          <td className="px-4 py-2 font-mono text-slate-600">{q.question_key}</td>
                          <td className="px-4 py-2 text-slate-700 max-w-xs truncate">{q.question_label}</td>
                          <td className="px-4 py-2">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{q.field_type}</span>
                          </td>
                          <td className="px-4 py-2 text-slate-500">{q.display_order}</td>
                        </tr>
                      ))}
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SetupPage({ user }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const handleSaved = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <AdminLayout title="Role Templates" user={user}>
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
