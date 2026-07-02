// Reproducción: crash al buscar otra unidad / la recién inspeccionada
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const SCRATCH = '/tmp/claude-1000/-home-facundo-Im-genes-RENOVA-INSPECTOR/414a7609-14e4-43d4-978e-5aa0a8938be8/scratchpad';
const USER_DATA = SCRATCH + '/chrome-profile';

const ctx = await chromium.launchPersistentContext(USER_DATA, { headless: true, viewport: { width: 412, height: 900 } });
const page = ctx.pages()[0] ?? await ctx.newPage();

const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error' || msg.type() === 'warning') errors.push(`[console.${msg.type()}] ${msg.text()}`);
});
page.on('pageerror', err => errors.push(`[pageerror] ${err.message}\n${(err.stack ?? '').slice(0, 800)}`));

const log = (...a) => console.log('▸', ...a);
const shot = (n) => page.screenshot({ path: `${SCRATCH}/${n}.png` });

try {
  await page.goto(BASE + '/empresa');
  log('esperando init + seed…');
  await page.waitForSelector('text=Cruz del Sur', { timeout: 600000 });
  log('empresas visibles');

  await page.click('text=Cruz del Sur');
  await page.waitForTimeout(400);
  const cta = await page.$('text=COMENZAR INSPECCIÓN');
  if (cta) await cta.click();
  await page.waitForURL('**/unidad', { timeout: 20000 });
  log('en /unidad');

  // Esperar a que el seed haya cargado unidades: reintentar búsqueda hasta que 7244 dé match
  const searchInput = 'input[placeholder="N.º de unidad"]';
  let matched = false;
  for (let i = 0; i < 120 && !matched; i++) {
    await page.fill(searchInput, '');
    await page.waitForTimeout(150);
    await page.fill(searchInput, '7244');
    await page.waitForTimeout(1000);
    matched = !!(await page.$('text=ÚLTIMA INSPECCIÓN')) || !!(await page.$('text=CONTINUAR INSPECCIÓN'));
    if (!matched && i % 10 === 0) log(`  seed aún incompleto… intento ${i}`);
    if (!matched) await page.waitForTimeout(4000);
  }
  if (!matched) { log('NUNCA hubo match para 7244'); await shot('no-match'); throw new Error('sin match'); }
  log('match 7244 con última inspección');
  await shot('01-match');

  const odo = await page.$('input[placeholder="0"]');
  if (odo) await odo.fill('999999');
  await page.waitForTimeout(300);
  await page.click('text=CONTINUAR INSPECCIÓN');
  await page.waitForURL('**/inspeccion/**', { timeout: 120000 });
  log('en inspección:', page.url());
  await page.waitForTimeout(2500);
  await shot('02-inspeccion');

  // ¿La precarga clonó datos?
  let body = await page.textContent('body');
  log('inspección body len', body.length);

  // Editar presión para simular avance
  const numInputs = await page.$$('input[type="number"]');
  log('inputs numéricos:', numInputs.length);
  if (numInputs.length >= 5) { await numInputs[4].fill('122'); await page.waitForTimeout(800); }

  await page.click('[aria-label="Volver"]');
  await page.waitForURL('**/unidad', { timeout: 20000 });
  log('volví a /unidad');
  await page.waitForTimeout(800);
  await shot('03-vuelta-unidad');

  // Caso A: misma unidad recién inspeccionada
  await page.fill(searchInput, '7244');
  await page.waitForTimeout(2000);
  body = await page.textContent('body');
  log('caso A (7244 de nuevo): url=', page.url(), '| match visible:', body.includes('ÚLTIMA INSPECCIÓN'));
  await shot('04-caso-a');

  // Caso B: otra unidad
  const clearBtn = await page.$('[aria-label="Borrar"]');
  if (clearBtn) await clearBtn.click();
  await page.waitForTimeout(400);
  await page.fill(searchInput, '7216');
  await page.waitForTimeout(2000);
  body = await page.textContent('body');
  log('caso B (7216): url=', page.url(), '| match visible:', body.includes('ÚLTIMA INSPECCIÓN'));
  await shot('05-caso-b');

  // Caso C: continuar con la otra unidad (clona)
  const odo2 = await page.$('input[placeholder="0"]');
  if (odo2) await odo2.fill('999999');
  await page.waitForTimeout(300);
  const btn2 = await page.$('text=CONTINUAR INSPECCIÓN');
  if (btn2) { await btn2.click(); await page.waitForTimeout(4000); log('caso C url=', page.url()); }
  await shot('06-caso-c');

  // Ciclo 2: volver y buscar de nuevo
  const volver = await page.$('[aria-label="Volver"]');
  if (volver) { await volver.click(); await page.waitForTimeout(1200); }
  await page.fill(searchInput, '7244');
  await page.waitForTimeout(2000);
  body = await page.textContent('body');
  log('ciclo 2 (7244): url=', page.url(), '| match visible:', body.includes('ÚLTIMA INSPECCIÓN'));
  await shot('07-ciclo2');
} catch (e) {
  console.log('!! EXCEPCIÓN DEL SCRIPT:', e.message);
  await shot('99-error');
} finally {
  console.log('\n===== ERRORES CAPTURADOS (' + errors.length + ') =====');
  for (const e of errors) console.log(e.slice(0, 700), '\n---');
  await ctx.close();
}
