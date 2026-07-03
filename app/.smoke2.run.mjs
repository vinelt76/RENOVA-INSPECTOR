// Smoke integral: acordeón colapsado por defecto, R4 siempre visible (grid estable),
// orden código→válvula→anomalía, auto-avance, REUSO de cabecera del mismo día,
// edición al volver, persistencia. Correr con dev server en :5173.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5173';
const SCRATCH = '/tmp/renova-smoke2';
const USER_DATA = SCRATCH + '/chrome-profile';

const ctx = await chromium.launchPersistentContext(USER_DATA, {
  headless: true,
  executablePath: '/opt/pw-browsers/chromium',
  viewport: { width: 412, height: 900 },
});
const page = ctx.pages()[0] ?? await ctx.newPage();

const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error' || msg.type() === 'warning') errors.push(`[console.${msg.type()}] ${msg.text()}`);
});
page.on('pageerror', err => errors.push(`[pageerror] ${err.message}\n${(err.stack ?? '').slice(0, 600)}`));

const log = (...a) => console.log('▸', ...a);
const shot = (n) => page.screenshot({ path: `${SCRATCH}/${n}.png` });
let fails = 0;
const check = (cond, name) => { if (cond) log('OK  ', name); else { fails++; log('FAIL', name); } };

const UNIT = 'B' + String(Date.now()).slice(-5);

try {
  await page.goto(BASE + '/empresa');
  await page.waitForSelector('text=CRUZ DEL SUR', { timeout: 300000 });
  await page.click('text=CRUZ DEL SUR');
  await page.waitForTimeout(250);
  await page.click('text=COMENZAR INSPECCIÓN');
  await page.waitForURL('**/unidad', { timeout: 20000 });

  // ── Crear unidad 2-4-2 ──
  const searchInput = 'input[placeholder="N.º de unidad"]';
  await page.fill(searchInput, UNIT);
  await page.waitForTimeout(700);
  await (await page.$('input[placeholder="0"]')).fill('200000');
  await page.click('text=2-4-2');
  await page.waitForTimeout(150);
  await page.click('text=CREAR UNIDAD');
  await page.waitForURL('**/inspeccion/**', { timeout: 30000 });
  const url1 = page.url();
  await page.waitForTimeout(1000);
  await shot('01-inspeccion-nueva');

  // Acordeón COLAPSADO por defecto (incluso posición 1 de unidad nueva)
  const codigoOculto = await page.$('input[placeholder="1234"]');
  check(!codigoOculto || !(await codigoOculto.isVisible()), 'acordeón colapsado por defecto en pos 1 (código no visible)');
  check((await page.textContent('body')).includes('Sin datos'), 'resumen "Sin datos" visible colapsado');

  // R4 SIEMPRE visible: 4 canales + presión = 5 inputs numéricos en pos 1 (Direccional)
  let nums = await page.$$('input[type="number"]');
  check(nums.length === 5, `R4 visible en Direccional: 4 R + presión (${nums.length} inputs)`);

  // Orden: CÓDIGO (acordeón) → TAPA DE VÁLVULA → ANOMALÍA
  const bodyTxt = await page.textContent('body');
  const iV = bodyTxt.indexOf('TAPA DE VÁLVULA');
  const iA = bodyTxt.indexOf('ANOMALÍA');
  check(iV !== -1 && iA !== -1 && iV < iA, 'TAPA DE VÁLVULA aparece antes de ANOMALÍA');

  // Expandir acordeón → código editable; tipear no colapsa
  await page.click('text=DATOS DEL NEUMÁTICO');
  await page.waitForTimeout(400);
  const codigoInput = await page.$('input[placeholder="1234"]');
  check(!!codigoInput && (await codigoInput.isVisible()), 'expandir muestra el campo código');
  await codigoInput.fill('K-200');
  await page.waitForTimeout(500);
  check(await (await page.$('input[placeholder="1234"]')).isVisible(), 'tipear código no colapsa el acordeón');
  // Colapsar de nuevo
  await page.click('text=DATOS DEL NEUMÁTICO');
  await page.waitForTimeout(400);

  // Medición pos 1 con auto-avance (acordeón colapsado → activo también en unidad nueva)
  nums = await page.$$('input[type="number"]');
  await nums[0].fill('12'); await page.waitForTimeout(120);
  await nums[1].fill('11'); await page.waitForTimeout(120);
  await nums[2].fill('13'); await page.waitForTimeout(200);
  // R3 en Direccional encadena directo a PRESIÓN (R4 queda opcional)
  await page.keyboard.type('118');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  check((await page.textContent('body')).includes('DIR·Der'), 'auto-avance a pos 2 tras cerrar presión');
  await shot('02-autoavance');

  // ── Volver → REABRIR la inspección de HOY (misma cabecera, sin duplicar) ──
  await page.click('[aria-label="Volver"]');
  await page.waitForURL('**/unidad', { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.fill(searchInput, UNIT);
  await page.waitForTimeout(1400);
  const bodyU = await page.textContent('body');
  check(bodyU.includes('REABRIR INSPECCIÓN DE HOY'), 'CTA dice REABRIR INSPECCIÓN DE HOY');
  const odoVal = await (await page.$('input[placeholder="0"]')).inputValue();
  check(odoVal === '200000', `odómetro prellenado con el del día (${odoVal})`);
  await page.click('text=REABRIR INSPECCIÓN DE HOY');
  await page.waitForURL('**/inspeccion/**', { timeout: 30000 });
  await page.waitForTimeout(1000);
  check(page.url() === url1, 'misma cabecera (sin duplicar inspección)');
  await shot('03-reabierta');

  // Datos previos presentes y EDITABLES
  const bodyR = await page.textContent('body');
  check(bodyR.includes('K-200'), 'resumen muestra código precargado K-200');
  nums = await page.$$('input[type="number"]');
  check((await nums[0].inputValue()) === '12', 'R1 conserva el valor guardado');
  await nums[nums.length - 1].fill('125');
  await page.waitForTimeout(800);
  check((await nums[nums.length - 1].inputValue()) === '125', 'presión editable al volver');

  // Layout estable: siguen siendo 5 inputs, acordeón colapsado
  await page.reload();
  await page.waitForTimeout(3500);
  nums = await page.$$('input[type="number"]');
  check(nums.length === 5, 'tras reload: grid de medición estable (5 inputs)');
  check((await nums[nums.length - 1].inputValue()) === '125', 'edición persistida tras reload');
  const codigoR = await page.$('input[placeholder="1234"]');
  check(!codigoR || !(await codigoR.isVisible()), 'tras reload: acordeón sigue colapsado');
  await shot('04-reload');

  // Pos 7 (Libre) también 5 inputs — grid idéntico entre posiciones
  for (let i = 0; i < 6; i++) {
    const btns = await page.$$('button');
    await btns[btns.length - 1].click();
    await page.waitForTimeout(300);
  }
  nums = await page.$$('input[type="number"]');
  check(nums.length === 5, `pos 7 Libre: mismo grid (${nums.length} inputs)`);
  await shot('05-pos7');
} catch (e) {
  fails++;
  console.log('!! EXCEPCIÓN DEL SCRIPT:', e.message);
  await shot('99-error');
} finally {
  console.log('\n===== ERRORES DE CONSOLA (' + errors.length + ') =====');
  for (const e of errors) console.log(e.slice(0, 400), '\n---');
  console.log(fails === 0 && errors.length === 0 ? '✅ SMOKE VERDE' : `❌ ${fails} fails / ${errors.length} errores`);
  await ctx.close();
  process.exit(fails > 0 ? 1 : 0);
}
