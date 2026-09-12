import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalCwd = process.cwd();
let tempDirs: string[] = [];

const loadDbModule = async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-sdk-devtools-'));
  tempDirs.push(tempDir);
  process.chdir(tempDir);
  vi.resetModules();

  return {
    db: await import('./db.js'),
    tempDir,
  };
};

const writeDb = (dbPath: string, runs: Array<Record<string, unknown>>) => {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify({ runs, steps: [] }));
};

describe('devtools db path validation', () => {
  afterEach(() => {
    process.chdir(originalCwd);
    vi.resetModules();

    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs = [];
  });

  it('accepts real .devtools/generations.json files', async () => {
    const { db, tempDir } = await loadDbModule();
    const dbPath = path.join(tempDir, 'app', '.devtools', 'generations.json');

    writeDb(dbPath, []);

    expect(db.validateRemoteDbPath(dbPath)).toBe(fs.realpathSync(dbPath));
  });

  it('rejects paths outside .devtools/generations.json', async () => {
    const { db, tempDir } = await loadDbModule();
    const dbPath = path.join(tempDir, 'app', 'generations.json');

    writeDb(dbPath, []);

    expect(db.validateRemoteDbPath(dbPath)).toBeUndefined();
    expect(db.validateRemoteDbPath(null)).toBeUndefined();
  });

  it('reloads a validated remote devtools database', async () => {
    const { db, tempDir } = await loadDbModule();
    const run = {
      id: 'run-1',
      started_at: '2026-06-11T00:00:00.000Z',
      parent_run_id: null,
      parent_step_id: null,
      function_id: null,
    };
    const dbPath = path.join(tempDir, 'app', '.devtools', 'generations.json');

    writeDb(dbPath, [run]);
    await db.reloadDb(dbPath);

    await expect(db.getRuns()).resolves.toEqual([run]);
  });

  it('does not reload arbitrary JSON files', async () => {
    const { db, tempDir } = await loadDbModule();
    const run = {
      id: 'run-1',
      started_at: '2026-06-11T00:00:00.000Z',
      parent_run_id: null,
      parent_step_id: null,
      function_id: null,
    };
    const dbPath = path.join(tempDir, 'app', 'generations.json');

    writeDb(dbPath, [run]);
    await db.reloadDb(dbPath);

    await expect(db.getRuns()).resolves.toEqual([]);
  });

  it('rejects symlinked devtools databases that resolve outside devtools', async () => {
    const { db, tempDir } = await loadDbModule();
    const dbPath = path.join(tempDir, 'app', '.devtools', 'generations.json');
    const targetPath = path.join(tempDir, 'target.json');

    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    writeDb(targetPath, []);
    fs.symlinkSync(targetPath, dbPath);

    expect(db.validateRemoteDbPath(dbPath)).toBeUndefined();
    await db.reloadDb(dbPath);

    await expect(db.getRuns()).resolves.toEqual([]);
  });

  it('rejects devtools databases larger than the size cap', async () => {
    const { db, tempDir } = await loadDbModule();
    const dbPath = path.join(tempDir, 'app', '.devtools', 'generations.json');

    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    // Sparse file just over the 100 MB cap — reports a large size without
    // consuming disk, standing in for a huge / OOM-inducing database.
    fs.writeFileSync(dbPath, '');
    fs.truncateSync(dbPath, 100 * 1024 * 1024 + 1);

    expect(db.validateRemoteDbPath(dbPath)).toBeUndefined();
    await db.reloadDb(dbPath);

    await expect(db.getRuns()).resolves.toEqual([]);
  });
});
