import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const appDistDir = path.join(rootDir, 'app', 'dist');
const webDir = path.join(rootDir, 'WEB');
const outputDir = path.join(rootDir, 'deploy-static');
const outputWebDir = path.join(outputDir, 'web');

if (!existsSync(appDistDir)) {
  throw new Error('No existe app/dist. Ejecuta primero `cd app && npm run build`.');
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputWebDir, { recursive: true });

cpSync(appDistDir, outputDir, { recursive: true });

for (const entry of ['historial-neumatico.html', 'importar.html', 'instalacion.html', 'inventario.html', 'neumaticos.html', 'servicios.html', 'INSPECCIONES POR FECHA.html', 'Inspecciones por unidad.html', 'rendimiento.html', 'renova-office-shell.css', 'renova-ready.js', 'supabase-config.public.js', 'supabase-demo.js']) {
  cpSync(path.join(webDir, entry), path.join(outputWebDir, entry));
}

for (const directory of ['inventario', 'movimientos', 'buscador', 'shared', 'neumaticos', 'servicios']) {
  const sourceDirectory = path.join(webDir, directory);
  const outputDirectory = path.join(outputWebDir, directory);
  mkdirSync(outputDirectory, { recursive: true });
  for (const entry of readdirSync(sourceDirectory)) {
    if (entry === 'vitest.config.js') continue;
    if (!entry.endsWith('.js') && !entry.endsWith('.css')) continue;
    cpSync(path.join(sourceDirectory, entry), path.join(outputDirectory, entry));
  }
}

console.log(`Bundle listo en ${outputDir}`);
console.log(`App principal: ${path.join(outputDir, 'index.html')}`);
console.log(`Dashboards: ${outputWebDir}`);
