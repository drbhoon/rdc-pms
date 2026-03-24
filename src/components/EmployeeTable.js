/**
 * EmployeeTable.js
 * Displays employee rows for cycle selection.
 * Clicking a row with status "Pending RM" toggles its selection (purple highlight).
 */
import StatusBadge, { rowColorClass } from './StatusBadge';
import clsx from 'clsx';

export default function EmployeeTable({ employees, onToggleSelect, loadingPairId }) {
  if (!employees || employees.length === 0) {
    return (
      <div className="text-center text-gray-500 py-10">
        No employees found for this cycle. Use &quot;Add New Cycle Row&quot; to create entries.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-gray-200">
      <table className="data-table">
        <thead>
          <tr>
            <th>Emp Code</th>
            <th>Name</th>
            <th>Cycle</th>
            <th>Pair ID</th>
            <th>RM</th>
            <th>BH</th>
            <th>Status</th>
            <th>Lock</th>
            <th>Selected By</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => {
            const isLoading = loadingPairId === emp.ASSESSMENT_PAIR_ID;
            const canSelect = ['Pending RM', '', undefined].includes(emp.STATUS);
            const isSelected = emp.SELECTION_FLAG === 'Selected';

            return (
              <tr
                key={emp.ASSESSMENT_PAIR_ID || emp.EMP_CODE}
                className={clsx(rowColorClass(emp), 'transition-colors')}
              >
                <td className="font-mono font-semibold">{emp.EMP_CODE}</td>
                <td className="font-medium">{emp.EMP_NAME}</td>
                <td>{emp.CYCLE}</td>
                <td className="text-xs text-gray-500 font-mono">{emp.ASSESSMENT_PAIR_ID}</td>
                <td className="text-xs">{emp.RM_NAME}</td>
                <td className="text-xs">{emp.BH_NAME}</td>
                <td><StatusBadge status={emp.STATUS} /></td>
                <td><StatusBadge status={emp.LOCK_STATUS} /></td>
                <td className="text-xs text-gray-500">{emp.SELECTED_BY || '—'}</td>
                <td>
                  <div className="flex gap-1 flex-wrap">
                    {/* Select / Unselect toggle */}
                    {canSelect && (
                      <button
                        onClick={() => onToggleSelect(emp.ASSESSMENT_PAIR_ID)}
                        disabled={isLoading}
                        className={clsx(
                          'btn text-xs py-1 px-2',
                          isSelected
                            ? 'bg-purple-600 text-white hover:bg-purple-700'
                            : 'bg-purple-100 text-purple-800 hover:bg-purple-200 border border-purple-300'
                        )}
                      >
                        {isLoading ? '...' : isSelected ? '✓ Selected' : 'Select'}
                      </button>
                    )}

                    {/* RM Assessment link */}
                    {(emp.STATUS === 'Pending RM' || emp.STATUS === '') && emp.SELECTION_FLAG === 'Selected' && (
                      <a
                        href={`/assessment/rm?roleKey=${encodeURIComponent(emp.ROLE)}&pairId=${encodeURIComponent(emp.ASSESSMENT_PAIR_ID)}`}
                        className="btn bg-blue-500 text-white hover:bg-blue-600 text-xs py-1 px-2"
                      >
                        RM Form
                      </a>
                    )}

                    {/* BH Assessment link */}
                    {emp.STATUS === 'RM Submitted' && (
                      <a
                        href={`/assessment/bh?roleKey=${encodeURIComponent(emp.ROLE)}&pairId=${encodeURIComponent(emp.ASSESSMENT_PAIR_ID)}`}
                        className="btn bg-green-500 text-white hover:bg-green-600 text-xs py-1 px-2"
                      >
                        BH Form
                      </a>
                    )}

                    {/* View finalized */}
                    {emp.STATUS === 'Finalized' && (
                      <a
                        href={`/assessment/bh?roleKey=${encodeURIComponent(emp.ROLE)}&pairId=${encodeURIComponent(emp.ASSESSMENT_PAIR_ID)}&view=1`}
                        className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 text-xs py-1 px-2"
                      >
                        View
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
