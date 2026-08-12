import fs from 'node:fs';
import path from 'node:path';
import { expect, getRandomPort, gotoPage, test } from '@e2e/helper';

const tempConfig = path.join(import.meta.dirname, 'test-temp.config.mjs');
const tempConfigDep = path.join(import.meta.dirname, 'test-temp-dep.mjs');
const distDir = path.join(import.meta.dirname, 'dist');

test.afterEach(() => {
  fs.rmSync(tempConfig, { force: true });
  fs.rmSync(tempConfigDep, { force: true });
  fs.rmSync(distDir, { recursive: true, force: true });
});

test('should restart dev server when native config dependency changed', async ({
  page,
  execCli,
  logHelper,
}) => {
  const port = await getRandomPort();

  fs.writeFileSync(tempConfigDep, `export const value = '1';\n`);
  fs.writeFileSync(
    tempConfig,
    `import { value } from './test-temp-dep.mjs';

export default {
  dev: {
    writeToDisk: true,
  },
  source: {
    define: {
      CONFIG_VALUE: JSON.stringify(value),
    },
  },
  server: {
    port: Number(process.env.PORT),
  },
};
`,
  );

  execCli(`dev --config-loader native --config ${path.basename(tempConfig)}`, {
    env: {
      PORT: String(port),
    },
  });

  const { clearLogs, expectBuildEnd, expectLog } = logHelper;

  await expectBuildEnd();
  await gotoPage(page, { port });
  await expect(page.locator('#test')).toHaveText('1');

  clearLogs();
  fs.writeFileSync(tempConfigDep, `export const value = '2';\n`);

  await expectLog('restarting server');
  await expectBuildEnd();
  await gotoPage(page, { port });
  await expect(page.locator('#test')).toHaveText('2');
});
