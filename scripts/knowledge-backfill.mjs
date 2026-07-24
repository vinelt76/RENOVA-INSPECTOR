import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');
const journalRoot = path.join(root, 'knowledge', 'ai', 'bitacora');
const aiKnowledgeRoot = path.join(root, 'knowledge', 'ai');
const force = process.argv.includes('--force');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COMMITS_START = '<!-- daily-commits:start -->';
const COMMITS_END = '<!-- daily-commits:end -->';

async function git(args) {
  const { stdout } = await execFileAsync('git', ['-c', 'core.quotePath=false', ...args], {
    cwd: root,
    maxBuffer: 20 * 1024 * 1024,
  });
  return stdout.trim();
}

function argument(name) {
  const inline = process.argv.find(value => value.startsWith(`--${name}=`));
  const position = process.argv.indexOf(`--${name}`);
  const value = inline?.slice(name.length + 3)
    ?? (position >= 0 ? process.argv[position + 1] : null);
  if (value && !DATE_RE.test(value)) throw new Error(`${name} debe usar YYYY-MM-DD.`);
  return value;
}

function markdownText(value) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/[<>]/g, "")
    .trim();
}

function scopeFor(paths) {
  const scopes = [];
  const rules = [
    ["Aplicación móvil", /^app\//],
    ["Backend histórico", /^backend\//],
    ["Dashboards web", /^WEB\//],
    ["Prototipos web históricos", /^(?:UI\/|[^/]+\.html$)/],
    ["Supabase", /^supabase\//],
    ["Pruebas", /(?:^|\/)(?:__tests__|tests?)(?:\/|$)|\.(?:test|spec)\./],
    ["CI/CD", /^\.github\/workflows\//],
    ["Documentación y decisiones", /^(?:knowledge|docs|decisions|specs|tasks_[^/]+)\//],
    ["Configuración y dependencias", /(?:^|\/)(?:package(?:-lock)?\.json|vite\.config|capacitor\.config)/],
  ];
  for (const [label, pattern] of rules) {
    if (paths.some(file => pattern.test(file))) scopes.push(label);
  }
  return scopes.length ? scopes.join(", ") : "Otros archivos del repositorio";
}

function relevantSources(paths) {
  return paths.filter(file => /^(?:decisions|specs|docs|tasks_[^/]+|knowledge)\//.test(file));
}

async function commitStats(hash) {
  const output = await git(['show', '--numstat', '--format=', '--find-renames', hash]);
  const paths = [];
  let additions = 0;
  let deletions = 0;
  for (const line of output.split('\n').filter(Boolean)) {
    const [added, removed, ...pathParts] = line.split('\t');
    const file = pathParts.join('\t');
    if (!file) continue;
    paths.push(file);
    if (/^\d+$/.test(added)) additions += Number(added);
    if (/^\d+$/.test(removed)) deletions += Number(removed);
  }
  return { paths, additions, deletions };
}

async function githubBase() {
  const remote = await git(['remote', 'get-url', 'origin']).catch(() => "");
  const match = remote.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/);
  return match ? `https://github.com/${match[1]}/${match[2].replace(/\.git$/, "")}` : null;
}

async function commits() {
  const output = await git([
    'log',
    '--reverse',
    '--date=format-local:%Y-%m-%dT%H:%M:%S%z',
    '--pretty=format:%x1e%H%x1f%h%x1f%ad%x1f%an%x1f%P%x1f%s%x1f%b',
  ]);
  return output.split('\x1e').filter(Boolean).map(record => {
    const [hash, short, timestamp, author, parents, subject, ...body] = record.split('\x1f');
    return {
      hash,
      short,
      timestamp,
      date: timestamp.slice(0, 10),
      author,
      parents: parents.split(" ").filter(Boolean),
      subject: markdownText(subject),
      body: markdownText(body.join('\x1f')),
    };
  });
}

async function relatedKnowledge(date) {
  const files = await readdir(aiKnowledgeRoot, { withFileTypes: true });
  const notes = [];
  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith('.md') || file.name.startsWith('15 - ')) continue;
    const content = await readFile(path.join(aiKnowledgeRoot, file.name), 'utf8');
    if (content.match(/^updated: (\d{4}-\d{2}-\d{2})$/m)?.[1] !== date) continue;
    notes.push(`- [[${path.basename(file.name, '.md')}]]`);
  }
  return notes.length ? notes.join('\n') : '- No hay una nota temática con `updated` en esta fecha.';
}

function commitSection(commit, stats, repository) {
  const bodyWords = commit.body.split(/\s+/).filter(Boolean);
  const hasUsefulReason = commit.body.length >= 20
    && bodyWords.length >= 4
    && commit.body.toLocaleLowerCase() !== commit.subject.toLocaleLowerCase();
  const reason = hasUsefulReason
    ? commit.body.split('\n').map(line => `  ${line}`).join('\n')
    : "No quedó explicado en el mensaje del commit; revisar el diff y las fuentes contextuales.";
  const displayed = stats.paths.slice(0, 12).map(file => `  - \`${file}\``);
  if (stats.paths.length > 12) displayed.push(`  - … y ${stats.paths.length - 12} archivos más.`);
  const sources = relevantSources(stats.paths);
  const evidence = stats.paths.some(file => /(?:^|\/)(?:__tests__|tests?)(?:\/|$)|\.(?:test|spec)\.|^\.github\/workflows\//.test(file))
    ? "El commit incluye archivos de prueba o CI; eso no demuestra por sí solo que se ejecutaron correctamente."
    : "No quedó evidencia de pruebas dentro del diff; consultar notas o CI de esa fecha.";
  const link = repository
    ? `[${commit.short}](${repository}/commit/${commit.hash})`
    : `\`${commit.short}\``;
  return `### ${link} — ${commit.subject || "(sin asunto útil)"}

- **Hora y autor:** ${commit.timestamp.replace("T", " ")} · ${markdownText(commit.author)}.
- **Tipo:** ${commit.parents.length > 1 ? "merge" : "commit"}.
- **Qué cambió según Git:** ${commit.subject || "el mensaje no lo describe"}.
- **Por qué:** ${reason}
- **Alcance reconstruido:** ${scopeFor(stats.paths)}.
- **Tamaño:** ${stats.paths.length} archivo${stats.paths.length === 1 ? "" : "s"} · +${stats.additions} / −${stats.deletions} líneas.
- **Validación recuperable:** ${evidence}
- **Archivos principales:**
${displayed.length ? displayed.join('\n') : "  - Git no reportó archivos para este commit."}
- **Fuentes contextuales modificadas:** ${sources.length ? sources.map(file => `\`${file}\``).join(", ") : "ninguna dentro del commit"}.
- **Inspección local:** \`git show ${commit.hash}\`.
- **Riesgo y rollback:** no inferido automáticamente; revisar el diff y los commits posteriores antes de revertir.
`;
}

function commitList(dayCommits, repository) {
  return dayCommits.map(commit => {
    const reference = repository
      ? `[${commit.short}](${repository}/commit/${commit.hash})`
      : `\`${commit.short}\``;
    return `- ${reference} · ${commit.timestamp.replace("T", " ")} · ${commit.subject || "(sin asunto útil)"}`;
  }).join('\n');
}

function dailyDocument(date, dayCommits, sections, notes, repository, totals) {
  return `---
title: "Bitácora ${date}"
updated: ${date}
status: historico
sources: [git log, git show, repository history, knowledge]
---

# Bitácora ${date}

> Reconstrucción automática realizada el 2026-07-23. Conserva evidencia verificable de Git, pero
> no inventa intención, pruebas ni decisiones que no hayan quedado escritas. Para el estado vigente,
> seguir [[00 - LEER PRIMERO]] y las notas temáticas enlazadas.

## Resumen reconstruido

- ${dayCommits.length} commit${dayCommits.length === 1 ? "" : "s"}.
- ${totals.files.size} archivo${totals.files.size === 1 ? "" : "s"} distinto${totals.files.size === 1 ? "" : "s"}.
- +${totals.additions} / −${totals.deletions} líneas sumadas por commit; los merges pueden repetir cambios.
- Áreas: ${scopeFor([...totals.files])}.

## Cambios por commit

${sections.join('\n')}
## Notas temáticas actualizadas en esa fecha

${notes}

## Cómo investigar este día

1. Abrir el commit exacto con el enlace o \`git show HASH\`.
2. Leer primero cualquier ADR, spec, task o documento listado como fuente contextual.
3. Comparar con commits posteriores antes de concluir que el comportamiento sigue vigente.
4. No revertir por fecha completa: aislar el commit y verificar dependencias.

## Commits encontrados por Git

${COMMITS_START}
${commitList(dayCommits, repository)}
${COMMITS_END}
`;
}

const since = argument('since');
const until = argument('until');
const repository = await githubBase();
const all = (await commits()).filter(commit => (
  (!since || commit.date >= since) && (!until || commit.date <= until)
));
const byDate = new Map();
for (const commit of all) {
  if (!byDate.has(commit.date)) byDate.set(commit.date, []);
  byDate.get(commit.date).push(commit);
}

let created = 0;
let skipped = 0;
for (const [date, dayCommits] of byDate) {
  const target = path.join(journalRoot, date.slice(0, 4), `${date}.md`);
  try {
    await readFile(target, 'utf8');
    if (!force) {
      skipped += 1;
      continue;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const sections = [];
  const totals = { files: new Set(), additions: 0, deletions: 0 };
  for (const commit of dayCommits) {
    const stats = await commitStats(commit.hash);
    stats.paths.forEach(file => totals.files.add(file));
    totals.additions += stats.additions;
    totals.deletions += stats.deletions;
    sections.push(commitSection(commit, stats, repository));
  }

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(
    target,
    dailyDocument(
      date,
      dayCommits,
      sections,
      await relatedKnowledge(date),
      repository,
      totals,
    ),
    'utf8',
  );
  created += 1;
}

await execFileAsync(
  process.execPath,
  [path.join(root, 'scripts', 'knowledge-day.mjs')],
  { cwd: root },
);
console.log(`Backfill terminado: ${created} días creados, ${skipped} existentes preservados.`);
