#!/usr/bin/env node
/**
 * Regenerates docs/traceability.md by scanning:
 *   specs/      — AC definitions (ID + title)
 *   apps/web/src/**\/*.spec.ts — unit test coverage per AC
 *   apps/web/e2e/**\/*.spec.ts  — e2e test coverage per AC
 *   apps/web/src/**\/*.ts       — source files referencing each AC
 *   docs/adr/                  — ADRs referencing each AC
 *   git log                    — commits referencing each AC
 *   reviews/                   — review findings referencing each AC
 *
 * Run: node scripts/traceability.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readText(path) {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

function walk(dir, ext, out = []) {
  if (!statSync(dir, { throwIfNoEntry: false })) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
      walk(full, ext, out);
    } else if (entry.isFile() && full.endsWith(ext)) {
      out.push(full);
    }
  }
  return out;
}

function relPath(abs) {
  return relative(ROOT, abs);
}

// ---------------------------------------------------------------------------
// 1. Collect all AC IDs and their titles from specs/
// ---------------------------------------------------------------------------

const AC_TITLE_RE = /^#\s+(AC-\d{2}\.\d+)\s+—\s+(.+)/m;
const AC_INLINE_RE = /AC-(\d{2})\.(\d+)/g;

const specFiles = walk(join(ROOT, 'specs'), '.md');
/** @type {Map<string, string>} acId → title */
const acTitles = new Map();

for (const f of specFiles) {
  const text = readText(f);
  for (const m of text.matchAll(/^#\s+(AC-\d{2}\.\d+)\s+—\s+(.+)/gm)) {
    acTitles.set(m[1].trim(), m[2].trim());
  }
}

// ---------------------------------------------------------------------------
// 2. Test coverage — unit (Vitest) and e2e (Playwright)
// ---------------------------------------------------------------------------

/** @type {Map<string, {unit: string[], e2e: string[]}>} */
const testCoverage = new Map();

function initAc(id) {
  if (!testCoverage.has(id)) testCoverage.set(id, { unit: [], e2e: [] });
  return testCoverage.get(id);
}

// Unit tests
const unitFiles = walk(join(ROOT, 'apps/web/src'), '.spec.ts');
for (const f of unitFiles) {
  const text = readText(f);
  const rel = relPath(f);
  const ids = new Set();
  for (const m of text.matchAll(/it\(`?(AC-\d{2}\.\d+)/g)) ids.add(m[1]);
  for (const m of text.matchAll(/it\('(AC-\d{2}\.\d+)/g)) ids.add(m[1]);
  for (const id of ids) initAc(id).unit.push(rel);
}

// E2e tests
const e2eFiles = walk(join(ROOT, 'apps/web/e2e'), '.spec.ts');
for (const f of e2eFiles) {
  const text = readText(f);
  const rel = relPath(f);
  const ids = new Set();
  for (const m of text.matchAll(/test\(`?(AC-\d{2}\.\d+)/g)) ids.add(m[1]);
  for (const m of text.matchAll(/test\('(AC-\d{2}\.\d+)/g)) ids.add(m[1]);
  // also test.describe
  for (const m of text.matchAll(/test\.describe\('(AC-\d{2}\.\d+)/g)) ids.add(m[1]);
  for (const id of ids) initAc(id).e2e.push(rel);
}

// ---------------------------------------------------------------------------
// 3. Source files referencing each AC (non-test .ts)
// ---------------------------------------------------------------------------

/** @type {Map<string, string[]>} acId → source files */
const sourceFiles = new Map();

const allTs = walk(join(ROOT, 'apps/web/src'), '.ts')
  .filter(f => !f.endsWith('.spec.ts'));

for (const f of allTs) {
  const text = readText(f);
  const rel = relPath(f);
  const ids = new Set();
  for (const m of text.matchAll(/AC-(\d{2})\.(\d+)/g)) ids.add(`AC-${m[1]}.${m[2]}`);
  for (const id of ids) {
    if (!sourceFiles.has(id)) sourceFiles.set(id, []);
    sourceFiles.get(id).push(rel);
  }
}

// CMS source files
const cmsTs = walk(join(ROOT, 'apps/cms/src'), '.ts');
for (const f of cmsTs) {
  const text = readText(f);
  const rel = relPath(f);
  const ids = new Set();
  for (const m of text.matchAll(/AC-(\d{2})\.(\d+)/g)) ids.add(`AC-${m[1]}.${m[2]}`);
  for (const id of ids) {
    if (!sourceFiles.has(id)) sourceFiles.set(id, []);
    sourceFiles.get(id).push(rel);
  }
}

// ---------------------------------------------------------------------------
// 4. ADRs referencing each AC
// ---------------------------------------------------------------------------

/** @type {Map<string, string[]>} acId → ADR IDs */
const adrRefs = new Map();

const adrFiles = walk(join(ROOT, 'docs/adr'), '.md');
for (const f of adrFiles) {
  const text = readText(f);
  const adrMatch = text.match(/^id:\s*(ADR-\d+)/m);
  if (!adrMatch) continue;
  const adrId = adrMatch[1];
  const ids = new Set();
  for (const m of text.matchAll(/AC-(\d{2})\.(\d+)/g)) ids.add(`AC-${m[1]}.${m[2]}`);
  for (const id of ids) {
    if (!adrRefs.has(id)) adrRefs.set(id, []);
    if (!adrRefs.get(id).includes(adrId)) adrRefs.get(id).push(adrId);
  }
}

// ---------------------------------------------------------------------------
// 5. Commits referencing each AC
// ---------------------------------------------------------------------------

/** @type {Map<string, string[]>} acId → short SHAs */
const commitRefs = new Map();

try {
  const log = execSync('git log --oneline --all', { cwd: ROOT, encoding: 'utf8' });
  for (const line of log.split('\n').filter(Boolean)) {
    const sha = line.slice(0, 7);
    const ids = new Set();
    for (const m of line.matchAll(/AC-(\d{2})\.(\d+)/g)) ids.add(`AC-${m[1]}.${m[2]}`);
    for (const id of ids) {
      if (!commitRefs.has(id)) commitRefs.set(id, []);
      if (!commitRefs.get(id).includes(sha)) commitRefs.get(id).push(sha);
    }
  }
} catch { /* git not available */ }

// ---------------------------------------------------------------------------
// 6. Review findings referencing each AC
// ---------------------------------------------------------------------------

/** @type {Map<string, string[]>} acId → review IDs */
const reviewRefs = new Map();

const reviewFiles = walk(join(ROOT, 'reviews'), '.md');
for (const f of reviewFiles) {
  const text = readText(f);
  const revMatch = text.match(/^id:\s*(REV-\S+)/m);
  if (!revMatch) continue;
  const revId = revMatch[1];
  const ids = new Set();
  for (const m of text.matchAll(/AC-(\d{2})\.(\d+)/g)) ids.add(`AC-${m[1]}.${m[2]}`);
  for (const id of ids) {
    if (!reviewRefs.has(id)) reviewRefs.set(id, []);
    if (!reviewRefs.get(id).includes(revId)) reviewRefs.get(id).push(revId);
  }
}

// ---------------------------------------------------------------------------
// 7. Render docs/traceability.md
// ---------------------------------------------------------------------------

const now = new Date().toISOString().slice(0, 10);

function fmt(arr) { return arr.length ? arr.join(', ') : '—'; }

// Collect all AC IDs from titles + any extra found in tests
const allAcIds = new Set([...acTitles.keys()]);
for (const id of testCoverage.keys()) allAcIds.add(id);
const sortedIds = [...allAcIds].sort((a, b) => {
  const [, us1, n1] = a.match(/AC-(\d+)\.(\d+)/) ?? [];
  const [, us2, n2] = b.match(/AC-(\d+)\.(\d+)/) ?? [];
  return Number(us1) - Number(us2) || Number(n1) - Number(n2);
});

let md = `# Matriz de trazabilidad\n\n`;
md += `> Generado automáticamente por \`scripts/traceability.mjs\` el ${now}.\n`;
md += `> No editar a mano — regenerar con \`node scripts/traceability.mjs\`.\n\n`;

// --- Summary table ---
md += `## Resumen por historia\n\n`;
md += `| Historia | ACs | Unit ✓ | E2e ✓ | Sin test |\n`;
md += `|----------|-----|--------|-------|----------|\n`;

const stories = [...new Set(sortedIds.map(id => id.match(/AC-(\d+)\./)?.[1]))].sort();
for (const us of stories) {
  const acs = sortedIds.filter(id => id.startsWith(`AC-${us}.`));
  const withUnit = acs.filter(id => (testCoverage.get(id)?.unit?.length ?? 0) > 0);
  const withE2e  = acs.filter(id => (testCoverage.get(id)?.e2e?.length ?? 0) > 0);
  const noTest   = acs.filter(id => {
    const c = testCoverage.get(id);
    return !c || (c.unit.length === 0 && c.e2e.length === 0);
  });
  md += `| US-${us} | ${acs.length} | ${withUnit.length} | ${withE2e.length} | ${noTest.length} |\n`;
}

md += `\n## Detalle por AC\n\n`;
md += `| AC | Título | ADRs | Commits | Unit tests | E2e tests | Reviews |\n`;
md += `|----|--------|------|---------|------------|-----------|---------|\n`;

for (const id of sortedIds) {
  const title  = acTitles.get(id) ?? '_(no encontrado en spec)_';
  const adrs   = fmt(adrRefs.get(id) ?? []);
  const commits = fmt(commitRefs.get(id) ?? []);
  const unit   = fmt((testCoverage.get(id)?.unit ?? []).map(f => `\`${f.split('/').pop()}\``));
  const e2e    = fmt((testCoverage.get(id)?.e2e ?? []).map(f => `\`${f.split('/').pop()}\``));
  const revs   = fmt(reviewRefs.get(id) ?? []);
  md += `| ${id} | ${title} | ${adrs} | ${commits} | ${unit} | ${e2e} | ${revs} |\n`;
}

md += `\n## Implementación por archivo\n\n`;
md += `| Archivo | ACs que cubre |\n`;
md += `|---------|---------------|\n`;

/** @type {Map<string, Set<string>>} */
const fileToAcs = new Map();
for (const [acId, files] of sourceFiles) {
  for (const f of files) {
    if (!fileToAcs.has(f)) fileToAcs.set(f, new Set());
    fileToAcs.get(f).add(acId);
  }
}
for (const [file, acs] of [...fileToAcs.entries()].sort()) {
  const sorted = [...acs].sort();
  md += `| \`${file}\` | ${sorted.join(', ')} |\n`;
}

writeFileSync(join(ROOT, 'docs/traceability.md'), md, 'utf8');
console.log(`docs/traceability.md regenerated (${sortedIds.length} ACs, ${fileToAcs.size} source files).`);
