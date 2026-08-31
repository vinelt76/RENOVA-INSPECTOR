#!/usr/bin/env node
/**
 * Compara las salidas de run_golden_py.py y run_golden_ts.ts sobre el MISMO fixture.
 *
 * Dos veredictos independientes:
 *   PARIDAD      python vs typescript. Una diferencia rompe ADR 0002 → exit 1.
 *   CONFORMIDAD  implementación vs 'expect' de specs/reglas_negocio.md.
 *                Solo rompe el build con --strict-spec; los casos marcados
 *                'spec_ambigua' nunca cuentan como fallo (la spec no los resuelve).
 *
 * Uso:
 *   node compare_golden.mjs [--strict-spec] [--json]
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPTS_DIR);
const REPO_ROOT = join(SKILL_DIR, '..', '..', '..');
const FIXTURE = join(SKILL_DIR, 'fixtures', 'golden.json');
const TSX = join(REPO_ROOT, 'app', 'node_modules', '.bin', 'tsx');

const strictSpec = process.argv.includes('--strict-spec');
const asJson = process.argv.includes('--json');

const EPS = 1e-9;

function fatal(msg) {
  console.error(`\n  ERROR: ${msg}\n`);
  process.exit(2);
}

function correr(cmd, args) {
  try {
    return JSON.parse(execFileSync(cmd, args, { encoding: 'utf-8', maxBuffer: 16 * 1024 * 1024 }));
  } catch (err) {
    fatal(`falló ${cmd} ${args.join(' ')}\n${err.stderr || err.message}`);
  }
}

/** Normaliza para comparar: los enteros y flotantes equivalentes son el mismo valor. */
function iguales(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < EPS;
  return a === b;
}

function fmt(v) {
  if (v === null) return 'null';
  if (v === undefined) return '—';
  return typeof v === 'string' ? v : JSON.stringify(v);
}

/** Reduce el resultado crudo de un runner a un valor comparable o al centinela ERROR. */
function valorDe(r) {
  if (!r) return { tipo: 'ausente' };
  if (r.estado === 'error') return { tipo: 'error', detalle: r.detalle };
  if (r.estado === 'sin_despacho') return { tipo: 'sin_despacho', detalle: r.detalle };
  return { tipo: 'valor', valor: r.valor };
}

function muestra(v) {
  if (v.tipo === 'error') return 'ERROR';
  if (v.tipo === 'ausente') return '(ausente)';
  if (v.tipo === 'sin_despacho') return '(sin despacho)';
  return fmt(v.valor);
}

// ---------------------------------------------------------------------------

if (!existsSync(TSX)) fatal(`no existe ${TSX}. Corre 'cd app && npm ci' primero.`);

const fixture = JSON.parse(readFileSync(FIXTURE, 'utf-8'));
const py = correr('python3', [join(SCRIPTS_DIR, 'run_golden_py.py')]);
const ts = correr(TSX, [join(SCRIPTS_DIR, 'run_golden_ts.ts')]);

const filas = [];
let fallosParidad = 0;
let fallosSpec = 0;
let ambiguos = 0;

for (const caso of fixture.casos) {
  const vpy = valorDe(py.resultados[caso.id]);
  const vts = valorDe(ts.resultados[caso.id]);

  // --- Paridad
  let paridad;
  if (vpy.tipo !== vts.tipo) paridad = false;
  else if (vpy.tipo === 'valor') paridad = iguales(vpy.valor, vts.valor);
  else paridad = true; // ambos error / ambos ausentes
  if (!paridad) fallosParidad++;

  // --- Conformidad con la spec
  const exp = caso.expect;
  const esObj = exp !== null && typeof exp === 'object';
  const ambigua = esObj && exp.spec_ambigua === true;
  const esperaError = esObj && exp.error === true;
  const esperado = ambigua && 'valor' in exp ? exp.valor : exp;

  let spec;
  if (esperaError) {
    spec = vts.tipo === 'error';
  } else if (vts.tipo !== 'valor') {
    spec = false;
  } else {
    spec = iguales(vts.valor, esperado);
  }

  if (ambigua) ambiguos++;
  else if (!spec) fallosSpec++;

  filas.push({
    id: caso.id,
    fn: caso.fn,
    ref: caso.ref ?? '',
    py: muestra(vpy),
    ts: muestra(vts),
    esperado: esperaError ? 'ERROR' : fmt(esperado),
    paridad,
    spec,
    ambigua,
  });
}

if (asJson) {
  console.log(JSON.stringify({ filas, fallosParidad, fallosSpec, ambiguos }, null, 2));
} else {
  const w = (s, n) => String(s).padEnd(n).slice(0, n);
  console.log('');
  console.log(`  Fixture: ${fixture.casos.length} casos — ${fixture.fuente}`);
  console.log(`  Python : ${py.fuente}`);
  console.log(`  TS     : ${ts.fuente}`);
  console.log('');
  console.log(
    `  ${w('CASO', 40)} ${w('PYTHON', 22)} ${w('TS', 22)} ${w('ESPERADO (spec)', 22)} PAR SPEC`,
  );
  console.log(`  ${'-'.repeat(40)} ${'-'.repeat(22)} ${'-'.repeat(22)} ${'-'.repeat(22)} --- ----`);
  for (const f of filas) {
    const par = f.paridad ? ' ok' : 'XXX';
    const sp = f.ambigua ? ' ~~ ' : f.spec ? ' ok ' : 'XXXX';
    console.log(`  ${w(f.id, 40)} ${w(f.py, 22)} ${w(f.ts, 22)} ${w(f.esperado, 22)} ${par} ${sp}`);
  }
  console.log('');
  console.log(`  PARIDAD Python↔TS : ${fallosParidad === 0 ? 'OK' : `${fallosParidad} DIFERENCIAS`}`);
  console.log(
    `  CONFORMIDAD spec  : ${fallosSpec === 0 ? 'OK' : `${fallosSpec} desviaciones`}` +
      ` (${ambiguos} casos marcados spec_ambigua, no cuentan)`,
  );
  if (fallosSpec > 0 && !strictSpec) {
    console.log('  → las desviaciones de spec no rompen el build sin --strict-spec');
  }
  console.log('');
}

if (fallosParidad > 0) process.exit(1);
if (strictSpec && fallosSpec > 0) process.exit(1);
process.exit(0);
