import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPVM_SOURCE_URL } from './constants.js';
import {
  serializeGeojson,
  serializeStatus,
  transformSpvmCsv,
  validateTransformResult
} from './transform.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE_DIR = resolve(ROOT, '_site');
const SPVM_DIR = resolve(SITE_DIR, 'spvm');

const USER_AGENT = 'IQAI-SPVM-Data-Pipeline/1.0 (+https://github.com/EnlightenedAI-Lab/iqai-spvm-data)';

/**
 * @param {string} url
 */
export async function downloadSpvmCsv(url = SPVM_SOURCE_URL) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT }
  });

  if (!response.ok) {
    throw new Error(`SPVM CSV download failed: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!text || text.length < 1000) {
    throw new Error('SPVM CSV download too small or empty');
  }

  return { text, contentType, byteSize: Buffer.byteLength(text, 'utf8') };
}

/**
 * @param {string} statusJson
 */
export function buildIndexHtml(status) {
  const categories = (status.categories || []).slice(0, 5)
    .map((entry) => `<li>${escapeHtml(entry.category)} — ${entry.count}</li>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IQAI SPVM Data Service</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.5; max-width: 52rem; }
    h1 { font-size: 1.4rem; }
    code { background: #f4f4f4; padding: 0.1rem 0.3rem; }
    ul { padding-left: 1.2rem; }
  </style>
</head>
<body>
  <h1>IQAI SPVM Data Service</h1>
  <p>Automated rolling 90-day operational subset of Ville de Montréal / SPVM open crime data.</p>
  <p><strong>Status:</strong> ${escapeHtml(status.status)}</p>
  <p><strong>Today (Montréal):</strong> ${escapeHtml(status.todayMontreal)}</p>
  <p><strong>Window:</strong> ${escapeHtml(status.windowStart)} → ${escapeHtml(status.windowEnd)} (${status.windowDays} days)</p>
  <p><strong>Latest crime date:</strong> ${escapeHtml(status.latestCrimeDate || '—')}</p>
  <p><strong>Source lag (days):</strong> ${status.sourceLagDays ?? '—'}</p>
  <p><strong>Mapped records:</strong> ${status.mappedRecords}</p>
  <p><strong>Pipeline updated:</strong> ${escapeHtml(status.pipelineUpdatedAt)}</p>
  <p>
    <a href="./spvm/status.json">status.json</a>
    ·
    <a href="./spvm/spvm-crime-90d.geojson">spvm-crime-90d.geojson</a>
  </p>
  <h2>Top categories</h2>
  <ul>${categories}</ul>
  <p><small>Not an official SPVM service. Source: ${escapeHtml(status.source)} — ${escapeHtml(status.dataset)} (${escapeHtml(status.license)}).</small></p>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {{ csvText?: string, outDir?: string }} [options]
 */
export async function runPipeline(options = {}) {
  let csvText = options.csvText;
  let downloadMeta = null;

  if (!csvText) {
    downloadMeta = await downloadSpvmCsv();
    csvText = downloadMeta.text;
  }

  const result = transformSpvmCsv(csvText);
  const validation = validateTransformResult(result);
  if (!validation.ok) {
    throw new Error(`Pipeline validation failed: ${validation.errors.join('; ')}`);
  }

  const outDir = options.outDir || SITE_DIR;
  const spvmDir = resolve(outDir, 'spvm');
  await mkdir(spvmDir, { recursive: true });

  const geojsonPath = resolve(spvmDir, 'spvm-crime-90d.geojson');
  const statusPath = resolve(spvmDir, 'status.json');
  const indexPath = resolve(outDir, 'index.html');

  const geojsonText = serializeGeojson(result.geojson);
  const statusText = serializeStatus(result.status);

  await writeFile(geojsonPath, geojsonText, 'utf8');
  await writeFile(statusPath, statusText, 'utf8');
  await writeFile(indexPath, buildIndexHtml(result.status), 'utf8');

  return {
    result,
    paths: {
      geojsonPath,
      statusPath,
      indexPath
    },
    sizes: {
      geojsonBytes: Buffer.byteLength(geojsonText, 'utf8'),
      statusBytes: Buffer.byteLength(statusText, 'utf8')
    },
    downloadMeta
  };
}
