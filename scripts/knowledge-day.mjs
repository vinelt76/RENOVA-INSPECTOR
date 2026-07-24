import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');
const journalRoot = path.join(root, 'knowledge', 'ai', 'bitacora');
const indexPath = path.join(root, 'knowledge', 'ai', '15 - Bitacora diaria.md');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COMMITS_START = '<!-- daily-commits:start -->';
const COMMITS_END = '<!-- daily-commits:end -->';
const INDEX_START = '<!-- daily-index:start -->';
const INDEX_END = '<!-- daily-index:end -->';

function limaToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function requestedDate() {
  const inline = process.argv.find(argument => argument.startsWith('--date='));
  const position = process.argv.indexOf('--date');
  const date = inline?.slice('--date='.length)
    ?? (position >= 0 ? process.argv[position + 1] : null)
    ?? limaToday();
  if (!DATE_RE.test(date)) {
    throw new Error(`Fecha inválida: ${date}. Usa YYYY-MM-DD.`);
  }
  return date;
}

async function git(args) {
  const { stdout } = await execFileAsync('git', args, { cwd: root });
  return stdout.trim();
}

async function commitsFor(date) {
  const output = await git([
    'log',
    `--since=${date} 00:00:00`,
    `--until=${date} 23:59:59`,
    '--date=iso-local',
    '--pretty=format:%h%x09%ad%x09%s',
  ]);
  if (!output) {
    return '- Aún no hay commits registrados en esta fecha; los cambios pueden seguir en el working tree.';
  }
  return output.split('\n').map(line => {
    const [hash, timestamp, ...subjectParts] = line.split('\t');
    return `- \`${hash}\` · ${timestamp} · ${subjectParts.join('\t')}`;
  }).join('\n');
}

function replaceBlock(content, start, end, body) {
  const from = content.indexOf(start);
  const to = content.indexOf(end);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`No se encontraron marcadores ${start} / ${end}.`);
  }
  return `${content.slice(0, from + start.length)}\n${body}\n${content.slice(to)}`;
}

function dailyTemplate(date, head) {
  return `---
title: "Bitácora ${date}"
updated: ${date}
status: vigente
sources: [git, working tree, tests, knowledge]
---

# Bitácora ${date}

> Registro cronológico complementario. Las reglas y el estado vigente siguen en las notas
> temáticas; esta página explica qué se tocó ese día, por qué y cómo encontrarlo en Git.

## Punto de partida

- HEAD al crear la entrada: \`${head}\`.
- Commit o PR de cierre: **pendiente**.

## Resumen

Escribir en dos o tres frases qué resultado quedó al terminar el día.

## Cambios

### Nombre breve del cambio

- **Qué cambió:**
- **Por qué:**
- **Archivos o migraciones:**
- **Validación:**
- **Riesgo y rollback:**
- **Commit o PR:** pendiente.

## Decisiones y alternativas descartadas

- Registrar por qué se eligió esta solución y qué opción se evitó.

## Deuda o siguiente paso

- Anotar únicamente trabajo real pendiente; enlazar [[10 - Roadmap deuda y riesgos]] cuando corresponda.

## Commits encontrados por Git

Este bloque se actualiza al volver a ejecutar \`npm run docs:day\`.

${COMMITS_START}
- Pendiente de consultar.
${COMMITS_END}
`;
}

async function listDailyEntries(directory = journalRoot) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const dates = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) dates.push(...await listDailyEntries(absolute));
    if (entry.isFile() && DATE_RE.test(path.basename(entry.name, '.md'))) {
      dates.push(path.basename(entry.name, '.md'));
    }
  }
  return dates.sort().reverse();
}

async function updateIndex(date) {
  const dates = await listDailyEntries();
  const years = new Map();
  for (const item of dates) {
    const year = item.slice(0, 4);
    if (!years.has(year)) years.set(year, []);
    years.get(year).push(item);
  }
  const body = [...years].map(([year, items]) => [
    `### ${year}`,
    '',
    ...items.map(item => `- [[${item}]]`),
  ].join('\n')).join('\n\n') || '- Aún no hay entradas.';

  let index = await readFile(indexPath, 'utf8');
  index = index.replace(/^updated: \d{4}-\d{2}-\d{2}$/m, `updated: ${date}`);
  index = replaceBlock(index, INDEX_START, INDEX_END, body);
  await writeFile(indexPath, index, 'utf8');
}

const date = requestedDate();
const year = date.slice(0, 4);
const dailyPath = path.join(journalRoot, year, `${date}.md`);
await mkdir(path.dirname(dailyPath), { recursive: true });

let content;
try {
  content = await readFile(dailyPath, 'utf8');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
  content = dailyTemplate(date, await git(['rev-parse', '--short', 'HEAD']));
}
content = replaceBlock(content, COMMITS_START, COMMITS_END, await commitsFor(date));
await writeFile(dailyPath, content, 'utf8');
await updateIndex(date);

console.log(path.relative(root, dailyPath));
console.log('Índice cronológico actualizado.');
