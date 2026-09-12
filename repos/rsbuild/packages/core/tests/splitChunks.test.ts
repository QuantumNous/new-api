import { createRsbuild } from '../src';
import { getPackageNameFromModulePath, MODULE_PATH_REGEX } from '../src/plugins/splitChunks';

describe('plugin-split-chunks', () => {
  it('should set `default` preset by default', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          polyfill: 'entry',
        },
      },
    });

    const config = await rsbuild.initConfigs();
    expect(config[0].optimization?.splitChunks).toMatchSnapshot();
  });

  it('should set `per-package` preset', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          polyfill: 'entry',
        },
        splitChunks: {
          preset: 'per-package',
        },
      },
    });

    const config = await rsbuild.initConfigs();
    expect(config[0].optimization?.splitChunks).toMatchSnapshot();
  });

  it('should set `single-vendor` preset', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          polyfill: 'entry',
        },
        splitChunks: {
          preset: 'single-vendor',
        },
      },
    });

    const config = await rsbuild.initConfigs();
    expect(config[0].optimization?.splitChunks).toMatchSnapshot();
  });

  it('should disable split chunks', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          polyfill: 'entry',
        },
        splitChunks: false,
      },
    });

    const config = await rsbuild.initConfigs();
    expect(config[0].optimization?.splitChunks).toEqual(false);
  });

  it('should merge split chunks options', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          polyfill: 'entry',
        },
        splitChunks: {
          preset: 'default',
          cacheGroups: {
            commons: {
              name: 'commons',
              test: /[\\/]src[\\/]commons[\\/]/,
              minChunks: 2,
              priority: -10,
            },
          },
        },
      },
    });

    const config = await rsbuild.initConfigs();
    expect(config[0].optimization?.splitChunks).toMatchSnapshot();
  });
});

describe('getPackageNameFromModulePath', () => {
  it('should parse the correct path fragment in npm/yarn', async () => {
    let modulePath = '/path/to/node_modules/@scope/package-name/index.js';
    let [_, scope, name] = modulePath.match(MODULE_PATH_REGEX)!;
    expect(scope).toBe('@scope');
    expect(name).toBe('package-name');

    modulePath = '/path/to/node_modules/package-name/index.js';
    [_, scope, name] = modulePath.match(MODULE_PATH_REGEX)!;
    expect(scope).toBe(undefined);
    expect(name).toBe('package-name');
  });

  it('should parse the correct path fragment in pnpm', async () => {
    let modulePath =
      '/path/to/node_modules/.pnpm/@scope+package-name@1.0.0/node_modules/@scope/package-name/index.js';
    let [_, scope, name] = modulePath.match(MODULE_PATH_REGEX)!;
    expect(scope).toBe('@scope');
    expect(name).toBe('package-name');

    modulePath =
      '/path/to/node_modules/.pnpm/package-name@1.0.0/node_modules/package-name/index.js';
    [_, scope, name] = modulePath.match(MODULE_PATH_REGEX)!;
    expect(scope).toBe(undefined);
    expect(name).toBe('package-name');
  });

  it('should return the correct package name in npm/yarn', () => {
    let modulePath = '/path/to/node_modules/@scope/package-name/index.js';
    expect(getPackageNameFromModulePath(modulePath)).toBe('npm-scope_package-name');

    modulePath = '/path/to/node_modules/package-name/index.js';
    expect(getPackageNameFromModulePath(modulePath)).toBe('npm-package-name');
  });

  it('should return the correct package name in pnpm', () => {
    let modulePath =
      '/path/to/node_modules/.pnpm/@scope+package-name@1.0.0/node_modules/@scope/package-name/index.js';
    expect(getPackageNameFromModulePath(modulePath)).toBe('npm-scope_package-name');

    modulePath =
      '/path/to/node_modules/.pnpm/package-name@1.0.0/node_modules/package-name/index.js';
    expect(getPackageNameFromModulePath(modulePath)).toBe('npm-package-name');
  });
});
