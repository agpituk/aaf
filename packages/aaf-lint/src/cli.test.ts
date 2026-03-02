import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aaf-lint-cli-'));
}

const CLI_PATH = path.resolve(__dirname, 'cli.ts');

function runCLI(args: string, opts?: { cwd?: string; input?: string }): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`npx tsx ${CLI_PATH} ${args}`, {
      encoding: 'utf-8',
      cwd: opts?.cwd,
      input: opts?.input,
      timeout: 15000,
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout || '',
      stderr: e.stderr || '',
      exitCode: e.status ?? 1,
    };
  }
}

describe('aaf-lint CLI — positional file args', () => {
  it('lints a single valid HTML file', () => {
    const dir = makeTmpDir();
    const file = path.join(dir, 'page.html');
    fs.writeFileSync(file, `
      <form data-agent-kind="action" data-agent-action="invoice.create">
        <input data-agent-kind="field" data-agent-field="amount" />
        <button data-agent-kind="action" data-agent-action="invoice.create.submit">Submit</button>
      </form>
    `);

    const result = runCLI(file);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('no issues found');

    fs.rmSync(dir, { recursive: true });
  });

  it('lints a file with errors and exits 1', () => {
    const dir = makeTmpDir();
    const file = path.join(dir, 'bad.html');
    fs.writeFileSync(file, `<div data-agent-kind="invalid_kind">test</div>`);

    const result = runCLI(file);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('error');
    expect(result.stdout).toContain('invalid_kind');

    fs.rmSync(dir, { recursive: true });
  });

  it('lints multiple files and aggregates results', () => {
    const dir = makeTmpDir();
    const good = path.join(dir, 'good.html');
    const bad = path.join(dir, 'bad.html');
    fs.writeFileSync(good, `<form data-agent-kind="action" data-agent-action="test.action"></form>`);
    fs.writeFileSync(bad, `<div data-agent-kind="broken">test</div>`);

    const result = runCLI(`${good} ${bad}`);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('2 file(s)');

    fs.rmSync(dir, { recursive: true });
  });

  it('reports error for non-existent file', () => {
    const result = runCLI('/tmp/nonexistent-aaf-file.html');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('File not found');
  });
});

describe('aaf-lint CLI — --stdin', () => {
  it('reads file list from stdin and lints matching UI files', () => {
    const dir = makeTmpDir();
    const file = path.join(dir, 'page.html');
    fs.writeFileSync(file, `<form data-agent-kind="action" data-agent-action="test.do"></form>`);

    const result = runCLI('--stdin', { input: file + '\n' });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('1 file(s)');

    fs.rmSync(dir, { recursive: true });
  });

  it('filters out non-UI files from stdin', () => {
    const dir = makeTmpDir();
    const file = path.join(dir, 'valid.html');
    fs.writeFileSync(file, `<form data-agent-kind="action" data-agent-action="test.do"></form>`);

    // Send a mix of UI and non-UI files
    const input = [file, 'README.md', 'package.json', 'image.png'].join('\n');
    const result = runCLI('--stdin', { input });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('1 file(s)');

    fs.rmSync(dir, { recursive: true });
  });
});

describe('aaf-lint CLI — --changed', () => {
  it('runs git diff and filters to UI files', () => {
    // Create a temp git repo with a changed file
    const dir = makeTmpDir();
    execSync('git init', { cwd: dir });
    execSync('git config user.email "test@test.com"', { cwd: dir });
    execSync('git config user.name "Test"', { cwd: dir });

    // Create and commit an initial file
    fs.writeFileSync(path.join(dir, 'page.html'), '<div></div>');
    execSync('git add . && git commit -m "init"', { cwd: dir });

    // Modify the file
    fs.writeFileSync(path.join(dir, 'page.html'), '<form data-agent-kind="action" data-agent-action="test.do"></form>');

    const result = runCLI('--changed', { cwd: dir });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('1 file(s)');

    fs.rmSync(dir, { recursive: true });
  });

  it('--changed with ref uses that ref for git diff', () => {
    const dir = makeTmpDir();
    execSync('git init', { cwd: dir });
    execSync('git config user.email "test@test.com"', { cwd: dir });
    execSync('git config user.name "Test"', { cwd: dir });

    // Create main branch with initial commit
    fs.writeFileSync(path.join(dir, 'page.html'), '<div></div>');
    execSync('git add . && git commit -m "init"', { cwd: dir });

    // Create a feature branch with a change
    execSync('git checkout -b feature', { cwd: dir });
    fs.writeFileSync(path.join(dir, 'page.html'), '<form data-agent-kind="action" data-agent-action="test.do"></form>');
    execSync('git add . && git commit -m "feature"', { cwd: dir });

    const result = runCLI('--changed main', { cwd: dir });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('1 file(s)');

    fs.rmSync(dir, { recursive: true });
  });

  it('--changed prints message when no UI files changed', () => {
    const dir = makeTmpDir();
    execSync('git init', { cwd: dir });
    execSync('git config user.email "test@test.com"', { cwd: dir });
    execSync('git config user.name "Test"', { cwd: dir });

    fs.writeFileSync(path.join(dir, 'readme.md'), 'hello');
    execSync('git add . && git commit -m "init"', { cwd: dir });

    const result = runCLI('--changed', { cwd: dir });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('No changed UI files');

    fs.rmSync(dir, { recursive: true });
  });
});

describe('aaf-lint CLI — help text', () => {
  it('shows usage including --stdin and --changed', () => {
    const result = runCLI('');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--stdin');
    expect(result.stderr).toContain('--changed');
  });
});
