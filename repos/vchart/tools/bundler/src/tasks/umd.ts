import { rollup } from 'rollup';
import * as path from 'path';
import type { OutputOptions, RollupBuild } from 'rollup';
import type { RawPackageJson } from '../logic/package';
import type { Config } from '../logic/config';
import { getBabelPlugins } from '../logic/babel.config';
import { getRollupOptions } from '../logic/rollup.config';
import { DebugConfig } from '../logic/debug';

async function generateOutputs(bundle: RollupBuild, outputOptionsList: OutputOptions[]) {
  for (const outputOptions of outputOptionsList) {
    await bundle.write(outputOptions);
  }
}
function packageNameToPath(name: string) {
  return name.replace('@', '').replace('/', '_');
}
export async function buildUmd(config: Config, projectRoot: string, rawPackageJson: RawPackageJson, minify: boolean) {
  const babelPlugins = getBabelPlugins(rawPackageJson.name, {
    envOptions: {
      targets: config.targets
    }
  });

  DebugConfig('BabelPlugins', babelPlugins);
  const entry = path.resolve(
    projectRoot,
    config.sourceDir,
    typeof config.input === 'string' ? config.input : config.input.umd!
  );

  const rollupOptions = getRollupOptions(projectRoot, entry, rawPackageJson, babelPlugins, { ...config, minify });
  DebugConfig('RollupOptions', JSON.stringify(rollupOptions));
  const bundle = await rollup(rollupOptions);

  const dest = path.resolve(projectRoot, config.outputDir.umd!);
  await generateOutputs(bundle, [
    {
      format: 'umd',
      name: config.name || packageNameToPath(rawPackageJson.name),
      file: minify
        ? `${dest}/${config.umdOutputFilename || packageNameToPath(rawPackageJson.name)}.min.js`
        : `${dest}/${config.umdOutputFilename || packageNameToPath(rawPackageJson.name)}.js`,
      exports: 'named',
      globals: { react: 'React', ...config.globals }
    }
  ]);

  if (bundle) {
    await bundle.close();
  }
}
export async function buildES(config: Config, projectRoot: string, rawPackageJson: RawPackageJson, minify: boolean) {
  const babelPlugins = getBabelPlugins(rawPackageJson.name, {
    envOptions: {
      targets: config.targets
    }
  });
  const entry = path.resolve(
    projectRoot,
    config.sourceDir,
    typeof config.input === 'string' ? config.input : config.input.umd!
  );

  const rollupOptions = getRollupOptions(projectRoot, entry, rawPackageJson, babelPlugins, { ...config, minify });
  DebugConfig('RollupOptions', JSON.stringify(rollupOptions));
  const bundle = await rollup(rollupOptions);

  const dest = path.resolve(projectRoot, config.outputDir.umd!);
  await generateOutputs(bundle, [
    {
      format: 'es',
      name: config.name || packageNameToPath(rawPackageJson.name),
      file: minify
        ? `${dest}/${config.umdOutputFilename || packageNameToPath(rawPackageJson.name)}.es.min.js`
        : `${dest}/${config.umdOutputFilename || packageNameToPath(rawPackageJson.name)}.es.js`,
      exports: 'named',
      globals: { react: 'React', ...config.globals }
    }
  ]);

  if (bundle) {
    await bundle.close();
  }
}
