import { expect, recordPluginHooks, test } from '@e2e/helper';
import { createRsbuild } from '@rsbuild/core';

test('should run plugin hooks correctly when running build', async ({ build }) => {
  const { plugin, hooks } = recordPluginHooks();
  const rsbuild = await build({
    config: {
      plugins: [plugin],
    },
  });

  await rsbuild.close();

  expect(hooks).toEqual([
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
    'CloseBuild',
  ]);
});

test('should run plugin hooks correctly when running build and mode is development', async ({
  build,
}) => {
  const { plugin, hooks } = recordPluginHooks();
  const rsbuild = await build({
    config: {
      mode: 'development',
      plugins: [plugin],
    },
  });

  await rsbuild.close();

  expect(hooks).toEqual([
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
    'CloseBuild',
  ]);
});

test('should run plugin hooks correctly when running startDevServer', async ({ dev }) => {
  const { plugin, hooks } = recordPluginHooks();
  const rsbuild = await dev({
    config: {
      plugins: [plugin],
    },
  });

  await rsbuild.close();

  expect(hooks.filter((name) => name.includes('DevServer'))).toEqual([
    'BeforeStartDevServer',
    'AfterStartDevServer',
    'CloseDevServer',
  ]);

  // compile is async, so the execution order of AfterStartDevServer and the compile hooks is uncertain
  expect(hooks.filter((name) => name !== 'AfterStartDevServer')).toEqual([
    'ModifyRsbuildConfig',
    'ModifyEnvironmentConfig',
    'BeforeStartDevServer',
    'ModifyBundlerChain',
    'ModifyBundlerConfig',
    'BeforeCreateCompiler',
    'AfterCreateCompiler',
    'BeforeDevCompile',
    'BeforeEnvironmentCompile',
    'ModifyHTMLTags',
    'ModifyHTML',
    'AfterEnvironmentCompile',
    'AfterDevCompile',
    'DevCompileDone',
    'CloseDevServer',
  ]);
});

test('should run plugin hooks correctly when running preview', async () => {
  const { plugin, hooks } = recordPluginHooks();
  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      plugins: [plugin],
    },
  });

  const result = await rsbuild.preview({
    checkDistDir: false,
  });

  await result.server.close();

  expect(hooks).toEqual([
    'ModifyRsbuildConfig',
    'ModifyEnvironmentConfig',
    'BeforeStartPreviewServer',
    'AfterStartPreviewServer',
  ]);
});
