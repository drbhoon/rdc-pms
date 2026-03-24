/**
 * columnMap.js
 * Parses a Google Sheet header row and classifies columns by type.
 *
 * Column type classification is based on header naming conventions:
 *
 *   IDENTITY  : EMP_CODE, EMP_NAME, ROLE, CYCLE, ROW_TYPE, ASSESSMENT_PAIR_ID
 *   NARRATIVE : RECOMMENDATION, COMMENTS, GROWTH_POTENTIAL, KEY_REMARKS
 *   ROUTING   : RM_NAME, RM_EMAIL, BH_NAME, BH_EMAIL
 *   RATING    : headers matching /Q\d+_RATING/i
 *   COMMENT   : headers matching /Q\d+_COMMENT/i
 *   SYSTEM    : STATUS, LOCK_STATUS, SELECTION_FLAG, SELECTED_BY, SELECTED_ON,
 *               PARENT_RM_ROW, RM_SUBMITTED_ON, BH_SUBMITTED_ON,
 *               LAST_UPDATED_BY, LAST_UPDATED_ON
 *   OTHER     : everything else
 */

export const COLUMN_TYPES = {
  IDENTITY: 'identity',
  NARRATIVE: 'narrative',
  ROUTING: 'routing',
  RATING: 'rating',
  RATING_COMMENT: 'rating_comment',
  SYSTEM: 'system',
  OTHER: 'other',
};

const IDENTITY_COLS = new Set([
  'EMP_CODE', 'EMP_NAME', 'ROLE', 'CYCLE', 'ROW_TYPE', 'ASSESSMENT_PAIR_ID',
]);

const NARRATIVE_COLS = new Set([
  'RECOMMENDATION', 'COMMENTS', 'GROWTH_POTENTIAL', 'KEY_REMARKS',
]);

const ROUTING_COLS = new Set([
  'RM_NAME', 'RM_EMAIL', 'BH_NAME', 'BH_EMAIL',
]);

const SYSTEM_COLS = new Set([
  'STATUS', 'LOCK_STATUS', 'SELECTION_FLAG', 'SELECTED_BY', 'SELECTED_ON',
  'PARENT_RM_ROW', 'RM_SUBMITTED_ON', 'BH_SUBMITTED_ON',
  'LAST_UPDATED_BY', 'LAST_UPDATED_ON',
]);

/**
 * Classifies a single column header.
 * @param {string} header
 * @returns {string} one of COLUMN_TYPES
 */
export function classifyColumn(header) {
  const h = header.trim().toUpperCase();
  if (IDENTITY_COLS.has(h)) return COLUMN_TYPES.IDENTITY;
  if (NARRATIVE_COLS.has(h)) return COLUMN_TYPES.NARRATIVE;
  if (ROUTING_COLS.has(h)) return COLUMN_TYPES.ROUTING;
  if (SYSTEM_COLS.has(h)) return COLUMN_TYPES.SYSTEM;
  if (/^Q\d+_RATING$/i.test(h)) return COLUMN_TYPES.RATING;
  if (/^Q\d+_COMMENT$/i.test(h)) return COLUMN_TYPES.RATING_COMMENT;
  return COLUMN_TYPES.OTHER;
}

/**
 * Builds a column map from a header row array.
 * Returns { colName: colIndex (0-based) } and classified groups.
 *
 * @param {string[]} headers  e.g. ['EMP_CODE', 'EMP_NAME', ...]
 * @returns {{
 *   indexMap: Record<string, number>,   // header → 0-based col index
 *   groups: Record<string, string[]>,   // type → [header, ...]
 *   headers: string[]
 * }}
 */
export function buildColumnMap(headers) {
  const indexMap = {};
  const groups = {
    [COLUMN_TYPES.IDENTITY]: [],
    [COLUMN_TYPES.NARRATIVE]: [],
    [COLUMN_TYPES.ROUTING]: [],
    [COLUMN_TYPES.RATING]: [],
    [COLUMN_TYPES.RATING_COMMENT]: [],
    [COLUMN_TYPES.SYSTEM]: [],
    [COLUMN_TYPES.OTHER]: [],
  };

  headers.forEach((h, i) => {
    const key = h.trim().toUpperCase();
    indexMap[key] = i;
    const type = classifyColumn(h);
    groups[type].push(key);
  });

  return { indexMap, groups, headers };
}

/**
 * Converts a sheet row array to a named object using the column map.
 * @param {string[]} rowValues
 * @param {Record<string, number>} indexMap
 * @returns {Record<string, string>}
 */
export function rowToObject(rowValues, indexMap) {
  const obj = {};
  for (const [key, idx] of Object.entries(indexMap)) {
    obj[key] = rowValues[idx] ?? '';
  }
  return obj;
}

/**
 * Converts a named object back to a row array using the column map.
 * Fills gaps with empty strings.
 * @param {Record<string, string>} obj
 * @param {Record<string, number>} indexMap
 * @param {number} totalCols
 * @returns {string[]}
 */
export function objectToRow(obj, indexMap, totalCols) {
  const row = new Array(totalCols).fill('');
  for (const [key, value] of Object.entries(obj)) {
    const idx = indexMap[key.toUpperCase()];
    if (idx !== undefined) {
      row[idx] = value ?? '';
    }
  }
  return row;
}

/**
 * Returns a human-readable label from a column key.
 * e.g. "Q1_RATING" → "Q1 Rating"
 * @param {string} key
 * @returns {string}
 */
export function colLabel(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Returns the question groups (paired RATING + COMMENT fields).
 * @param {string[]} ratingCols   e.g. ['Q1_RATING', 'Q2_RATING']
 * @param {string[]} commentCols  e.g. ['Q1_COMMENT', 'Q2_COMMENT']
 * @returns {{ num: string, ratingKey: string, commentKey: string|null }[]}
 */
export function getQuestionGroups(ratingCols, commentCols) {
  const commentSet = new Set(commentCols);
  return ratingCols.map((r) => {
    const num = r.match(/Q(\d+)_RATING/i)?.[1] || '?';
    const commentKey = `Q${num}_COMMENT`;
    return {
      num,
      ratingKey: r,
      commentKey: commentSet.has(commentKey) ? commentKey : null,
    };
  });
}
