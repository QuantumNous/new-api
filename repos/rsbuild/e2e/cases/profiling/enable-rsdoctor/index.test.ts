import { expect, test } from '@e2e/helper';
import { createRsbuild, type Rspack } from '@rsbuild/core';
import { matchPlugin } from '@scripts/test-helper';

const RSDOCTOR_LOG = '@rsdoctor/rspack-plugin enabled';

test.afterEach(() => {
  process.env.RSDOCTOR = '';
});

test('should register Rsdoctor plugin when process.env.RSDOCTOR is true', async ({
  copyNodeModules,
  logHelper,
}) => {
  const { expectLog } = logHelper;
  await copyNodeModules();
  process.env.RSDOCTOR = 'true';

  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
  });

  const compiler = await rsbuild.createCompiler();

  await expectLog(RSDOCTOR_LOG);

  expect(
    matchPlugin(compiler.options as Rspack.Configuration, 'RsdoctorRspackPlugin'),
  ).toBeTruthy();
});

test('should not register Rsdoctor plugin when process.env.RSDOCTOR is false', async ({
  logHelper,
}) => {
  const { expectNoLog } = logHelper;
  process.env.RSDOCTOR = 'false';

  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
  });

  const compiler = await rsbuild.createCompiler();

  expectNoLog(RSDOCTOR_LOG);

  expect(matchPlugin(compiler.options as Rspack.Configuration, 'RsdoctorRspackPlugin')).toBeFalsy();
});

test('should not register Rsdoctor plugin when process.env.RSDOCTOR is true and the plugin has been registered', async ({
  copyNodeModules,
  logHelper,
}) => {
  const { expectNoLog } = logHelper;

  await copyNodeModules();
  process.env.RSDOCTOR = 'true';

  // rslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const { RsdoctorRspackPlugin } = await import('@rsdoctor/rspack-plugin');

  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      tools: {
        rspack: {
          plugins: [
            new RsdoctorRspackPlugin({
              disableClientServer: true,
            }),
          ],
        },
      },
    },
  });

  const compiler = await rsbuild.createCompiler();

  expect(
    matchPlugin(compiler.options as Rspack.Configuration, 'RsdoctorRspackPlugin'),
  ).toBeTruthy();

  expectNoLog(RSDOCTOR_LOG);
});
