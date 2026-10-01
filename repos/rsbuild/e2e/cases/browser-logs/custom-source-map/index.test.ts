import { join, relative } from 'node:path';
import { test } from '@e2e/helper';
import { toPosixPath } from '@rstackjs/test-utils';

const EXPECTED_LOG = 'error   [browser] Uncaught Error: test (src/index.js:1:0)';

test('should parse source map correctly if source path is absolute', async ({ dev }) => {
  const rsbuild = await dev({
    config: {
      tools: {
        rspack: {
          output: {
            devtoolModuleFilenameTemplate(info) {
              return toPosixPath(info.absoluteResourcePath);
            },
          },
        },
      },
    },
  });
  await rsbuild.expectLog(EXPECTED_LOG, { posix: true });
});

test('should parse source map correctly if source path is relative to source map path', async ({
  dev,
}) => {
  const sourceMapPath = join(import.meta.dirname, 'dist/static/js');
  const rsbuild = await dev({
    config: {
      tools: {
        rspack: {
          output: {
            devtoolModuleFilenameTemplate(info) {
              return toPosixPath(relative(sourceMapPath, info.absoluteResourcePath));
            },
          },
        },
      },
    },
  });
  await rsbuild.expectLog(EXPECTED_LOG, { posix: true });
});
