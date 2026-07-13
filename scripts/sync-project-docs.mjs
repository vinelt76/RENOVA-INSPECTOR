import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

const root = path.resolve(import.meta.dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const checkOnly = process.argv.includes('--check');
const statusOnly = process.argv.includes('--status');
const execFileAsync = promisify(execFile);

const targets = [
  {
    name: 'IA',
    source: path.join(root, 'knowledge', 'ai'),
    destination: process.env.RENOVA_AI_VAULT
      ?? '/home/facundo/Documentos/OBSIDIAN/Claude/claude/RENOVA-INSPECTOR',
  },
  {
    name: 'humano',
    source: path.join(root, 'knowledge', 'human'),
    destination: process.env.RENOVA_HUMAN_VAULT
      ?? '/home/facundo/Documentos/SUPABASE/RENOVA',
  },
];

const SNAPSHOT_EXCLUDES = [
  /^knowledge\//,
  /^app\/dist\//,
  /^app\/node_modules\//,
  /^\.tokensave\//,
  /\.(?:png|jpe?g|gif|webp|woff2?|wasm|jar|db(?:-shm|-wal)?)$/i,
];

const IMPORTANT_PATHS = [
  /^app\/src\/(?:db|sync|core|state)\//,
  /^app\/src\/(?:screens|components)\//,
  /^WEB\//,
  /^supabase\/migrations\//,
  /^supabase\/tests\//,
  /^specs\//,
  /^decisions\//,
  /^\.github\/workflows\//,
  /^(?:package|app\/package)(?:-lock)?\.json$/,
  /^app\/vite\.config\.ts$/,
  /^app\/capacitor\.config\.ts$/,
];

async function repositorySnapshot() {
  const { stdout: listed } = await execFileAsync(
    'git',
    ['ls-files', '-co', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 },
  );
  const files = {};
  for (const relative of listed.toString('utf8').split('\0').filter(Boolean).sort()) {
    if (SNAPSHOT_EXCLUDES.some(pattern => pattern.test(relative))) continue;
    let content;
    try {
      content = await readFile(path.join(root, relative));
    } catch (error) {
      // `git ls-files -c` incluye archivos tracked borrados para poder compararlos.
      // Al omitirlos del snapshot actual, compareSnapshots los reporta como `borrado`.
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    files[relative] = {
      hash: createHash('sha256').update(content).digest('hex'),
      bytes: content.byteLength,
      lines: content.toString('utf8').split('\n').length,
    };
  }
  const { stdout: commit } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root });
  return { commit: commit.trim(), capturedAt: new Date().toISOString(), files };
}

function compareSnapshots(previous, current) {
  const paths = new Set([...Object.keys(previous.files), ...Object.keys(current.files)]);
  const changed = [];
  for (const relative of [...paths].sort()) {
    const before = previous.files[relative];
    const after = current.files[relative];
    if (before?.hash === after?.hash) continue;
    changed.push({
      path: relative,
      kind: before ? (after ? 'modificado' : 'borrado') : 'nuevo',
      bytes: Math.abs((after?.bytes ?? 0) - (before?.bytes ?? 0)),
      lines: Math.abs((after?.lines ?? 0) - (before?.lines ?? 0)),
      important: IMPORTANT_PATHS.some(pattern => pattern.test(relative)),
    });
  }
  return changed;
}

async function showDocumentationStatus() {
  const manifestPath = path.join(targets[0].destination, '.renova-docs-manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    console.log('Sin referencia previa. Ejecutá `npm run docs:sync` para crearla.');
    return;
  }
  if (!manifest.repositorySnapshot) {
    console.log('La referencia anterior no incluye un snapshot. Ejecutá `npm run docs:sync` una vez y luego `npm run docs:status`.');
    return;
  }

  const current = await repositorySnapshot();
  const changed = compareSnapshots(manifest.repositorySnapshot, current);
  if (!changed.length) {
    console.log(`Documentación al día desde ${manifest.repositorySnapshot.capturedAt}.`);
    return;
  }

  const important = changed.filter(file => file.important);
  const byteDelta = changed.reduce((total, file) => total + file.bytes, 0);
  let level = 'PEQUEÑOS';
  if (changed.length >= 20 || important.length >= 5 || byteDelta >= 100_000) level = 'ENORMES';
  else if (changed.length >= 8 || important.length >= 1 || byteDelta >= 20_000) level = 'IMPORTANTES';

  console.log(`Cambios ${level} desde la última sincronización.`);
  console.log(`${changed.length} archivos cambiaron; ${important.length} afectan zonas sensibles.`);
  for (const file of changed.slice(0, 30)) {
    console.log(`${file.important ? '!' : '-'} ${file.kind}: ${file.path}`);
  }
  if (changed.length > 30) console.log(`... y ${changed.length - 30} archivos más.`);
  console.log(level === 'PEQUEÑOS'
    ? 'Podés acumularlos y actualizar las notas al cerrar la sesión.'
    : 'Revisá y actualizá `knowledge/` antes de volver a ejecutar `npm run docs:sync`.');
}

async function listMarkdownFiles(directory, base = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listMarkdownFiles(absolute, base));
    if (entry.isFile() && entry.name.endsWith('.md')) files.push(path.relative(base, absolute));
  }
  return files.sort();
}

function validateFrontmatter(relative, content, errors) {
  if (!content.startsWith('---\n')) {
    errors.push(`${relative}: falta frontmatter`);
    return;
  }
  for (const field of ['title:', 'updated:', 'status:', 'sources:']) {
    if (!content.slice(0, content.indexOf('\n---\n', 4)).includes(field)) {
      errors.push(`${relative}: falta ${field}`);
    }
  }
}

function validateSecrets(relative, content, errors) {
  const suspicious = [
    /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
    /sb_(?:secret|publishable)_[A-Za-z0-9_-]{16,}/,
    /service_role\s*[:=]\s*["'][^"']{12,}["']/i,
    /(?:password|contraseña)\s*[:=]\s*["'][^"']{8,}["']/i,
  ];
  if (suspicious.some(pattern => pattern.test(content))) {
    errors.push(`${relative}: posible secreto incrustado`);
  }
}

async function validateSet(target) {
  const files = await listMarkdownFiles(target.source);
  const byBasename = new Map();
  const contents = new Map();
  const errors = [];

  for (const relative of files) {
    const content = await readFile(path.join(target.source, relative), 'utf8');
    contents.set(relative, content);
    const basename = path.basename(relative, '.md');
    byBasename.set(basename, (byBasename.get(basename) ?? 0) + 1);
    validateFrontmatter(relative, content, errors);
    validateSecrets(relative, content, errors);
  }

  for (const [relative, content] of contents) {
    for (const match of content.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)) {
      const targetName = path.basename(match[1].trim(), '.md');
      if (!byBasename.has(targetName)) errors.push(`${relative}: wikilink sin destino [[${match[1]}]]`);
      if ((byBasename.get(targetName) ?? 0) > 1) errors.push(`${relative}: wikilink ambiguo [[${match[1]}]]`);
    }
  }

  return { files, errors };
}

async function syncSet(target, files, snapshot) {
  const manifest = {
    generatedBy: 'scripts/sync-project-docs.mjs',
    updatedAt: new Date().toISOString(),
    managedFiles: files,
    repositorySnapshot: snapshot,
  };

  for (const relative of files) {
    const source = path.join(target.source, relative);
    const destination = path.join(target.destination, relative);
    if (dryRun) {
      console.log(`[dry-run] ${target.name}: ${relative}`);
      continue;
    }
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
    console.log(`[sync] ${target.name}: ${relative}`);
  }

  if (!dryRun) {
    await mkdir(target.destination, { recursive: true });
    await writeFile(
      path.join(target.destination, '.renova-docs-manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
  }
}

if (statusOnly) {
  await showDocumentationStatus();
  process.exit(0);
}

let failed = false;
const snapshot = checkOnly || dryRun ? null : await repositorySnapshot();
for (const target of targets) {
  const sourceStat = await stat(target.source);
  if (!sourceStat.isDirectory()) throw new Error(`Fuente inválida: ${target.source}`);
  const result = await validateSet(target);
  if (result.errors.length) {
    failed = true;
    for (const error of result.errors) console.error(`[error] ${target.name}: ${error}`);
    continue;
  }
  console.log(`[ok] ${target.name}: ${result.files.length} notas validadas`);
  if (!checkOnly) await syncSet(target, result.files, snapshot);
}

if (failed) process.exitCode = 1;
