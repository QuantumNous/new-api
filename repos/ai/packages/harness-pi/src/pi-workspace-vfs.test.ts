import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  promises as fsPromises,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PiWorkspaceVfs } from './pi-workspace-vfs';

let backingRoot: string;
let vfs: PiWorkspaceVfs;
const mountPoint = path.join(path.sep, 'vfs', 'pi', 'test-session');

beforeEach(() => {
  backingRoot = mkdtempSync(path.join(tmpdir(), 'pi-vfs-'));
  vfs = new PiWorkspaceVfs();
});

afterEach(() => {
  vfs.unmount();
  rmSync(backingRoot, { recursive: true, force: true });
});

describe('PiWorkspaceVfs', () => {
  it('redirects writeFileSync against the logical mount to the backing root', () => {
    vfs.mount(backingRoot, mountPoint);
    writeFileSync(path.join(mountPoint, 'hello.txt'), 'hi');
    expect(readFileSync(path.join(backingRoot, 'hello.txt'), 'utf8')).toBe(
      'hi',
    );
  });

  it('redirects readFileSync against the logical mount', () => {
    vfs.mount(backingRoot, mountPoint);
    writeFileSync(path.join(backingRoot, 'src.txt'), 'content');
    expect(readFileSync(path.join(mountPoint, 'src.txt'), 'utf8')).toBe(
      'content',
    );
  });

  it('redirects existsSync', () => {
    vfs.mount(backingRoot, mountPoint);
    expect(existsSync(path.join(mountPoint, 'nope.txt'))).toBe(false);
    writeFileSync(path.join(backingRoot, 'real.txt'), 'x');
    expect(existsSync(path.join(mountPoint, 'real.txt'))).toBe(true);
  });

  it('redirects fs.promises.writeFile + readFile', async () => {
    vfs.mount(backingRoot, mountPoint);
    await fsPromises.writeFile(path.join(mountPoint, 'async.txt'), 'async');
    expect(readFileSync(path.join(backingRoot, 'async.txt'), 'utf8')).toBe(
      'async',
    );
    const back = await fsPromises.readFile(
      path.join(mountPoint, 'async.txt'),
      'utf8',
    );
    expect(back).toBe('async');
  });

  it('leaves non-mount paths untouched', () => {
    vfs.mount(backingRoot, mountPoint);
    const tmpFile = path.join(backingRoot, '..', 'unrelated.txt');
    // Just make sure that a path outside the mount goes through to the
    // real filesystem unchanged — we'll write into the backing root's
    // parent and read it back via a path that doesn't start with the mount.
    writeFileSync(tmpFile, 'real');
    expect(readFileSync(tmpFile, 'utf8')).toBe('real');
    rmSync(tmpFile, { force: true });
  });

  it('restores patches after the last unmount', () => {
    const originalExists = (existsSync as Function).toString();
    vfs.mount(backingRoot, mountPoint);
    expect((existsSync as Function).toString()).not.toBe(originalExists);
    vfs.unmount();
    expect((existsSync as Function).toString()).toBe(originalExists);
  });

  it('supports multiple concurrent mounts with longest-prefix matching', () => {
    const otherBacking = mkdtempSync(path.join(tmpdir(), 'pi-vfs-other-'));
    const otherMount = path.join(
      path.sep,
      'vfs',
      'pi',
      'test-session',
      'nested',
    );
    const otherVfs = new PiWorkspaceVfs();
    try {
      vfs.mount(backingRoot, mountPoint);
      otherVfs.mount(otherBacking, otherMount);

      // The nested mount should win for paths under it.
      writeFileSync(path.join(otherMount, 'inner.txt'), 'nested');
      expect(readFileSync(path.join(otherBacking, 'inner.txt'), 'utf8')).toBe(
        'nested',
      );
      expect(existsSync(path.join(backingRoot, 'nested', 'inner.txt'))).toBe(
        false,
      );

      // The outer mount handles paths outside the nested mount.
      writeFileSync(path.join(mountPoint, 'outer.txt'), 'outer');
      expect(readFileSync(path.join(backingRoot, 'outer.txt'), 'utf8')).toBe(
        'outer',
      );
    } finally {
      otherVfs.unmount();
      rmSync(otherBacking, { recursive: true, force: true });
    }
  });
});
