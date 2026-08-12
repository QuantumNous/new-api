import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, getRandomPort, gotoPage, test } from '@e2e/helper';
import type { RsbuildConfig } from '@rsbuild/core';
import { pluginCheckSyntax } from '@rsbuild/plugin-check-syntax';

const host = join(import.meta.dirname, 'host');
const remote = join(import.meta.dirname, 'remote');

const writeButtonCode = (text = 'Button from remote') => {
  writeFileSync(
    join(import.meta.dirname, 'remote/src/test-temp-Button.tsx'),
    `const Button = () => (
  <button type="button" id="button">
    ${text}
  </button>
);
export default Button;`,
  );
};

test('should run module federation in dev', async ({ page, devOnly }) => {
  writeButtonCode();

  const remotePort = await getRandomPort();

  process.env.REMOTE_PORT = remotePort.toString();

  const remoteApp = await devOnly({
    cwd: remote,
  });

  await gotoPage(page, remoteApp);
  await expect(page.locator('#title')).toHaveText('Remote');
  await expect(page.locator('#button')).toHaveText('Button from remote');

  const hostApp = await devOnly({
    cwd: host,
  });

  await gotoPage(page, hostApp);
  await expect(page.locator('#title')).toHaveText('Host');
  await expect(page.locator('#button')).toHaveText('Button from remote');
});

test('should allow remote module to perform HMR', async ({ page, devOnly }) => {
  writeButtonCode();

  const remotePort = await getRandomPort();

  process.env.REMOTE_PORT = remotePort.toString();

  const remoteApp = await devOnly({
    cwd: remote,
  });
  const hostApp = await devOnly({
    cwd: host,
  });

  await gotoPage(page, remoteApp);
  await expect(page.locator('#title')).toHaveText('Remote');
  await expect(page.locator('#button')).toHaveText('Button from remote');

  await gotoPage(page, hostApp);
  await expect(page.locator('#title')).toHaveText('Host');
  await expect(page.locator('#button')).toHaveText('Button from remote');

  writeButtonCode('Button from remote (HMR)');
  await expect(page.locator('#button')).toHaveText('Button from remote (HMR)');
});

test('should downgrade syntax as expected', async ({ build }) => {
  writeButtonCode();

  const remotePort = await getRandomPort();

  process.env.REMOTE_PORT = remotePort.toString();

  const config: RsbuildConfig = {
    output: {
      sourceMap: true,
      overrideBrowserslist: ['Chrome >= 51'],
    },
    splitChunks: false,
    plugins: [
      pluginCheckSyntax({
        // MF runtime contains dynamic import, which can not pass syntax checking
        exclude: [/@module-federation[\\/+]runtime/],
      }),
    ],
  };

  await expect(
    build({
      cwd: remote,
      config,
    }),
  ).resolves.toBeTruthy();

  await expect(
    build({
      cwd: host,
      config,
    }),
  ).resolves.toBeTruthy();
});
