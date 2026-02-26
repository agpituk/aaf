#!/usr/bin/env npx tsx
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { lintHTML } from './html-linter.js';
import { lintManifest } from './manifest-linter.js';
import { checkAlignment } from './alignment-checker.js';
import { auditHTML, scoreSummary } from './accessibility-auditor.js';
import { renderURL } from './renderer.js';
import { crawlSite } from './crawler.js';
import type { AuditResult } from './types.js';

function printAuditReport(result: ReturnType<typeof auditHTML>): void {
  console.log('\n=== Agent Accessibility Audit ===\n');
  for (const cat of result.categories) {
    const scoreLabel = cat.empty ? 'N/A' : `${cat.score}/100`;
    console.log(`  ${cat.category.toUpperCase().padEnd(10)} ${scoreLabel}`);
    for (const check of cat.checks) {
      const icon = check.status === 'pass' ? '+' : check.status === 'fail' ? '-' : '~';
      console.log(`    [${icon}] ${check.message}`);
    }
  }
  console.log(`\n  OVERALL: ${result.overallScore}/100 — ${result.summary}\n`);
}

function printSiteAuditReport(pages: Array<{ url: string; result: AuditResult }>): void {
  console.log('\n=== Agent Accessibility Audit (Site) ===\n');
  for (const page of pages) {
    const cats = page.result.categories
      .map((c) => `${c.category.toUpperCase()} ${c.empty ? '-' : c.score}`)
      .join('  ');
    console.log(`  PAGE: ${page.url}`);
    console.log(`    ${cats}  → ${page.result.overallScore}/100\n`);
  }
  const avg = Math.round(
    pages.reduce((sum, p) => sum + p.result.overallScore, 0) / pages.length,
  );
  console.log(`  SITE OVERALL: ${avg}/100 (${pages.length} pages) — ${scoreSummary(avg)}\n`);
}

async function tryFetchManifest(origin: string): Promise<Record<string, unknown> | undefined> {
  try {
    const url = origin + '/.well-known/agent-manifest.json';
    const res = await fetch(url);
    if (!res.ok) return undefined;
    return await res.json() as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function isURL(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

async function fetchHTML(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

const SPA_ROOT_RE = /<div\s+id=["'](root|app|__next|__nuxt)["'][^>]*>\s*<\/div>/i;

function looksLikeSPA(html: string): boolean {
  if (!SPA_ROOT_RE.test(html)) return false;
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) return false;
  const bodyText = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, '').trim();
  return bodyText.length < 50;
}

function readHTML(pathOrUrl: string, render = false): string | Promise<string> {
  if (isURL(pathOrUrl) && render) return renderURL(pathOrUrl);
  if (isURL(pathOrUrl)) return fetchHTML(pathOrUrl);
  return readFileSync(resolve(pathOrUrl), 'utf-8');
}

async function main() {
  const args = process.argv.slice(2);
  let htmlPath = '';
  let manifestPath = '';
  let schemaPath = '';
  let auditPath = '';
  let render = false;
  let crawl = false;
  let safety = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    const hasValue = next !== undefined && !next.startsWith('--');

    if (arg === '--html' && hasValue) htmlPath = args[++i];
    else if (arg === '--manifest' && hasValue) manifestPath = args[++i];
    else if (arg === '--schema' && hasValue) schemaPath = args[++i];
    else if (arg === '--audit' && hasValue) auditPath = args[++i];
    else if (arg === '--render') render = true;
    else if (arg === '--crawl') crawl = true;
    else if (arg === '--safety') safety = true;
  }

  if (!htmlPath && !manifestPath && !auditPath) {
    console.error('Usage: aaf-lint --html <path|url> [--render] --manifest <path> [--schema <path>]');
    console.error('       aaf-lint --audit <path|url> [--render] [--crawl] [--safety] [--manifest <path>]');
    console.error('\n  --render  Use headless Chromium to render JavaScript (requires playwright)');
    console.error('  --crawl   Follow same-origin links on the entry page and audit each (URL only)');
    console.error('  --safety  Include safety checks (dangerous button annotations)');
    process.exit(1);
  }

  if (crawl && !auditPath) {
    console.error('Warning: --crawl only works with --audit <url>. Ignoring.');
    crawl = false;
  }

  if (crawl && auditPath && !isURL(auditPath)) {
    console.error('Warning: --crawl only works with a URL target. Ignoring.');
    crawl = false;
  }

  let hasErrors = false;
  let spaHinted = false;

  function hintSPAIfNeeded(html: string, target: string): void {
    if (!render && !spaHinted && isURL(target) && looksLikeSPA(html)) {
      spaHinted = true;
      console.error(
        '\nHint: This looks like a single-page app whose content is rendered by JavaScript.' +
        '\n      Re-run with --render to audit the fully rendered page.\n'
      );
    }
  }

  if (auditPath) {
    // Auto-discover manifest if auditing a URL and no --manifest provided
    const manifest = manifestPath
      ? JSON.parse(readFileSync(resolve(manifestPath), 'utf-8'))
      : isURL(auditPath)
        ? await tryFetchManifest(new URL(auditPath).origin)
        : undefined;

    if (crawl && isURL(auditPath)) {
      const pages = await crawlSite(auditPath, (url) => readHTML(url, render) as Promise<string>);
      if (pages.length > 0) hintSPAIfNeeded(pages[0].html, auditPath);
      const pageResults = pages.map((page) => ({
        url: page.url,
        result: auditHTML(page.html, { manifest, safety }),
      }));
      printSiteAuditReport(pageResults);
      const avg = Math.round(
        pageResults.reduce((sum, p) => sum + p.result.overallScore, 0) / pageResults.length,
      );
      if (avg < 50) process.exit(1);
    } else {
      const html = await readHTML(auditPath, render);
      hintSPAIfNeeded(html, auditPath);
      const result = auditHTML(html, { manifest, safety });
      printAuditReport(result);
      if (result.overallScore < 50) process.exit(1);
    }
    return;
  }

  if (htmlPath) {
    const html = await readHTML(htmlPath, render);
    hintSPAIfNeeded(html, htmlPath);
    const htmlResults = lintHTML(html, htmlPath);
    if (htmlResults.length === 0) {
      console.log('No lint issues found.');
    }
    for (const r of htmlResults) {
      const loc = r.line ? `:${r.line}` : '';
      console.log(`[${r.severity}] ${r.source}${loc}: ${r.message}`);
      if (r.severity === 'error') hasErrors = true;
    }
  }

  if (manifestPath && schemaPath) {
    const manifest = JSON.parse(readFileSync(resolve(manifestPath), 'utf-8'));
    const schema = JSON.parse(readFileSync(resolve(schemaPath), 'utf-8'));
    const manifestResults = lintManifest(manifest, schema, manifestPath);
    for (const r of manifestResults) {
      console.log(`[${r.severity}] ${r.source}: ${r.message}`);
      if (r.severity === 'error') hasErrors = true;
    }
  }

  if (htmlPath && manifestPath) {
    const html = await readHTML(htmlPath, render);
    const manifest = JSON.parse(readFileSync(resolve(manifestPath), 'utf-8'));
    const alignResults = checkAlignment(html, manifest);
    for (const r of alignResults) {
      console.log(`[${r.severity}] ${r.message}`);
    }
  }

  if (hasErrors) process.exit(1);
}

main();
