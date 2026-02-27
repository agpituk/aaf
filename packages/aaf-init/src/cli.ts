#!/usr/bin/env npx tsx
/**
 * aaf-init — Scaffold an AAF manifest from existing HTML files.
 *
 * Usage:
 *   npx aaf-init [directory] [--name <name>] [--origin <url>]
 */
import * as fs from 'fs';
import * as path from 'path';
import { detectProjectType, manifestOutputDir } from './detect.js';
import { findHtmlFiles } from './scanner.js';
import { scanHtml, scanDataViews, generateManifest } from '@agent-accessibility-framework/vite-plugin';
import type { ScannedAction, ScannedDataView } from '@agent-accessibility-framework/vite-plugin';

// ─── ANSI helpers ──────────────────────────────────────────────────────
function log(label: string, msg: string) {
  console.log(`\x1b[36m[${label}]\x1b[0m ${msg}`);
}
function success(msg: string) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`);
}
function warn(msg: string) {
  console.log(`\x1b[33m⚠\x1b[0m ${msg}`);
}
function dim(msg: string) {
  console.log(`\x1b[90m  ${msg}\x1b[0m`);
}

// ─── Parse args ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let directory = '.';
let siteName = '';
let siteOrigin = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--name' && args[i + 1]) {
    siteName = args[++i];
  } else if (args[i] === '--origin' && args[i + 1]) {
    siteOrigin = args[++i];
  } else if (!args[i].startsWith('-')) {
    directory = args[i];
  }
}

const dir = path.resolve(directory);
if (!fs.existsSync(dir)) {
  console.error(`\x1b[31mDirectory not found: ${dir}\x1b[0m`);
  process.exit(1);
}

// ─── Detect project type ──────────────────────────────────────────────
const projectType = detectProjectType(dir);
log('detect', `Project type: ${projectType}`);

// ─── Find & scan HTML files ───────────────────────────────────────────
const htmlFiles = findHtmlFiles(dir);

if (htmlFiles.length === 0) {
  warn('No HTML files found.');
  process.exit(0);
}

log('scan', `Found ${htmlFiles.length} HTML file(s)`);

const allActions: ScannedAction[] = [];
const allViews: ScannedDataView[] = [];
const pageMap: Record<string, { actions: string[]; data: string[] }> = {};

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf-8');
  const actions = scanHtml(html);
  const views = scanDataViews(html);

  if (actions.length === 0 && views.length === 0) continue;

  // Derive a route from the file path relative to the project dir
  const rel = path.relative(dir, file);
  let route = '/' + rel.replace(/\\/g, '/').replace(/index\.html?$/i, '');
  if (!route.endsWith('/')) route += '/';

  for (const a of actions) {
    // Avoid duplicates
    if (!allActions.some(x => x.action === a.action)) {
      allActions.push(a);
    }
  }
  for (const v of views) {
    if (!allViews.some(x => x.name === v.name)) {
      allViews.push(v);
    }
  }

  pageMap[route] = {
    actions: actions.map(a => a.action),
    data: views.map(v => v.name),
  };

  dim(`${rel}: ${actions.length} action(s), ${views.length} data view(s)`);
}

if (allActions.length === 0 && allViews.length === 0) {
  warn('No AAF-annotated elements found in any HTML file.');
  warn('Add data-agent-* attributes to your forms, buttons, and data tables first.');
  process.exit(0);
}

// ─── Generate manifest ────────────────────────────────────────────────
const name = siteName || path.basename(dir);
const origin = siteOrigin || 'http://localhost:3000';

const manifest = generateManifest(allActions, { name, origin }, pageMap, allViews.length > 0 ? allViews : undefined);

// ─── Write manifest ───────────────────────────────────────────────────
const outDir = manifestOutputDir(dir, projectType);
const wellKnownDir = path.join(outDir, '.well-known');

if (!fs.existsSync(wellKnownDir)) {
  fs.mkdirSync(wellKnownDir, { recursive: true });
}

const manifestPath = path.join(wellKnownDir, 'agent-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

success(`Manifest written to ${path.relative(dir, manifestPath)}`);
log('summary', `${allActions.length} action(s), ${allViews.length} data view(s), ${Object.keys(pageMap).length} page(s)`);

// ─── Print suggestions ────────────────────────────────────────────────
console.log('');
console.log('\x1b[1mNext steps:\x1b[0m');

if (projectType === 'vite') {
  console.log('  1. Install the Vite plugin for auto-sync:');
  dim('npm install @agent-accessibility-framework/vite-plugin');
  console.log('  2. Add to vite.config.ts:');
  dim("import { aafPlugin } from '@agent-accessibility-framework/vite-plugin'");
  dim('plugins: [aafPlugin()]');
}

console.log(`  ${projectType === 'vite' ? '3' : '1'}. Add the agent widget to your HTML:`);
dim('<script src="https://unpkg.com/@agent-accessibility-framework/agent-widget"></script>');
console.log(`  ${projectType === 'vite' ? '4' : '2'}. Validate with the linter:`);
dim('npx aaf-lint');
