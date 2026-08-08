import fs from 'fs';

const text = fs.readFileSync('actes-criminels.csv', 'utf8');

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (c === ',' && !q) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

const lines = text.split(/\r?\n/).filter(Boolean);
console.log('rows', lines.length - 1);
console.log('header', lines[0]);
console.log('size_bytes', Buffer.byteLength(text));

let minDate = '9999-99-99';
let maxDate = '0000-00-00';
const cats = new Set();
const quarts = new Set();

for (let i = 1; i < lines.length; i++) {
  const row = parseCsvLine(lines[i]);
  const date = row[1];
  if (date && date < minDate) minDate = date;
  if (date && date > maxDate) maxDate = date;
  cats.add(row[0]);
  quarts.add(row[2]);
}

console.log('minDate', minDate);
console.log('maxDate', maxDate);
console.log('categoryCount', cats.size);
console.log('quarts', [...quarts].sort());
console.log('topCategoriesSample', [...cats].slice(0, 20));
