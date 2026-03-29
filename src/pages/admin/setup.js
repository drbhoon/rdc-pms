/**
 * admin/setup.js — Role Template Management
 *
 * FLOW:
 *  Step 1 — Upload Excel: drag/drop → reads headers → goes to Step 2
 *  Step 2 — Review columns: assign routing, verify profile/question split → "Create Template"
 *
 * NO fixed column names required. Detection is dynamic from Excel headers.
 * Template name derived from filename (editable). Delete supported.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import AdminLayout from '../../components/AdminLayout';

// ── Column Classification ─────────────────────────────────────────────────────
// Returns one of: rm_name | rm_email | bh_name | bh_email |
//                 identity | profile | rating | narrative | number | date

const IDENTITY_KEYS = new Set(['EMP_CODE', 'EMP_NAME', 'EMPCODE', 'EMPNAME',
  'EMPLOYEE_CODE', 'EMPLOYEE_NAME', 'EMPLOYEE_ID', 'CYCLE', 'ROLE']);

function classifyHeader(header) {
  const raw = header.trim();
  const h   = raw.toUpperCase().replace(/\s+/g, '_');
  const orig = raw.toUpperCase();

  // ── Routing: reviewer (RM / BM / Reporting Manager)
  if (/^(RM|BM)_/i.test(raw)) {
    if (/name/i.test(raw))            return 'rm_name';
    if (/e?mail/i.test(raw))          return 'rm_email';  // handles typo BM_Emai
  }
  // ── Routing: approver (BH / Batch Head / Branch Head)
  if (/^BH_/i.test(raw)) {
    if (/name/i.test(raw))            return 'bh_name';
    if (/e?mail/i.test(raw))          return 'bh_email';
  }
  // Loose routing patterns (e.g. "Reporting Manager Email")
  if (/\b(rm|bm|reporting_?manager|batch_?manager)\b/i.test(raw)) {
    if (/name/i.test(raw))            return 'rm_name';
    if (/e?mail/i.test(raw))          return 'rm_email';
  }
  if (/\b(bh|batch_?head|branch_?head)\b/i.test(raw)) {
    if (/name/i.test(raw))            return 'bh_name';
    if (/e?mail/i.test(raw))          return 'bh_email';
  }

  // ── Fixed identity keys
  if (IDENTITY_KEYS.has(h)) return 'identity';

  // ── Profile (employee data, not a scored question)
  if (/\b(qualification|designation|department|plant|location|zone|region|division|branch|city|grade|level)\b/i.test(raw))
    return 'profile';

  // ── Numbered questions → rating  (handles leading spaces too)
  if (/^\s*\d+[\.\)]\s/.test(raw))   return 'rating';
  if (/^Q\d+_RATING$/i.test(raw))    return 'rating';

  // ── Date
  if (/\b(date|doj|dob|joining|born|since|expir)/i.test(raw)) return 'date';

  // ── Number
  if (/\b(stipend|salary|amount|volume|count|strength|number)\b/i.test(raw)) return 'number';

  // ── Narrative
  if (/\b(recommend|absorption|comment|remark|observation|feedback|summary|potential|suggestion|justification|sales)\b/i.test(raw))
    return 'narrative';

  // Unknown → profile (safer default — HR can promote to question)
  return 'profile';
}

// Question types the HR can switch between
const Q_TYPES = ['rating', 'narrative', 'number', 'date', 'profile'];
const Q_LABELS = {
  rating:    'Rating (1–5)',
  narrative: 'Narrative (text)',
  number:    'Number',
  date:      'Date',
  profile:   'Profile / Info (not a question)',
};
const Q_BADGE = {
  rating:    'bg-blue-100 text-blue-700',
  narrative: 'bg-purple-100 text-purple-700',
  number:    'bg-amber-100 text-amber-700',
  date:      'bg-green-100 text-green-700',
  profile:   'bg-slate-100 text-slate-500',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function slugify(name) {
  return name
    .replace(/\.[^/.]+$/, '')          // remove extension
    .replace(/[^a-zA-Z0-9]+/g, '-')   // non-alphanum → dash
    .replace(/^-+|-+$/g, '')           // trim dashes
    .toUpperCase()
    .slice(0, 40);
}

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5 shadow-2xl text-sm font-medium max-w-sm
      ${type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
      {type === 'error'
        ? <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
        : <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
      }
      {message}
    </div>
  );
}

// ── STEP 1: Upload drop zone ──────────────────────────────────────────────────
function UploadZone({ onParsed }) {
  const [dragging, setDragging] = useState(false);
  const [err, setErr]           = useState('');
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
          if (cell && cell.v != null) headers.push(String(cell.v).trim());
        }
        if (!headers.length) { setErr('No headers found in first row.'); return; }
        onParsed(file.name, headers);
      } catch { setErr('Could not parse Excel. Ensure it is a valid .xlsx/.xls file.'); }
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <div className="max-w-xl mx-auto">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
        onClick={() => fileRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed px-8 py-14 text-center cursor-pointer transition-all
          ${dragging ? 'border-blue-400 bg-blue-50 scale-[1.01]' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/40'}`}
      >
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={(e) => { const f = e.target.files[0]; if (f) parseFile(f); }} />
        <svg className="mx-auto w-12 h-12 text-slate-300 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="text-base font-semibold text-slate-700 mb-1">Drop your Assessment Excel here</p>
        <p className="text-sm text-slate-400">or click to browse — supports .xlsx and .xls</p>
        <p className="text-xs text-slate-300 mt-3">Column headers from your file will become questions automatically</p>
      </div>
      {err && <p className="mt-3 text-sm text-red-600 text-center">{err}</p>}
    </div>
  );
}

// ── STEP 2: Column review & confirm ──────────────────────────────────────────
function ReviewPanel({ filename, headers, onCreated, onBack }) {
  // Initialise columns with auto-classification
  const [cols, setCols] = useState(() =>
    headers.map((h) => ({ header: h, type: classifyHeader(h) }))
  );
  const [templateName, setTemplateName] = useState(
    filename.replace(/\.[^/.]+$/, '') // strip extension
  );
  const [roleKey, setRoleKey]   = useState(slugify(filename));
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);

  // Derived groups
  const rmNameCandidates  = cols.filter((c) => c.type === 'rm_name');
  const rmEmailCandidates = cols.filter((c) => c.type === 'rm_email');
  const bhNameCandidates  = cols.filter((c) => c.type === 'bh_name');
  const bhEmailCandidates = cols.filter((c) => c.type === 'bh_email');

  const [rmNameCol,  setRmNameCol]  = useState(rmNameCandidates[0]?.header  || '');
  const [rmEmailCol, setRmEmailCol] = useState(rmEmailCandidates[0]?.header || '');
  const [bhNameCol,  setBhNameCol]  = useState(bhNameCandidates[0]?.header  || '');
  const [bhEmailCol, setBhEmailCol] = useState(bhEmailCandidates[0]?.header || '');

  // All non-routing columns
  const nonRoutingCols = cols.filter((c) =>
    !['rm_name', 'rm_email', 'bh_name', 'bh_email'].includes(c.type)
  );
  const identityCols  = nonRoutingCols.filter((c) => c.type === 'identity');
  const profileCols   = nonRoutingCols.filter((c) => c.type === 'profile');
  const questionCols  = nonRoutingCols.filter((c) =>
    ['rating', 'narrative', 'number', 'date'].includes(c.type)
  );

  function updateType(header, newType) {
    setCols((prev) => prev.map((c) => c.header === header ? { ...c, type: newType } : c));
  }

  // All possible routing columns (all non-identity for flexible assignment)
  const allColHeaders = cols.map((c) => c.header);

  async function handleCreate() {
    if (!roleKey.trim())       return setToast({ message: 'Template Key is required.', type: 'error' });
    if (!templateName.trim())  return setToast({ message: 'Template Name is required.', type: 'error' });
    if (!questionCols.length)  return setToast({ message: 'No question columns found. Mark some columns as Rating / Narrative / Number / Date.', type: 'error' });

    const questions = questionCols.map((c, i) => ({
      question_key:   c.header,
      question_label: c.header,
      field_type:     c.type,
      display_order:  i + 1,
    }));
    const profileColsData = [...identityCols, ...profileCols].map((c) => ({
      key: c.header, label: c.header, field_type: c.type,
    }));

    setSaving(true);
    try {
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleKey: roleKey.trim().toUpperCase(),
          roleLabel: templateName.trim(),
          filename,
          questions,
          profileCols: profileColsData,
          rmNameCol:  rmNameCol  || null,
          rmEmailCol: rmEmailCol || null,
          bhNameCol:  bhNameCol  || null,
          bhEmailCol: bhEmailCol || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setToast({
        message: `✓ Template "${roleKey.toUpperCase()}" created — ${questions.length} questions, ${profileColsData.length} profile fields.`,
        type: 'success',
      });
      setTimeout(() => onCreated(), 1500);
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
      setSaving(false);
    }
  }

  const routingCols = cols.filter((c) =>
    ['rm_name', 'rm_email', 'bh_name', 'bh_email'].includes(c.type)
  );

  return (
    <div className="space-y-5">
      {/* Template identity */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Template Identity</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input value={templateName} onChange={(e) => setTemplateName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            <p className="text-xs text-slate-400 mt-1">Auto-filled from filename — edit as needed</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Template Key (short code) <span className="text-red-500">*</span>
            </label>
            <input value={roleKey} onChange={(e) => setRoleKey(e.target.value.toUpperCase())}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            <p className="text-xs text-slate-400 mt-1">Used in URLs — e.g. COLTS-T, PI, GET</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          <span className="font-medium text-slate-500">Source file:</span> {filename}
          &nbsp;·&nbsp; <span className="font-medium text-slate-500">Total columns:</span> {headers.length}
          &nbsp;·&nbsp; <span className="font-medium text-slate-500">Questions detected:</span> {questionCols.length}
          &nbsp;·&nbsp; <span className="font-medium text-slate-500">Profile fields:</span> {identityCols.length + profileCols.length}
        </p>
      </div>

      {/* Routing fields */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-3.5 h-3.5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Reviewer & Approver Routing Fields</h3>
            <p className="text-xs text-slate-400 mt-0.5">Which columns hold the Reviewer (RM/BM) and Approver (BH) name and email? These are used to send form links.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Reviewer Name column', val: rmNameCol,  set: setRmNameCol },
            { label: 'Reviewer Email column', val: rmEmailCol, set: setRmEmailCol },
            { label: 'Approver Name column',  val: bhNameCol,  set: setBhNameCol },
            { label: 'Approver Email column', val: bhEmailCol, set: setBhEmailCol },
          ].map(({ label, val, set }) => (
            <div key={label}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              <select value={val} onChange={(e) => set(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 px-2 py-1.5 focus:border-blue-400 focus:outline-none bg-white">
                <option value="">— not set —</option>
                {allColHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
        </div>
        {routingCols.length > 0 && (
          <p className="text-xs text-slate-400 mt-3">
            Auto-detected routing columns: {routingCols.map((c) => (
              <span key={c.header} className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-mono">{c.header}</span>
            ))}
          </p>
        )}
      </div>

      {/* Profile / Identity fields */}
      {(identityCols.length + profileCols.length) > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Employee Profile Fields</h3>
              <p className="text-xs text-slate-400 mt-0.5">These columns are stored as employee data — not scored in the assessment form.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[...identityCols, ...profileCols].map((c) => (
              <span key={c.header}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium">
                {c.header}
                <span className="text-slate-400 text-[10px]">{c.type === 'identity' ? '(id)' : '(info)'}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Question columns */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-3.5 h-3.5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Assessment Questions ({questionCols.length})</h3>
            <p className="text-xs text-slate-400 mt-0.5">Adjust type if auto-detection is wrong. Move to "Profile / Info" to exclude from assessment.</p>
          </div>
        </div>

        {questionCols.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No question columns detected. Check the non-routing columns below and change their type.</p>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-slate-500 font-semibold w-8">#</th>
                  <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Column Header (becomes question label)</th>
                  <th className="px-3 py-2.5 text-left text-slate-500 font-semibold w-44">Field Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {nonRoutingCols.map((c, i) => {
                  const isQ = ['rating', 'narrative', 'number', 'date'].includes(c.type);
                  if (!isQ) return null;
                  const qNum = questionCols.findIndex((q) => q.header === c.header) + 1;
                  return (
                    <tr key={c.header} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 text-slate-400">{qNum}</td>
                      <td className="px-3 py-2 text-slate-700 max-w-xs" title={c.header}>
                        <span className="truncate block">{c.header}</span>
                      </td>
                      <td className="px-3 py-2">
                        <select value={c.type}
                          onChange={(e) => updateType(c.header, e.target.value)}
                          className="w-full text-xs rounded border border-slate-200 px-1.5 py-1 focus:border-blue-400 focus:outline-none bg-white">
                          {Q_TYPES.map((t) => <option key={t} value={t}>{Q_LABELS[t]}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Show profile columns with option to promote to question */}
        {profileCols.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
              {profileCols.length} column(s) classified as Profile — click to expand and promote to questions if needed
            </summary>
            <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {profileCols.map((c) => (
                    <tr key={c.header} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 text-slate-500 max-w-xs truncate">{c.header}</td>
                      <td className="px-3 py-2 w-44">
                        <select value={c.type}
                          onChange={(e) => updateType(c.header, e.target.value)}
                          className="w-full text-xs rounded border border-slate-200 px-1.5 py-1 bg-white">
                          {Q_TYPES.map((t) => <option key={t} value={t}>{Q_LABELS[t]}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 border border-slate-300 hover:bg-slate-50 transition-all">
          ← Back
        </button>
        <button onClick={handleCreate} disabled={saving}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-all">
          {saving ? 'Creating Template…' : `✓ Create Template (${questionCols.length} questions)`}
        </button>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── Template List ─────────────────────────────────────────────────────────────
function TemplateList({ refreshKey }) {
  const [roles, setRoles]       = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast]       = useState(null);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/templates').then((r) => r.json())
      .then((d) => setRoles(d.roles || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load, refreshKey]);

  async function handleDelete(roleKey, roleLabel) {
    if (!confirm(`Delete template "${roleLabel}" (${roleKey})?\n\nNote: existing assessment data is preserved — only the template definition is removed.`))
      return;
    setDeleting(roleKey);
    try {
      const res = await fetch(`/api/admin/templates?key=${encodeURIComponent(roleKey)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setToast({ message: `Template "${roleKey}" deleted.`, type: 'success' });
      load();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setDeleting(null);
    }
  }

  const typeBadge = (t) => ({
    rating: 'bg-blue-100 text-blue-700', narrative: 'bg-purple-100 text-purple-700',
    number: 'bg-amber-100 text-amber-700', date: 'bg-green-100 text-green-700',
  }[t] || 'bg-slate-100 text-slate-500');

  if (loading) return (
    <div className="space-y-3">
      {[0,1,2].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
    </div>
  );

  return (
    <>
      {roles.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <svg className="mx-auto w-12 h-12 text-slate-200 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-sm">No templates yet. Upload your first assessment Excel file.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((r) => (
            <div key={r.roleKey} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              {/* Header row */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded shrink-0">
                    {r.roleKey}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{r.roleLabel}</p>
                    {r.filename && <p className="text-xs text-slate-400 truncate">{r.filename}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-500 hidden sm:block">
                    {r.questions?.length ?? 0} questions
                  </span>
                  <button onClick={() => setExpanded(expanded === r.roleKey ? null : r.roleKey)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-all">
                    {expanded === r.roleKey ? 'Hide' : 'View'}
                  </button>
                  <button
                    onClick={() => handleDelete(r.roleKey, r.roleLabel)}
                    disabled={deleting === r.roleKey}
                    className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-all disabled:opacity-40">
                    {deleting === r.roleKey ? '…' : 'Delete'}
                  </button>
                </div>
              </div>

              {/* Routing info */}
              {expanded === r.roleKey && (
                <div className="px-4 py-3 border-b border-slate-100 bg-indigo-50/50">
                  <p className="text-xs font-semibold text-indigo-700 mb-2">Routing Fields</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
                    <span><span className="text-slate-400">Reviewer Name:</span> {r.rmNameCol || <em className="text-slate-300">not set</em>}</span>
                    <span><span className="text-slate-400">Reviewer Email:</span> {r.rmEmailCol || <em className="text-slate-300">not set</em>}</span>
                    <span><span className="text-slate-400">Approver Name:</span> {r.bhNameCol || <em className="text-slate-300">not set</em>}</span>
                    <span><span className="text-slate-400">Approver Email:</span> {r.bhEmailCol || <em className="text-slate-300">not set</em>}</span>
                  </div>
                </div>
              )}

              {/* Questions table */}
              {expanded === r.roleKey && r.questions?.length > 0 && (
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-white border-b border-slate-100 sticky top-0">
                      <tr>
                        {['#', 'Question / Column', 'Type'].map((h) => (
                          <th key={h} className="px-4 py-2 text-left font-semibold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {r.questions.map((q, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                          <td className="px-4 py-2 text-slate-700 max-w-sm" title={q.question_label}>
                            <span className="truncate block">{q.question_label}</span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${typeBadge(q.field_type)}`}>
                              {q.field_type}
                            </span>
                          </td>
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SetupPage({ user }) {
  const [step, setStep]         = useState(1); // 1 = upload, 2 = review
  const [filename, setFilename] = useState('');
  const [headers, setHeaders]   = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleParsed(name, hdrs) {
    setFilename(name);
    setHeaders(hdrs);
    setStep(2);
  }

  function handleCreated() {
    setStep(1);
    setFilename('');
    setHeaders([]);
    setRefreshKey((k) => k + 1);
  }

  return (
    <AdminLayout title="Role Templates" user={user}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

        {/* Left: Upload or Review */}
        <div>
          {step === 1 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-6">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                <h2 className="text-sm font-semibold text-slate-700">Upload Assessment Excel</h2>
              </div>
              <UploadZone onParsed={handleParsed} />
              <div className="mt-6 p-4 bg-slate-50 rounded-xl text-xs text-slate-500 space-y-1.5">
                <p className="font-semibold text-slate-600">What happens automatically:</p>
                <p>• Column headers become assessment questions</p>
                <p>• Routing columns (BM_Name, BH_Name, RM_Email etc.) auto-detected</p>
                <p>• Numbered columns (1. ... 14. ...) become rating questions</p>
                <p>• Profile fields (Qualification, Designation etc.) stored but not scored</p>
                <p>• You can adjust any classification before creating the template</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold">1</span>
                <span className="w-4 h-px bg-slate-300" />
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                <h2 className="text-sm font-semibold text-slate-700">Review Columns & Create Template</h2>
              </div>
              <ReviewPanel
                filename={filename}
                headers={headers}
                onCreated={handleCreated}
                onBack={() => setStep(1)}
              />
            </div>
          )}
        </div>

        {/* Right: Template library */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Template Library</h2>
            <span className="text-xs text-slate-400">Click View to see questions</span>
          </div>
          <TemplateList refreshKey={refreshKey} />
        </div>
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
