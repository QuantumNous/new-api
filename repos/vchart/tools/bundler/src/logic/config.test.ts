import { describe, it, expect } from 'vitest';
import { parserCLIArgs, getFinalConfig, getDefaultConfig, loadConfigFile } from './config';
import { loadPackageJson } from './package';
import path from 'path';

const userConfigFilePath = path.resolve(__dirname, '../../fixtures/config/bundler.config.js');

describe('config', () => {
  it('parser cli args', () => {
    const args = parserCLIArgs(
      `--envs version="'x.y.z'" -f es --formats cjs --envs __DEV__=true --config xxx.js -c yyy.js --name foo --name qux --clean -s false`
    );
    expect(args.envs?.length).toEqual(2);
    expect(args.config).toEqual('xxx.js');
    expect(args.name).toEqual('foo');
    expect(args.envs).toEqual([`version="'x.y.z'"`, '__DEV__=true']);
    expect(args.formats).toEqual([`es`, 'cjs']);
    expect(args.sourcemap).toEqual(false);
    expect(args.clean).toEqual(true);
  });
  it('should get correctly config from cli args', () => {
    const rawPackageJson = loadPackageJson(process.cwd());
    if (!rawPackageJson) {
      return;
    }

    const name = 'foo';
    const root = '/path/to/project';
    const tsconfig = '/path/to/tsconfig';
    const input = 'source/index.ts';

    const args = parserCLIArgs(
      `--root ${root} --config ${userConfigFilePath} --tsconfig=${tsconfig} --input ${input} --formats es -f cjs -f umd --name ${name} -s  -w -e version="'x.y.z'" --envs __DEV__=true --less --copy png --copy css`
    );
    const defaultConfig = getDefaultConfig();
    const userConfig = loadConfigFile(args.config || '');
    const config = getFinalConfig(args, userConfig, defaultConfig, rawPackageJson.version);

    // expect(defaultConfig.name).toEqual(packageNameToPath(rawPackageJson.name));
    expect(config.name).toEqual(name);
    expect(config.root).toEqual(root);
    expect(config.tsconfig).toEqual(tsconfig);
    expect(config.input).toEqual(input);
    expect(config.formats).toEqual(['es', 'cjs', 'umd']);
    expect(JSON.parse(config.envs['version'] as string)).toEqual("'x.y.z'");
    expect(JSON.parse(config.envs['__DEV__'] as string)).toEqual(true);
    expect(JSON.parse(config.envs['__VERSION__'] as string)).toEqual(rawPackageJson.version);
    expect(config.sourcemap).toEqual(true);
    expect(config.watch).toEqual(true);
    expect(config.less).toEqual(true);
    // expect(config.dev).toEqual(true);
    expect(config.clean).toEqual(false);
    expect(config.copy).toEqual(['png', 'css']);
  });
  it('should get correctly config from user config', () => {
    const rawPackageJson = loadPackageJson(process.cwd());
    if (!rawPackageJson) {
      return;
    }

    const defaultConfig = getDefaultConfig();
    const userConfig = loadConfigFile(userConfigFilePath);
    const config = getFinalConfig({}, userConfig, defaultConfig, rawPackageJson.version);

    // expect(defaultConfig.name).toEqual(packageNameToPath(rawPackageJson.name));
    expect(config.name).toEqual(userConfig.name);
    expect(config.formats).toEqual(userConfig.formats);
    expect(config.outputDir).toBeDefined();
    expect(config.outputDir.cjs).toBe('cjs');
    if (typeof config.external === 'function') {
      expect(config.external(rawPackageJson)).toEqual(Object.keys(rawPackageJson.dependencies || {}));
    }
    expect(config.rollupOptions.cache).toEqual(true);
    // expect(config.rollupOptions.onwarn).toBeDefined();
    expect(config.copy).toEqual(['png', 'css']);
  });
});
