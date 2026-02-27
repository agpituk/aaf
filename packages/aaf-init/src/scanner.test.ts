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
