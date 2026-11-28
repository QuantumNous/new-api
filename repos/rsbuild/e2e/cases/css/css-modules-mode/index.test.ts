import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should compile CSS Modules global mode correctly', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  const content = getFileContent(files, 'index.css');
  expect(content).toEqual(
    '.foo{position:relative}.foo .bar,.foo .baz{height:100%;overflow:hidden}.foo .lol{width:80%}',
  );
});
