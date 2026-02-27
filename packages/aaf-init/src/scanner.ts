import * as fs from 'fs';
import * as path from 'path';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.next', '.nuxt', '.output']);

/** File extensions that may contain AAF annotations (HTML or JSX/TSX with data-agent-* attrs) */
const UI_FILE_PATTERN = /\.(html?|[jt]sx?|vue|svelte)$/i;

/**
 * Recursively find all HTML files in a directory, skipping common output/vendored dirs.
 */
export function findHtmlFiles(dir: string): string[] {
  const results: string[] = [];
  walk(dir, results, /\.html?$/i);
  return results;
}

/**
 * Recursively find all UI files (HTML, JSX, TSX, Vue, Svelte) that may contain AAF annotations.
 */
export function findUIFiles(dir: string): string[] {
  const results: string[] = [];
  walk(dir, results, UI_FILE_PATTERN);
  return results;
}

function walk(dir: string, results: string[], pattern: RegExp): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), results, pattern);
    } else if (entry.isFile() && pattern.test(entry.name)) {
      results.push(path.join(dir, entry.name));
    }
  }
}
