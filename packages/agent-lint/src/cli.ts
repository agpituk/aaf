#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { lintHTML } from './html-linter.js';
import { lintManifest } from './manifest-linter.js';
import { checkAlignment } from './alignment-checker.js';
import { auditHTML } from './accessibility-auditor.js';

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

function main() {
  const args = process.argv.slice(2);
  let htmlPath = '';
  let manifestPath = '';
  let schemaPath = '';
  let auditPath = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--html' && i + 1 < args.length) htmlPath = args[++i];
    if (args[i] === '--manifest' && i + 1 < args.length) manifestPath = args[++i];
    if (args[i] === '--schema' && i + 1 < args.length) schemaPath = args[++i];
    if (args[i] === '--audit' && i + 1 < args.length) auditPath = args[++i];
  }

  if (!htmlPath && !manifestPath && !auditPath) {
    console.error('Usage: agent-lint --html <path> --manifest <path> [--schema <path>]');
    console.error('       agent-lint --audit <path> [--manifest <path>]');
    process.exit(1);
  }

  let hasErrors = false;

  if (auditPath) {
    const html = readFileSync(resolve(auditPath), 'utf-8');
    const manifest = manifestPath
      ? JSON.parse(readFileSync(resolve(manifestPath), 'utf-8'))
      : undefined;
    const result = auditHTML(html, { manifest });
    printAuditReport(result);
    if (result.overallScore < 50) process.exit(1);
    return;
  }

  if (htmlPath) {
    const html = readFileSync(resolve(htmlPath), 'utf-8');
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
    const html = readFileSync(resolve(htmlPath), 'utf-8');
    const manifest = JSON.parse(readFileSync(resolve(manifestPath), 'utf-8'));
    const alignResults = checkAlignment(html, manifest);
    for (const r of alignResults) {
      console.log(`[${r.severity}] ${r.message}`);
    }
  }

  if (hasErrors) process.exit(1);
}

main();
