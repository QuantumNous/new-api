import { expect, getFileContent, test } from '@e2e/helper';

const parseInlineSourceMap = (code: string): { sources: string[] } => {
  const match = code.match(
    /sourceMappingURL=data:application\/json;charset=utf-8;base64,([A-Za-z0-9+/=]+)/,
  );

  if (!match) {
    throw new Error('Inline source map not found.');
  }

  return JSON.parse(Buffer.from(match[1], 'base64').toString('utf-8')) as {
    sources: string[];
  };
};

test('should replace source map filename templates in inline source map', async ({ devOnly }) => {
  const rsbuild = await devOnly({
    config: {
      output: {
        target: 'node',
        sourceMap: true,
      },
      tools: {
        rspack(config) {
          config.devtool = 'inline-cheap-module-source-map';
        },
      },
    },
  });

  const files = rsbuild.getDistFiles({ sourceMaps: true });
  const indexJs = getFileContent(files, 'index.js');
  const sourceMap = parseInlineSourceMap(indexJs);

  expect(indexJs).not.toContain('[relative-resource-path]');
  expect(sourceMap.sources).toContain('../src/index.js');
  expect(
    sourceMap.sources.some((source) => source.includes('[relative-resource-path]')),
  ).toBeFalsy();
});
