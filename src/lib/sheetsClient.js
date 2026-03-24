/**
 * sheetsClient.js
 * Provides an authenticated Google Sheets API client.
 *
 * Authentication: Google Service Account
 * The full service account JSON must be stored in the env var
 * GOOGLE_SERVICE_ACCOUNT_KEY (as a single-line JSON string).
 *
 * In MOCK_MODE=true, this module is not used — see mockStore.js instead.
 */

import { google } from 'googleapis';

let _sheetsClient = null;

/**
 * Returns a singleton authenticated Google Sheets client.
 * @returns {import('googleapis').sheets_v4.Sheets}
 */
export function getSheetsClient() {
  if (_sheetsClient) return _sheetsClient;

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_KEY is not set. ' +
      'Set MOCK_MODE=true to run without Google credentials.'
    );
  }

  let credentials;
  try {
    credentials = JSON.parse(keyJson);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  _sheetsClient = google.sheets({ version: 'v4', auth });
  return _sheetsClient;
}

/**
 * Returns a singleton authenticated Google Drive client (used for some sheet ops).
 * @returns {import('googleapis').drive_v3.Drive}
 */
export function getDriveClient() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set.');
  }
  const credentials = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
  return google.drive({ version: 'v3', auth });
}
