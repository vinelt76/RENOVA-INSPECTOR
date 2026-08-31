/**
 * Ejecuta fixtures/golden.json contra app/src/core/calculations.ts y emite JSON por stdout.
 *
 * No conoce los valores esperados: solo reporta lo que la implementación produce.
 * La comparación la hace compare_golden.mjs.
 *
 * Correr con el tsx de app/:  app/node_modules/.bin/tsx scripts/run_golden_ts.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  calcularRtdMovi,
  calcularIdi,
  calcularEstadoRtd,
  calcularEstadoPresion,
  calcularVur,
  calcularTasaDesgaste,
  calcularIsaPeso,
} from '../../../../app/src/core/calculations';

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = join(SKILL_DIR, '..', '..', '..');
const FIXTURE = join(SKILL_DIR, 'fixtures', 'golden.json');
const CALC_PATH = join(REPO_ROOT, 'app', 'src', 'core', 'calculations.ts');

type Caso = { id: string; fn: string; args: unknown[] };
type Fixture = { casos: Caso[] };

const despacho: Record<string, (a: any[]) => unknown> = {
  rtdMovi: (a) => calcularRtdMovi(a[0], a[1], a[2], a[3]),
  idi: (a) => calcularIdi(a[0], a[1], a[2], a[3]),
  estadoRtd: (a) => calcularEstadoRtd(a[0], a[1], a[2]),
  estadoPresion: (a) => calcularEstadoPresion(a[0], a[1], a[2], a[3], a[4]),
  vur: (a) => calcularVur(a[0], a[1], a[2]),
  tasaDesgaste: (a) => calcularTasaDesgaste(a[0], a[1], a[2], a[3]),
  isaPeso: (a) => calcularIsaPeso(a[0]),
};

const fixture: Fixture = JSON.parse(readFileSync(FIXTURE, 'utf-8'));
const resultados: Record<string, { estado: string; valor?: unknown; detalle?: string }> = {};

for (const caso of fixture.casos) {
  const fn = despacho[caso.fn];
  if (!fn) {
    resultados[caso.id] = { estado: 'sin_despacho', detalle: caso.fn };
    continue;
  }
  try {
    const valor = fn(caso.args as any[]);
    resultados[caso.id] = { estado: 'ok', valor: valor === undefined ? null : valor };
  } catch (err) {
    const e = err as Error;
    resultados[caso.id] = { estado: 'error', detalle: `${e.name}: ${e.message}` };
  }
}

process.stdout.write(
  JSON.stringify(
    { impl: 'typescript', fuente: relative(REPO_ROOT, CALC_PATH), resultados },
    null,
    2,
  ) + '\n',
);
