#!/usr/bin/env npx tsx
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { lintHTML } from './html-linter.js';
import { lintManifest } from './manifest-linter.js';
import { checkAlignment } from './alignment-checker.js';
import { auditHTML } from './accessibility-auditor.js';
import { renderURL } from './renderer.js';

function printAuditReport(result: ReturnType<typeof auditHTML>): void {
  console.log('\n=== Agent Accessibility Audit ===\n');
  for (const cat of result.categories) {
    console.log(`  ${cat.category.toUpperCase().padEnd(10)} ${cat.score}/100`);
    for (const check of cat.checks) {
      const icon = check.status === 'pass' ? '+' : check.status === 'fail' ? '-' : '~';
      console.log(`    [${icon}] ${check.message}`);
    }
  }
  console.log(`\n  OVERALL: ${result.overallScore}/100 — ${result.summary}\n`);
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

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--html' && i + 1 < args.length) htmlPath = args[++i];
    if (args[i] === '--manifest' && i + 1 < args.length) manifestPath = args[++i];
    if (args[i] === '--schema' && i + 1 < args.length) schemaPath = args[++i];
    if (args[i] === '--audit' && i + 1 < args.length) auditPath = args[++i];
    if (args[i] === '--render') render = true;
  }

  if (!htmlPath && !manifestPath && !auditPath) {
    console.error('Usage: agent-lint --html <path|url> [--render] --manifest <path> [--schema <path>]');
    console.error('       agent-lint --audit <path|url> [--render] [--manifest <path>]');
    console.error('\n  --render  Use headless Chromium to render JavaScript (requires playwright)');
    process.exit(1);
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
    const html = await readHTML(auditPath, render);
    hintSPAIfNeeded(html, auditPath);
    const manifest = manifestPath
      ? JSON.parse(readFileSync(resolve(manifestPath), 'utf-8'))
      : undefined;
    const result = auditHTML(html, { manifest });
    printAuditReport(result);
    if (result.overallScore < 50) process.exit(1);
    return;
  }

  if (htmlPath) {
    const html = await readHTML(htmlPath, render);
    hintSPAIfNeeded(html, htmlPath);
    const htmlResults = lintHTML(html, htmlPath);
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
