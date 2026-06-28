// Script de auditoría: genera verify-db.xlsx con las filas que el seed insertiría en SQLite.
// Ejecutar desde app/: npm run verify:db
import ExcelJS from 'exceljs';
import { buildSeedRows } from '../src/db/seed_rows';

async function main() {
  const rows = buildSeedRows();

  const tables: [string, unknown[]][] = [
    ['_conteos', []],
    ['cat_valvula', rows.catValvulas],
    ['cat_anomalia', rows.catAnomalias],
    ['cat_configuracion', rows.catConfiguraciones],
    ['cat_condicion', rows.catCondiciones],
    ['cat_marca', rows.catMarcas],
    ['cat_modelo', rows.catModelos],
    ['cat_medida', rows.catMedidas],
    ['cat_reencauche', rows.catReencauches],
    ['empresa', rows.empresas],
  ];

  const wb = new ExcelJS.Workbook();

  // Hoja resumen de conteos
  const summary = wb.addWorksheet('_conteos');
  summary.addRow(['tabla', 'filas']);
  summary.getRow(1).font = { bold: true };

  for (const [name, data] of tables.slice(1)) {
    const count = (data as unknown[]).length;
    summary.addRow([name, count]);
    console.log(`  ${name}: ${count}`);
  }

  // Una hoja por tabla
  for (const [name, data] of tables.slice(1)) {
    const arr = data as Record<string, unknown>[];
    if (arr.length === 0) continue;
    const ws = wb.addWorksheet(name);
    const headers = Object.keys(arr[0]);
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    for (const row of arr) {
      ws.addRow(headers.map(h => row[h] ?? null));
    }
  }

  await wb.xlsx.writeFile('verify-db.xlsx');
  console.log('\n✅ verify-db.xlsx generado');
}

main().catch(e => { console.error(e); process.exit(1); });
