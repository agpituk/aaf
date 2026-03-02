import * as fs from 'fs';
import * as path from 'path';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.next', '.nuxt', '.output']);

/** File extensions that may contain AAF annotations (HTML or JSX/TSX with data-agent-* attrs) */
const UI_FILE_PATTERN = /\.(html?|[jt]sx?|vue|svelte)$/i;

/**
 * Recursively find all HTML files in a directory, skipping common output/vendored dirs.
 * When `paths` is provided, only returns files under those paths (files or directories).
 */
export function findHtmlFiles(dir: string, paths?: string[]): string[] {
  return findFilesWithPattern(dir, /\.html?$/i, paths);
}

/**
 * Recursively find all UI files (HTML, JSX, TSX, Vue, Svelte) that may contain AAF annotations.
 * When `paths` is provided, only returns files under those paths (files or directories).
 */
export function findUIFiles(dir: string, paths?: string[]): string[] {
  return findFilesWithPattern(dir, UI_FILE_PATTERN, paths);
}

function findFilesWithPattern(dir: string, pattern: RegExp, paths?: string[]): string[] {
  if (!paths || paths.length === 0) {
    const results: string[] = [];
    walk(dir, results, pattern);
    return results;
  }

  const results: string[] = [];
  for (const p of paths) {
    const resolved = path.resolve(dir, p);
    try {
      const stat = fs.statSync(resolved);
      if (stat.isFile()) {
        if (pattern.test(resolved)) {
          results.push(resolved);
        }
      } else if (stat.isDirectory()) {
        walk(resolved, results, pattern);
      }
    } catch {
      // Path doesn't exist — skip silently
    }
  }
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
