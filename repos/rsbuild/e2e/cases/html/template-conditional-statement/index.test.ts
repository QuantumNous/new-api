import { expect, getFileContent, test } from '@e2e/helper';

test('should render conditional statement correctly', async ({ build }) => {
  const rsbuild = await build();
  const files = rsbuild.getDistFiles();

  const indexHtml = getFileContent(files, 'index.html');

  // Basic if statement (showBasic: true)
  expect(indexHtml).toContain('Basic if true');

  // if/else statement (condition: false)
  expect(indexHtml).toContain('Condition false');
  expect(indexHtml).not.toContain('Condition true');

  // if/else if/else statement (value: 7)
  expect(indexHtml).toContain('Value > 5');
  expect(indexHtml).not.toContain('Value > 10');
  expect(indexHtml).not.toContain('Value ≤ 5');

  // Nested if statements (outer: true, inner: true)
  expect(indexHtml).toContain('Outer true');
  expect(indexHtml).toContain('Inner true');

  // Conditional expression (showResult: true, result: 'Success')
  expect(indexHtml).toContain('Result: Success');
  expect(indexHtml).not.toContain('Result: N/A');
});
