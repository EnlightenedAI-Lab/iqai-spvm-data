import { createHash } from 'node:crypto';
import { parseCsv, validateRequiredColumns } from './csv.js';
import {
  DATASET_NAME,
  LICENSE,
  SHIFT_LABELS,
  SOURCE_NAME,
  SPATIAL_PRECISION,
  SPVM_SOURCE_URL,
  TEMPORAL_PRECISION
} from './constants.js';
import {
  addCalendarDaysYmd,
  calendarDaysBetween,
  isValidYmd,
  montrealTodayYmd,
  rollingWindowBounds
} from './montreal-date.js';

const MIN_SOURCE_ROWS = 1000;

/**
 * @param {number|string} longitude
 * @param {number|string} latitude
 */
export function isValidCoordinate(longitude, latitude) {
  const lonRaw = String(longitude ?? '').trim();
  const latRaw = String(latitude ?? '').trim();
  if (!lonRaw || !latRaw) return false;

  const lon = Number(lonRaw);
  const lat = Number(latRaw);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return false;
  if (lon === 0 && lat === 0) return false;
  return true;
}

/**
 * @param {string} quart
 */
export function shiftLabelFor(quart) {
  const key = String(quart || '').trim().toLowerCase();
  return SHIFT_LABELS[key] || String(quart || '').trim();
}

/**
 * Deterministic fingerprint — NOT an official SPVM incident identifier.
 * @param {object} fields
 */
export function buildRecordFingerprint(fields) {
  const payload = [
    fields.category,
    fields.date,
    fields.shift,
    fields.pdq,
    String(fields.latitude),
    String(fields.longitude)
  ].join('|');
  return createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 16);
}

/**
 * @param {Array<{ category: string, count: number }>} categories
 */
export function sortCategoriesDescending(categories) {
  return [...categories].sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

/**
 * @param {string} csvText
 * @param {{ now?: Date, todayMontreal?: string, pipelineUpdatedAt?: string }} [options]
 */
export function transformSpvmCsv(csvText, options = {}) {
  const pipelineUpdatedAt = options.pipelineUpdatedAt || new Date().toISOString();
  const todayMontreal = options.todayMontreal || montrealTodayYmd(options.now);
  const { windowStart, windowEnd, windowDays } = rollingWindowBounds(todayMontreal);

  const { headers, rows } = parseCsv(csvText);
  const columnCheck = validateRequiredColumns(headers);
  if (!columnCheck.ok) {
    throw new Error(`Missing required CSV columns: ${columnCheck.missing.join(', ')}`);
  }

  const stats = {
    sourceRows: rows.length,
    windowRecords: 0,
    mappedRecords: 0,
    unmappedRecords: 0,
    duplicateRecords: 0
  };

  const seenFingerprints = new Set();
  const features = [];
  let latestCrimeDate = null;
  const categoryCounts = new Map();

  for (const row of rows) {
    const date = row.DATE;
    if (!isValidYmd(date)) continue;
    if (date < windowStart || date > windowEnd) continue;

    stats.windowRecords += 1;
    if (!latestCrimeDate || date > latestCrimeDate) latestCrimeDate = date;

    const category = row.CATEGORIE;
    const shift = row.QUART;
    const pdq = row.PDQ;
    const longitude = row.LONGITUDE;
    const latitude = row.LATITUDE;

    if (!isValidCoordinate(longitude, latitude)) {
      stats.unmappedRecords += 1;
      continue;
    }

    const lon = Number(longitude);
    const lat = Number(latitude);

    const fingerprintFields = {
      category,
      date,
      shift,
      pdq,
      latitude: lat,
      longitude: lon
    };

    const id = buildRecordFingerprint(fingerprintFields);
    if (seenFingerprints.has(id)) {
      stats.duplicateRecords += 1;
      continue;
    }
    seenFingerprints.add(id);

    features.push({
      type: 'Feature',
      id,
      geometry: {
        type: 'Point',
        coordinates: [lon, lat]
      },
      properties: {
        category,
        date,
        shift,
        shiftLabel: shiftLabelFor(shift),
        pdq,
        sourceName: SOURCE_NAME,
        dataset: DATASET_NAME,
        spatialPrecision: SPATIAL_PRECISION,
        temporalPrecision: TEMPORAL_PRECISION
      }
    });

    stats.mappedRecords += 1;
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  }

  const categories = sortCategoriesDescending(
    [...categoryCounts.entries()].map(([category, count]) => ({ category, count }))
  );

  const sourceLagDays = latestCrimeDate
    ? calendarDaysBetween(latestCrimeDate, todayMontreal)
    : null;

  const status = {
    status: 'CURRENT',
    source: SOURCE_NAME,
    dataset: DATASET_NAME,
    sourceUrl: SPVM_SOURCE_URL,
    license: LICENSE,
    pipelineUpdatedAt,
    todayMontreal,
    windowStart,
    windowEnd,
    windowDays,
    latestCrimeDate,
    sourceLagDays,
    sourceRows: stats.sourceRows,
    windowRecords: stats.windowRecords,
    mappedRecords: stats.mappedRecords,
    unmappedRecords: stats.unmappedRecords,
    duplicateRecords: stats.duplicateRecords,
    categories,
    spatialPrecision: SPATIAL_PRECISION,
    temporalPrecision: TEMPORAL_PRECISION,
    fingerprintNote:
      'Feature id is a deterministic SHA-256 fingerprint of published fields; it is NOT an official SPVM incident identifier.'
  };

  const geojson = {
    type: 'FeatureCollection',
    features
  };

  return { geojson, status, stats };
}

/**
 * @param {object} result
 */
export function validateTransformResult(result) {
  const errors = [];
  const status = result?.status;
  const stats = result?.stats;

  if (!status || !stats) {
    errors.push('transform result missing status or stats');
    return { ok: false, errors };
  }

  if (stats.sourceRows < MIN_SOURCE_ROWS) {
    errors.push(`sourceRows below minimum (${stats.sourceRows} < ${MIN_SOURCE_ROWS})`);
  }
  if (stats.windowRecords < 1) {
    errors.push('no records in 90-day window');
  }
  if (stats.mappedRecords < 1) {
    errors.push('no mapped records with valid coordinates');
  }
  if (!status.latestCrimeDate || !isValidYmd(status.latestCrimeDate)) {
    errors.push('latestCrimeDate invalid');
  }
  if (result.geojson?.type !== 'FeatureCollection') {
    errors.push('geojson is not a FeatureCollection');
  }
  if (result.geojson?.features?.length !== stats.mappedRecords) {
    errors.push('geojson feature count does not match mappedRecords');
  }

  return { ok: errors.length === 0, errors };
}

/**
 * @param {object} geojson
 */
export function serializeGeojson(geojson) {
  return JSON.stringify(geojson);
}

/**
 * @param {object} status
 */
export function serializeStatus(status) {
  return JSON.stringify(status, null, 2);
}
