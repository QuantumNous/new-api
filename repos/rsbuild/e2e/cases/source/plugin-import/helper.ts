import { expect, test } from '@e2e/helper';
import type { RsbuildConfig, TransformImport } from '@rsbuild/core';

export const cases: Parameters<typeof shareTest>[] = [
  [
    'camelCase test',
    './src/camel.js',
    {
      libraryName: 'foo',
      libraryDirectory: 'lib',
      camelToDashComponentName: false,
    },
  ],
  [
    'kebab-case test',
    './src/kebab.js',
    {
      libraryName: 'foo',
      libraryDirectory: 'lib',
      camelToDashComponentName: true,
    },
  ],
  [
    'transform to named import',
    './src/named.js',
    {
      libraryName: 'foo',
      libraryDirectory: 'lib',
      camelToDashComponentName: true,
      transformToDefaultImport: false,
    },
  ],
];

export function findEntry(files: Record<string, string>, name = 'index'): string {
  for (const key of Reflect.ownKeys(files) as string[]) {
    if (key.includes(`dist/static/js/${name}`) && key.endsWith('.js')) {
      return key;
    }
  }

  throw new Error('unreachable');
}

export function shareTest(msg: string, entry: string, transformImport: TransformImport) {
  const config: RsbuildConfig = {
    source: {
      entry: {
        index: entry,
      },
      transformImport: [transformImport],
    },
    splitChunks: false,
  };

  test(msg, async ({ build, copyNodeModules }) => {
    await copyNodeModules();

    const rsbuild = await build({
      config,
    });
    const files = rsbuild.getDistFiles({ sourceMaps: true });
    expect(files[findEntry(files)]).toContain('transformImport test succeed');
  });
}
