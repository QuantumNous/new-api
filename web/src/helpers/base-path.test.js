/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import { describe, expect, test } from 'bun:test';

import { normalizeBasePath, normalizeRuntimeBasePath } from './base-path';

let runtimeImportId = 0;

async function importBasePathWithRuntime(appBasePath) {
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const previousWindow = globalThis.window;
  globalThis.window = {
    __NEW_API_RUNTIME__: {
      appBasePath,
    },
  };

  try {
    runtimeImportId += 1;
    return await import(`./base-path.js?runtime-test=${runtimeImportId}`);
  } finally {
    if (hadWindow) {
      globalThis.window = previousWindow;
    } else {
      delete globalThis.window;
    }
  }
}

describe('normalizeBasePath', () => {
  test.each([
    ['', ''],
    ['/', ''],
    ['.', ''],
    ['./', ''],
    ['/new-api', '/new-api'],
    ['/new-api/', '/new-api'],
  ])('normalizes %p to %p', (input, expected) => {
    expect(normalizeBasePath(input)).toBe(expected);
  });

  test.each(['app', '/a//b', '/a/./b', '/a/../b', '/app?x=1'])(
    'rejects invalid base path %p',
    (input) => {
      expect(() => normalizeBasePath(input)).toThrow();
    },
  );
});

describe('runtime base path', () => {
  test('ignores the unresolved HTML placeholder', async () => {
    const mod = await importBasePathWithRuntime('__APP_BASE_PATH_PLACEHOLDER__');

    expect(normalizeRuntimeBasePath('__APP_BASE_PATH_PLACEHOLDER__')).toBe('');
    expect(mod.APP_BASE_PATH).toBe('');
  });

  test('warns and falls back when runtime base path is invalid', async () => {
    const originalWarn = console.warn;
    const warnings = [];
    console.warn = (...args) => warnings.push(args);

    try {
      const mod = await importBasePathWithRuntime('app');

      expect(mod.APP_BASE_PATH).toBe('');
      expect(warnings).toHaveLength(1);
      expect(warnings[0][0]).toContain('Ignoring invalid runtime appBasePath');
    } finally {
      console.warn = originalWarn;
    }
  });

  test('uses valid runtime base path before fallback', async () => {
    const mod = await importBasePathWithRuntime('/new-api/');

    expect(mod.APP_BASE_PATH).toBe('/new-api');
  });
});
