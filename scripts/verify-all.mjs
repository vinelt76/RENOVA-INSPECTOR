#!/usr/bin/env node
/**
 * Verificación completa de RENOVA INSPECTOR, de un tirón.
 *
 * POR QUÉ EXISTE
 *
 * Las pruebas viven en 8 suites con 8 invocaciones distintas y no había forma de correrlas
 * juntas. El 2026-07-25 una revisión independiente reportó "124 tests, todos verdes" — el total
 * real es 385. Se había perdido el 68 % de la cobertura, incluida la suite más grande del
 * proyecto (`WEB/movimientos`, 186 pruebas), sin que nada fallara.
 *
 * Por eso este script no solo ejecuta: CUENTA. Si una suite desaparece o deja de ser
 * descubierta, el total baja y el script falla. Un runner que "pasa" saltándose la mitad de las
 * pruebas es peor que no tener runner.
 *
 * USO
 *   npm run verify           # todo
 *   npm run verify -- --fast # sin builds (útil mientras se itera)
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fast = process.argv.includes('--fast');

/**
 * Mínimo de pruebas esperado por suite, medido el 2026-07-25.
 *
 * Es un piso, no una cifra exacta: agregar pruebas nunca debe romper la verificación, pero
 * perderlas sí. Al sumar pruebas conviene subir el piso en el mismo commit.
 */
const SUITES = [
  { name: 'app',              dir: 'app',              cmd: ['npm', 'test'],  minTests: 47 },
  { name: 'app movimientos',  dir: 'app movimientos',  cmd: ['npm', 'test'],  minTests: 5 },
  { name: 'WEB/movimientos',  dir: 'WEB/movimientos',  cmd: ['npm', 'test'],  minTests: 186 },
  { name: 'WEB/shared',       dir: 'WEB/shared',       cmd: ['npm', 'test'],  minTests: 50 },
  { name: 'WEB/servicios',    dir: 'WEB/servicios',    cmd: ['npm', 'test'],  minTests: 38 },
  { name: 'WEB/rendimiento',  dir: 'WEB/rendimiento',  cmd: ['npm', 'test'],  minTests: 51 },
  { name: 'WEB/buscador',     dir: 'WEB/buscador',     cmd: ['npm', 'test'],  minTests: 19 },
  { name: 'WEB/inventario',   dir: 'WEB/inventario',   cmd: ['npm', 'test'],  minTests: 15 },
];

const CHECKS = [
  { name: 'lint (app)',   dir: 'app', cmd: ['npm', 'run', 'lint'] },
  { name: 'docs:check',   dir: '.',   cmd: ['npm', 'run', 'docs:check'] },
];

const BUILDS = [
  { name: 'build (app)',             dir: 'app',             cmd: ['npm', 'run', 'build'] },
  { name: 'build (app movimientos)', dir: 'app movimientos', cmd: ['npm', 'run', 'build'] },
];

const failures = [];
let totalTests = 0;

function run(label, dir, cmd) {
  const cwd = path.join(rootDir, dir);
  if (!existsSync(cwd)) {
    failures.push(`${label}: no existe el directorio ${dir}`);
    return null;
  }
  try {
    return execFileSync(cmd[0], cmd.slice(1), { cwd, encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    failures.push(`${label}: falló\n${output.split('\n').slice(-25).join('\n')}`);
    return null;
  }
}

/** Extrae el conteo de la línea "Tests  N passed (N)" de vitest. */
function parseTestCount(output) {
  const match = output.match(/Tests\s+(\d+)\s+passed/);
  return match ? Number(match[1]) : null;
}

console.log('\n── Suites de prueba ──');
for (const suite of SUITES) {
  const output = run(suite.name, suite.dir, suite.cmd);
  if (output === null) {
    console.log(`  ✗ ${suite.name.padEnd(20)} falló`);
    continue;
  }
  const count = parseTestCount(output);
  if (count === null) {
    failures.push(`${suite.name}: no se pudo leer el conteo de pruebas en la salida de vitest`);
    console.log(`  ✗ ${suite.name.padEnd(20)} sin conteo legible`);
    continue;
  }
  totalTests += count;
  if (count < suite.minTests) {
    // Una suite que corre menos pruebas de las que tenía es exactamente el fallo silencioso
    // que este script existe para atrapar.
    failures.push(`${suite.name}: ${count} pruebas, se esperaban al menos ${suite.minTests}`);
    console.log(`  ✗ ${suite.name.padEnd(20)} ${count} (esperadas ≥ ${suite.minTests})`);
  } else {
    console.log(`  ✓ ${suite.name.padEnd(20)} ${count}`);
  }
}

console.log('\n── Lint y documentación ──');
for (const check of CHECKS) {
  const ok = run(check.name, check.dir, check.cmd) !== null;
  console.log(`  ${ok ? '✓' : '✗'} ${check.name}`);
}

if (!fast) {
  console.log('\n── Builds ──');
  for (const build of BUILDS) {
    const ok = run(build.name, build.dir, build.cmd) !== null;
    console.log(`  ${ok ? '✓' : '✗'} ${build.name}`);
  }
} else {
  console.log('\n── Builds ── (omitidos por --fast)');
}

const expectedTotal = SUITES.reduce((sum, s) => sum + s.minTests, 0);
console.log(`\n── Total ──\n  ${totalTests} pruebas ejecutadas (piso: ${expectedTotal})`);

if (failures.length > 0) {
  console.error(`\n✗ Verificación FALLIDA — ${failures.length} problema(s):\n`);
  for (const failure of failures) console.error(`  • ${failure}\n`);
  process.exit(1);
}

console.log('\n✓ Verificación completa en verde.\n');
