# IQAI SPVM Data Service

Automated IQAI cache and normalization pipeline for **Ville de Montréal / Service de police de la Ville de Montréal** open crime data.

This repository publishes a **rolling last-90-days** operational GeoJSON subset via GitHub Pages. It is **not** an official SPVM service.

## Source

- **Publisher:** Service de police de la Ville de Montréal
- **Dataset:** Actes criminels
- **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- **Official CSV:** https://donnees.montreal.ca/dataset/5829b5b0-ea6f-476f-be94-bc2b8797769a/resource/c6f482bf-bf0f-4960-8b2f-9982c211addd/download/actes-criminels.csv

## Published endpoints

After GitHub Pages deployment:

- `https://enlightenedai-lab.github.io/iqai-spvm-data/spvm/status.json`
- `https://enlightenedai-lab.github.io/iqai-spvm-data/spvm/spvm-crime-90d.geojson`

## Rolling window

- Timezone: `America/Toronto` (calendar dates)
- Window: today through today − 89 days (90 days inclusive)
- No exact-hour filtering — SPVM publishes **DATE + QUART** only

## Source limitations (preserved in output)

- Locations are privacy-modified / displaced to a nearby intersection
- Exact incident address is **not** provided
- Temporal precision is **date + reporting shift**, not an exact incident timestamp
- Records and classifications can change over time
- Open-data reporting — not the final official statistical report

## Feature identifiers

`Feature.id` is a deterministic SHA-256 fingerprint of published fields (`category`, `date`, `shift`, `pdq`, `latitude`, `longitude`). It is **not** an official SPVM incident identifier.

## Pipeline

Daily GitHub Action (~12:17 UTC / Montréal morning):

1. Download official CSV
2. Validate source
3. Keep rolling 90-day window only
4. Normalize to GeoJSON + `status.json`
5. Deploy `_site/` artifact to GitHub Pages

Generated data is **not** committed to this repository.

If a daily run fails validation, the workflow fails and the previous Pages deployment remains live.

## Local development

```bash
npm test
node scripts/run-pipeline.mjs
```

## Attribution

Data © Ville de Montréal / Service de police de la Ville de Montréal — Actes criminels (CC BY 4.0).

Transformed subset © IQAI pipeline contributors.
