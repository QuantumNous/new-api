import { pathToFileURL } from 'node:url';
import { expect, test } from '@e2e/helper';

test('should support worker query imports in SSR builds', async ({ build }) => {
  const result = await build();
  const files = result.getDistFiles();
  const entryFile = Object.keys(files).find((file) => file.endsWith('/index.js'));
  expect(entryFile).toBeDefined();

  const entry = files[entryFile!];
  const queryWorker = Object.entries(files).find(([, content]) =>
    content.includes('query-ssr-worker'),
  );
  const bundle = await import(`${pathToFileURL(entryFile!).href}?t=${Date.now()}`);

  expect(entry).toContain('inline-ssr-worker');
  expect(entry).toContain('new Worker');
  expect(bundle.workerTypes).toBe('function:function');
  expect(queryWorker?.[0]).not.toBe(entryFile);
  expect(queryWorker?.[1]).toContain('query-ssr-worker');
});
