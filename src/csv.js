import { REQUIRED_COLUMNS } from './constants.js';

/**
 * Minimal RFC4180-style CSV parser for SPVM actes-criminels.csv
 */

export function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }
    if (c === ',' && !quoted) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * @param {string} text
 * @returns {{ headers: string[], rows: Record<string, string>[] }}
 */
export function parseCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (values[j] ?? '').trim();
    }
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * @param {string[]} headers
 */
export function validateRequiredColumns(headers) {
  const missing = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
  return { ok: missing.length === 0, missing };
}
