/**
 * AssessmentForm.js
 * Dynamic assessment form that renders fields based on Google Sheet headers.
 * Used for both RM and BH assessment screens.
 *
 * Props:
 *   - formType: 'RM' | 'BH'
 *   - rm: RM row object (always present)
 *   - bh: BH row object (present after RM submits)
 *   - headers: column headers from sheet
 *   - onSubmit: async (values) => void
 *   - isLocked: boolean
 *   - isViewOnly: boolean
 */
import { useState } from 'react';
import { buildColumnMap, COLUMN_TYPES, colLabel, getQuestionGroups } from '../lib/columnMap';
import RatingDropdown, { RatingDisplay } from './RatingDropdown';

// Identity fields shown at the top (read-only)
const IDENTITY_DISPLAY = ['EMP_CODE', 'EMP_NAME', 'ROLE', 'CYCLE', 'ASSESSMENT_PAIR_ID'];

export default function AssessmentForm({ formType, rm, bh, headers, onSubmit, isLocked, isViewOnly }) {
  const sourceRow = formType === 'BH' ? bh : rm;
  const refRow    = formType === 'BH' ? rm  : null; // BH sees RM values for reference

  const { indexMap, groups } = buildColumnMap(headers || []);
  const ratingCols  = groups[COLUMN_TYPES.RATING] || [];
  const commentCols = groups[COLUMN_TYPES.RATING_COMMENT] || [];
  const narrativeCols = groups[COLUMN_TYPES.NARRATIVE] || [];
  const questionGroups = getQuestionGroups(ratingCols, commentCols);

  // Initialize form values from existing row data
  const initValues = () => {
    const v = {};
    [...narrativeCols, ...ratingCols, ...commentCols].forEach((col) => {
      v[col] = sourceRow?.[col] || '';
    });
    return v;
  };

  const [values, setValues] = useState(initValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const disabled = isLocked || isViewOnly || submitting;

  function handleChange(e) {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (!sourceRow && formType === 'BH') {
    return (
      <div className="card text-center text-gray-500 py-8">
        BH row not yet created. RM must submit their assessment first.
      </div>
    );
  }

  const displayRow = sourceRow || rm;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Employee Identity Panel ── */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Employee Details
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {IDENTITY_DISPLAY.map((col) => (
            displayRow?.[col] ? (
              <div key={col}>
                <div className="form-label">{colLabel(col)}</div>
                <div className="bg-gray-50 rounded px-3 py-2 text-sm font-medium border border-gray-200">
                  {displayRow[col]}
                </div>
              </div>
            ) : null
          ))}
        </div>

        {/* Routing info */}
        <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-gray-500">
          <div>
            <span className="font-semibold">RM:</span>{' '}
            {displayRow?.RM_NAME} ({displayRow?.RM_EMAIL})
          </div>
          <div>
            <span className="font-semibold">BH:</span>{' '}
            {displayRow?.BH_NAME} ({displayRow?.BH_EMAIL})
          </div>
        </div>

        {/* Status banner */}
        {isLocked && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">
            This assessment is <strong>locked</strong> and cannot be edited.
          </div>
        )}
        {isViewOnly && !isLocked && (
          <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-sm text-yellow-700">
            View mode — no changes can be made.
          </div>
        )}
        {formType === 'BH' && refRow && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded px-3 py-2 text-sm text-blue-700">
            RM values are shown alongside for reference. BH may keep or amend ratings.
          </div>
        )}
      </div>

      {/* ── Narrative Fields (near top per HR requirement) ── */}
      {narrativeCols.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            {formType === 'BH' ? `${formType} – ` : ''}Narrative / Recommendations
          </h2>
          <div className="space-y-4">
            {narrativeCols.map((col) => (
              <NarrativeField
                key={col}
                col={col}
                value={values[col]}
                rmValue={refRow?.[col]}
                formType={formType}
                disabled={disabled}
                onChange={handleChange}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Rating Questions ── */}
      {questionGroups.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            {formType === 'BH' ? `${formType} – ` : ''}Assessment Ratings
          </h2>
          <div className="space-y-6">
            {questionGroups.map((q) => (
              <QuestionGroup
                key={q.ratingKey}
                q={q}
                values={values}
                rmValues={refRow}
                formType={formType}
                disabled={disabled}
                onChange={handleChange}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Submit / Lock Status ── */}
      {!isViewOnly && (
        <div className="flex items-center gap-4">
          {!isLocked ? (
            <button type="submit" disabled={disabled} className="btn-primary">
              {submitting
                ? 'Submitting…'
                : formType === 'RM'
                ? 'Submit RM Assessment'
                : 'Submit BH Assessment & Finalize'}
            </button>
          ) : (
            <div className="text-sm text-gray-500 italic">
              Assessment submitted and locked.
            </div>
          )}
          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}
        </div>
      )}
    </form>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function NarrativeField({ col, value, rmValue, formType, disabled, onChange }) {
  return (
    <div>
      <label className="form-label">{colLabel(col)}</label>
      {formType === 'BH' && rmValue !== undefined && (
        <div className="mb-1 bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs text-blue-700">
          <span className="font-semibold">RM:</span> {rmValue || <em>—</em>}
        </div>
      )}
      <textarea
        name={col}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`form-textarea ${disabled ? 'field-locked' : ''}`}
        placeholder={disabled ? '' : `Enter ${colLabel(col).toLowerCase()}…`}
      />
    </div>
  );
}

function QuestionGroup({ q, values, rmValues, formType, disabled, onChange }) {
  const qLabel = `Question ${q.num}`;
  return (
    <div className="border border-gray-200 rounded p-4 bg-gray-50">
      <div className="font-medium text-gray-700 mb-3">{qLabel}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Rating */}
        <div>
          {formType === 'BH' && rmValues && (
            <div className="mb-1 text-xs text-blue-600 font-semibold">
              RM Rating: <RatingDisplay value={rmValues[q.ratingKey]} />
            </div>
          )}
          <RatingDropdown
            name={q.ratingKey}
            value={values[q.ratingKey]}
            onChange={onChange}
            disabled={disabled}
            label={`${formType} Rating`}
          />
        </div>

        {/* Comment */}
        {q.commentKey && (
          <div>
            {formType === 'BH' && rmValues && (
              <div className="mb-1 text-xs text-blue-600 font-semibold">
                RM Comment: {rmValues[q.commentKey] || <em>—</em>}
              </div>
            )}
            <label className="form-label">{formType} Comment</label>
            <textarea
              name={q.commentKey}
              value={values[q.commentKey] || ''}
              onChange={onChange}
              disabled={disabled}
              rows={2}
              className={`form-textarea ${disabled ? 'field-locked' : ''}`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
