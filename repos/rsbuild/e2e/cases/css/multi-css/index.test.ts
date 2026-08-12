import { expect, test } from '@e2e/helper';
import { getFileContent } from '@rstackjs/test-utils';

test('should emit multiple CSS files correctly', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();
  expect(getFileContent(files, 'entry1.css')).toContain('#entry1{color:red}');
  expect(getFileContent(files, 'entry2.css')).toContain('#entry2{color:#00f}');
  expect(getFileContent(files, 'entry3.css')).toContain('#entry3{color:green}');
});
