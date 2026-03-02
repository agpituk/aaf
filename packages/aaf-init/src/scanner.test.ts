import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { findHtmlFiles, findUIFiles } from './scanner.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aaf-scanner-'));
}

describe('findHtmlFiles', () => {
  it('finds HTML files in directory', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(dir, 'style.css'), 'body {}');

    const files = findHtmlFiles(dir);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain('index.html');

    fs.rmSync(dir, { recursive: true });
  });

  it('finds HTML files recursively', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'index.html'), '');
    fs.mkdirSync(path.join(dir, 'pages'));
    fs.writeFileSync(path.join(dir, 'pages', 'about.html'), '');

    const files = findHtmlFiles(dir);
    expect(files).toHaveLength(2);

    fs.rmSync(dir, { recursive: true });
  });

  it('skips node_modules', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'index.html'), '');
    fs.mkdirSync(path.join(dir, 'node_modules'));
    fs.writeFileSync(path.join(dir, 'node_modules', 'lib.html'), '');

    const files = findHtmlFiles(dir);
    expect(files).toHaveLength(1);

    fs.rmSync(dir, { recursive: true });
  });

  it('skips dist and build directories', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'index.html'), '');
    fs.mkdirSync(path.join(dir, 'dist'));
    fs.writeFileSync(path.join(dir, 'dist', 'output.html'), '');
    fs.mkdirSync(path.join(dir, 'build'));
    fs.writeFileSync(path.join(dir, 'build', 'output.html'), '');

    const files = findHtmlFiles(dir);
    expect(files).toHaveLength(1);

    fs.rmSync(dir, { recursive: true });
  });

  it('returns empty array for directory with no HTML', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'app.js'), '');

    const files = findHtmlFiles(dir);
    expect(files).toHaveLength(0);

    fs.rmSync(dir, { recursive: true });
  });

  it('handles .htm extension', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'page.htm'), '');

    const files = findHtmlFiles(dir);
    expect(files).toHaveLength(1);

    fs.rmSync(dir, { recursive: true });
  });
});

describe('findUIFiles', () => {
  it('finds tsx, jsx, vue, svelte, and html files', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'App.tsx'), '');
    fs.writeFileSync(path.join(dir, 'Form.jsx'), '');
    fs.writeFileSync(path.join(dir, 'Page.vue'), '');
    fs.writeFileSync(path.join(dir, 'Widget.svelte'), '');
    fs.writeFileSync(path.join(dir, 'index.html'), '');
    fs.writeFileSync(path.join(dir, 'style.css'), '');

    const files = findUIFiles(dir);
    expect(files).toHaveLength(5);

    fs.rmSync(dir, { recursive: true });
  });

  it('skips node_modules for UI files', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'App.tsx'), '');
    fs.mkdirSync(path.join(dir, 'node_modules'));
    fs.writeFileSync(path.join(dir, 'node_modules', 'lib.tsx'), '');

    const files = findUIFiles(dir);
    expect(files).toHaveLength(1);

    fs.rmSync(dir, { recursive: true });
  });

  it('finds .ts files (may contain createElement calls)', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'widget.ts'), '');

    const files = findUIFiles(dir);
    expect(files).toHaveLength(1);

    fs.rmSync(dir, { recursive: true });
  });
});

describe('path filtering', () => {
  it('findHtmlFiles with paths returns only files under those paths', () => {
    const dir = makeTmpDir();
    fs.mkdirSync(path.join(dir, 'billing'));
    fs.mkdirSync(path.join(dir, 'settings'));
    fs.writeFileSync(path.join(dir, 'billing', 'index.html'), '');
    fs.writeFileSync(path.join(dir, 'settings', 'index.html'), '');
    fs.writeFileSync(path.join(dir, 'index.html'), '');

    const files = findHtmlFiles(dir, ['billing']);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain('billing');

    fs.rmSync(dir, { recursive: true });
  });

  it('findHtmlFiles with specific file path returns that file', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'page.html'), '');
    fs.writeFileSync(path.join(dir, 'other.html'), '');

    const files = findHtmlFiles(dir, ['page.html']);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain('page.html');

    fs.rmSync(dir, { recursive: true });
  });

  it('findHtmlFiles filters non-matching files by extension', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'app.tsx'), '');
    fs.writeFileSync(path.join(dir, 'page.html'), '');

    // Only looking for HTML files, app.tsx should be excluded
    const files = findHtmlFiles(dir, ['app.tsx']);
    expect(files).toHaveLength(0);

    fs.rmSync(dir, { recursive: true });
  });

  it('findUIFiles with paths returns only files under those paths', () => {
    const dir = makeTmpDir();
    fs.mkdirSync(path.join(dir, 'billing'));
    fs.mkdirSync(path.join(dir, 'settings'));
    fs.writeFileSync(path.join(dir, 'billing', 'Form.tsx'), '');
    fs.writeFileSync(path.join(dir, 'settings', 'Page.tsx'), '');
    fs.writeFileSync(path.join(dir, 'App.tsx'), '');

    const files = findUIFiles(dir, ['billing']);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain('billing');

    fs.rmSync(dir, { recursive: true });
  });

  it('findUIFiles with multiple paths scans all of them', () => {
    const dir = makeTmpDir();
    fs.mkdirSync(path.join(dir, 'billing'));
    fs.mkdirSync(path.join(dir, 'settings'));
    fs.mkdirSync(path.join(dir, 'admin'));
    fs.writeFileSync(path.join(dir, 'billing', 'Form.tsx'), '');
    fs.writeFileSync(path.join(dir, 'settings', 'Page.tsx'), '');
    fs.writeFileSync(path.join(dir, 'admin', 'Panel.tsx'), '');

    const files = findUIFiles(dir, ['billing', 'settings']);
    expect(files).toHaveLength(2);
    expect(files.some(f => f.includes('billing'))).toBe(true);
    expect(files.some(f => f.includes('settings'))).toBe(true);
    expect(files.some(f => f.includes('admin'))).toBe(false);

    fs.rmSync(dir, { recursive: true });
  });

  it('findUIFiles with no paths returns all files (backward compat)', () => {
    const dir = makeTmpDir();
    fs.mkdirSync(path.join(dir, 'billing'));
    fs.writeFileSync(path.join(dir, 'billing', 'Form.tsx'), '');
    fs.writeFileSync(path.join(dir, 'App.tsx'), '');

    const withoutPaths = findUIFiles(dir);
    const withUndefined = findUIFiles(dir, undefined);
    const withEmpty = findUIFiles(dir, []);

    expect(withoutPaths).toHaveLength(2);
    expect(withUndefined).toHaveLength(2);
    expect(withEmpty).toHaveLength(2);

    fs.rmSync(dir, { recursive: true });
  });

  it('skips non-existent paths silently', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'index.html'), '');

    const files = findHtmlFiles(dir, ['nonexistent']);
    expect(files).toHaveLength(0);

    fs.rmSync(dir, { recursive: true });
  });
});
