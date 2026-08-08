import { runPipeline } from '../src/pipeline.js';

try {
  const output = await runPipeline();
  const status = output.result.status;
  console.log('SPVM pipeline OK');
  console.log(JSON.stringify({
    todayMontreal: status.todayMontreal,
    windowStart: status.windowStart,
    windowEnd: status.windowEnd,
    latestCrimeDate: status.latestCrimeDate,
    sourceLagDays: status.sourceLagDays,
    sourceRows: status.sourceRows,
    windowRecords: status.windowRecords,
    mappedRecords: status.mappedRecords,
    unmappedRecords: status.unmappedRecords,
    duplicateRecords: status.duplicateRecords,
    geojsonBytes: output.sizes.geojsonBytes,
    categories: status.categories.length
  }, null, 2));
} catch (error) {
  console.error('SPVM pipeline FAILED:', error.message || error);
  process.exit(1);
}
