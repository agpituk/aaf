import * as fs from 'fs';
import * as path from 'path';

export type ProjectType = 'vite' | 'next' | 'html';

/**
 * Detect the project type by checking for known config files.
 */
export function detectProjectType(dir: string): ProjectType {
  const files = fs.readdirSync(dir);

  for (const f of files) {
    if (/^vite\.config\.(ts|js|mjs|cjs)$/.test(f)) return 'vite';
  }

  for (const f of files) {
    if (/^next\.config\.(ts|js|mjs|cjs)$/.test(f)) return 'next';
  }

  return 'html';
}

/**
 * Determine where the manifest should be written based on project type.
 */
export function manifestOutputDir(dir: string, projectType: ProjectType): string {
  if (projectType === 'next') {
    return path.join(dir, 'public');
  }
  if (projectType === 'vite') {
    return path.join(dir, 'public');
  }
  // Plain HTML — write alongside HTML files
  return dir;
}
