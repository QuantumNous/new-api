import { join } from 'node:path';
import { expect, recordPluginHooks, test } from '@e2e/helper';
import fse from 'fs-extra';

test('should run plugin hooks correctly when running build with watch', async ({ build }) => {
  const cwd = import.meta.dirname;
  const filePath = join(cwd, 'test-temp-src', 'index.js');
  await fse.outputFile(filePath, "console.log('1');");

  const { plugin, hooks } = recordPluginHooks();
  const rsbuild = await build({
    watch: true,
    config: {
      plugins: [plugin],
    },
  });

  // initial build
  await rsbuild.expectBuildEnd();
  rsbuild.clearLogs();

  // rebuild
  await fse.outputFile(filePath, "console.log('2');");
  await rsbuild.expectLog('building test-temp-src');
  await rsbuild.expectBuildEnd();

  expect(hooks.slice(0, 17)).toEqual([
    'ModifyRsbuildConfig',
    'ModifyEnvironmentConfig',
    'ModifyBundlerChain',
    'ModifyBundlerConfig',
    'BeforeCreateCompiler',
    'AfterCreateCompiler',
    'BeforeBuild',
    'BeforeEnvironmentCompile',
    'ModifyHTMLTags',
    'ModifyHTML',
    'AfterEnvironmentCompile',
    'AfterBuild',
    // The below hooks should be called when rebuilding
    'BeforeBuild',
    'BeforeEnvironmentCompile',
    'ModifyHTMLTags',
    'ModifyHTML',
    'AfterEnvironmentCompile',
  ]);
});
