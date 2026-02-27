import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { detectProjectType, manifestOutputDir } from './detect.js';

function makeTmpDir(files: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aaf-detect-'));
  for (const f of files) {
    fs.writeFileSync(path.join(dir, f), '');
  }
  return dir;
}

describe('detectProjectType', () => {
  it('detects vite project', () => {
    const dir = makeTmpDir(['vite.config.ts', 'package.json']);
    expect(detectProjectType(dir)).toBe('vite');
    fs.rmSync(dir, { recursive: true });
  });

  it('detects vite project with .js config', () => {
    const dir = makeTmpDir(['vite.config.js', 'package.json']);
    expect(detectProjectType(dir)).toBe('vite');
    fs.rmSync(dir, { recursive: true });
  });

  it('detects next project', () => {
    const dir = makeTmpDir(['next.config.mjs', 'package.json']);
    expect(detectProjectType(dir)).toBe('next');
    fs.rmSync(dir, { recursive: true });
  });

  it('defaults to html when no config files found', () => {
    const dir = makeTmpDir(['index.html', 'about.html']);
    expect(detectProjectType(dir)).toBe('html');
    fs.rmSync(dir, { recursive: true });
  });

  it('prefers vite over next when both exist', () => {
    const dir = makeTmpDir(['vite.config.ts', 'next.config.js']);
    expect(detectProjectType(dir)).toBe('vite');
    fs.rmSync(dir, { recursive: true });
  });
});

describe('manifestOutputDir', () => {
  it('returns public/ for vite projects', () => {
    expect(manifestOutputDir('/app', 'vite')).toBe('/app/public');
  });

  it('returns public/ for next projects', () => {
    expect(manifestOutputDir('/app', 'next')).toBe('/app/public');
  });

  it('returns the dir itself for plain HTML', () => {
    expect(manifestOutputDir('/app', 'html')).toBe('/app');
  });
});
