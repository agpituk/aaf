#!/usr/bin/env node
/**
 * Builds each extension entry point as a self-contained IIFE bundle using esbuild.
 * Firefox extension content scripts and background scripts must be classic scripts
 * (no ES module imports). esbuild bundles everything into a single file per entry.
 */
import * as esbuild from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { rmSync, cpSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const entries = [
  { in: 'src/content/content-script.ts', out: 'content-script' },
  { in: 'src/content/harbor-page-script.ts', out: 'harbor-page-script' },
  { in: 'src/background/background.ts', out: 'background' },
  { in: 'src/sidebar/sidebar.ts', out: 'sidebar' },
];

// Clean dist
rmSync(resolve(__dirname, 'dist'), { recursive: true, force: true });

// Build all entry points
await esbuild.build({
  entryPoints: entries.map(e => ({
    in: resolve(__dirname, e.in),
    out: e.out,
  })),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['firefox109'],
  outdir: resolve(__dirname, 'dist'),
  minify: false,
  // Granular aliases — resolve individual modules, NOT barrel exports.
  // This avoids pulling in ManifestValidator → AJV → new Function() (blocked by CSP).
  alias: {
    '@agent-native-web/runtime-core/semantic-parser': resolve(__dirname, '../agent-runtime-core/src/semantic-parser.ts'),
    '@agent-native-web/runtime-core/policy-engine': resolve(__dirname, '../agent-runtime-core/src/policy-engine.ts'),
    '@agent-native-web/runtime-core/execution-logger': resolve(__dirname, '../agent-runtime-core/src/execution-logger.ts'),
    '@agent-native-web/runtime-core/coerce-args': resolve(__dirname, '../agent-runtime-core/src/coerce-args.ts'),
    '@agent-native-web/runtime-core/types': resolve(__dirname, '../agent-runtime-core/src/types.ts'),
    '@agent-native-web/planner-local/prompt-builder': resolve(__dirname, '../awi-planner-local/src/prompt-builder.ts'),
  },
});

// Copy static files from public/ to dist/
cpSync(resolve(__dirname, 'public'), resolve(__dirname, 'dist'), { recursive: true });

console.log('✓ Built extension with esbuild');
