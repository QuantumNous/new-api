import { describe, expect, it } from 'vitest';
import File from 'vinyl';
import path from 'path';
import { alias } from './alias';

function runAlias(contents: string, options: Parameters<typeof alias>[0], filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const stream = alias(options);

    stream.on('data', (file: File) => {
      resolve(file.contents?.toString() || '');
    });
    stream.on('error', reject);

    stream.write(
      new File({
        path: filePath,
        contents: Buffer.from(contents)
      })
    );
    stream.end();
  });
}

describe('alias', () => {
  it('keeps node_modules package paths as package imports', async () => {
    const cwd = path.resolve('/project');
    const filePath = path.join(cwd, 'src/index.ts');

    const result = await runAlias(
      [
        "import { isArray } from '@/utils';",
        "import { container } from '@visactor/vrender-core';",
        "import { loadCanvas } from '@visactor/vrender-kits/canvas';"
      ].join('\n'),
      {
        cwd,
        paths: {
          '@/*': ['src/*'],
          '@visactor/vrender-core': ['./node_modules/@visactor/vrender-core/es/index'],
          '@visactor/vrender-kits/*': ['./node_modules/@visactor/vrender-kits/es/*']
        }
      },
      filePath
    );

    expect(result).toContain("from './utils'");
    expect(result).toContain("from '@visactor/vrender-core'");
    expect(result).toContain("from '@visactor/vrender-kits/canvas'");
  });
});
