import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRecordFingerprint,
  isValidCoordinate,
  shiftLabelFor,
  transformSpvmCsv,
  validateTransformResult
} from '../src/transform.js';
import { rollingWindowBounds } from '../src/montreal-date.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureCsv = readFileSync(resolve(__dirname, 'fixtures/sample.csv'), 'utf8');

test('shift labels map jour/soir/nuit', () => {
  assert.equal(shiftLabelFor('jour'), 'Day');
  assert.equal(shiftLabelFor('soir'), 'Evening');
  assert.equal(shiftLabelFor('nuit'), 'Night');
});

test('coordinate validation rejects invalid values', () => {
  assert.equal(isValidCoordinate(-73.6, 45.5), true);
  assert.equal(isValidCoordinate(0, 0), false);
  assert.equal(isValidCoordinate('', 45.5), false);
  assert.equal(isValidCoordinate(-73.6, NaN), false);
});

test('fixture excludes old record and invalid coordinates', () => {
  const today = '2026-08-08';
  const { windowStart } = rollingWindowBounds(today);
  const result = transformSpvmCsv(fixtureCsv, { todayMontreal: today });

  assert.equal(windowStart, '2026-05-11');
  assert.equal(result.stats.sourceRows, 6);
  assert.equal(result.stats.windowRecords, 5);
  assert.equal(result.stats.mappedRecords, 2);
  assert.equal(result.stats.unmappedRecords, 2);
  assert.equal(result.stats.duplicateRecords, 1);
  assert.equal(result.status.latestCrimeDate, '2026-08-05');
  assert.equal(result.status.sourceLagDays, 3);

  const ids = result.geojson.features.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('fingerprint is deterministic and documented in status', () => {
  const fp = buildRecordFingerprint({
    category: 'Méfait',
    date: '2026-08-05',
    shift: 'jour',
    pdq: '12',
    latitude: 45.56778,
    longitude: -73.626778
  });
  assert.match(fp, /^[a-f0-9]{16}$/);
  const result = transformSpvmCsv(fixtureCsv, { todayMontreal: '2026-08-08' });
  assert.match(result.status.fingerprintNote, /NOT an official SPVM incident identifier/);
});

test('geojson features have required properties', () => {
  const result = transformSpvmCsv(fixtureCsv, { todayMontreal: '2026-08-08' });
  const feature = result.geojson.features[0];
  assert.equal(feature.type, 'Feature');
  assert.equal(feature.geometry.type, 'Point');
  assert.ok(Array.isArray(feature.geometry.coordinates));
  assert.equal(feature.properties.sourceName, 'Service de police de la Ville de Montréal');
  assert.equal(feature.properties.dataset, 'Actes criminels');
  assert.equal(feature.properties.spatialPrecision, 'Privacy-obfuscated intersection');
});

test('validateTransformResult fails on empty window', () => {
  const empty = transformSpvmCsv('CATEGORIE,DATE,QUART,PDQ,X,Y,LONGITUDE,LATITUDE', {
    todayMontreal: '2026-08-08'
  });
  const validation = validateTransformResult(empty);
  assert.equal(validation.ok, false);
});
