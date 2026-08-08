export const SPVM_SOURCE_URL =
  'https://donnees.montreal.ca/dataset/5829b5b0-ea6f-476f-be94-bc2b8797769a/resource/c6f482bf-bf0f-4960-8b2f-9982c211addd/download/actes-criminels.csv';

export const SOURCE_NAME = 'Service de police de la Ville de Montréal';
export const DATASET_NAME = 'Actes criminels';
export const LICENSE = 'CC BY 4.0';

export const REQUIRED_COLUMNS = [
  'CATEGORIE',
  'DATE',
  'QUART',
  'PDQ',
  'LONGITUDE',
  'LATITUDE'
];

export const SPATIAL_PRECISION = 'Privacy-obfuscated intersection';
export const TEMPORAL_PRECISION = 'Date + reporting shift';

export const SHIFT_LABELS = {
  jour: 'Day',
  soir: 'Evening',
  nuit: 'Night'
};
