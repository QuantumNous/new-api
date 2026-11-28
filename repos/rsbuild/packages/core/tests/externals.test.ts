import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRsbuild } from '../src';
import { composeAutoExternalRules } from '../src/plugins/externals';

const createTempRoot = (pkg: Record<string, unknown>) => {
  const root = mkdtempSync(join(tmpdir(), 'rsbuild-auto-external-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify(pkg));
  return root;
};

describe('plugin-externals', () => {
  it('should not enable autoExternal by default', async () => {
    const root = createTempRoot({
      dependencies: {
        foo: '1.0.0',
      },
    });
    const rsbuild = await createRsbuild({
      cwd: root,
      config: {
        source: {
          entry: {
            index: './src/index.js',
          },
        },
      },
    });

    const [config] = await rsbuild.initConfigs();

    expect(config.externals).toBeUndefined();
  });

  it('should compose autoExternal rules correctly', () => {
    const result = composeAutoExternalRules({
      autoExternal: true,
      pkgJson: {
        dependencies: {
          foo: '1.0.0',
          'foo.bar': '1.0.0',
        },
        devDependencies: {
          bar: '1.0.0',
        },
        peerDependencies: {
          baz: '1.0.0',
          foo: '1.0.0',
        },
        optionalDependencies: {
          '@scope/pkg': '1.0.0',
        },
      },
    });

    expect(result).toEqual([
      /^foo(?:$|[/\\])/,
      /^foo\.bar(?:$|[/\\])/,
      /^baz(?:$|[/\\])/,
      /^@scope\/pkg(?:$|[/\\])/,
    ]);
  });

  it('should support object autoExternal config', () => {
    const result = composeAutoExternalRules({
      autoExternal: {
        dependencies: false,
        devDependencies: true,
      },
      pkgJson: {
        dependencies: {
          foo: '1.0.0',
        },
        devDependencies: {
          bar: '1.0.0',
        },
        peerDependencies: {
          baz: '1.0.0',
        },
      },
    });

    expect(result).toEqual([/^baz(?:$|[/\\])/, /^bar(?:$|[/\\])/]);
  });

  it('should support exclude in autoExternal config', () => {
    const result = composeAutoExternalRules({
      autoExternal: {
        devDependencies: true,
        exclude: ['foo', /^@scope\//g],
      },
      pkgJson: {
        dependencies: {
          foo: '1.0.0',
          baz: '1.0.0',
          '@scope/one': '1.0.0',
          '@scope/two': '1.0.0',
        },
        devDependencies: {
          bar: '1.0.0',
        },
        optionalDependencies: {
          '@scope/pkg': '1.0.0',
        },
      },
    });

    expect(result).toEqual([/^baz(?:$|[/\\])/, /^bar(?:$|[/\\])/]);
  });

  it('should not compose rules when autoExternal is disabled', () => {
    expect(
      composeAutoExternalRules({
        autoExternal: false,
        pkgJson: {
          dependencies: {
            foo: '1.0.0',
          },
        },
      }),
    ).toBeUndefined();
  });

  it('should allow user externals object to override autoExternal', () => {
    const result = composeAutoExternalRules({
      autoExternal: true,
      pkgJson: {
        dependencies: {
          foo: '1.0.0',
          bar: '1.0.0',
        },
      },
      userExternals: {
        foo: 'foo-1',
      },
    });

    expect(result).toEqual([/^bar(?:$|[/\\])/]);
  });

  it('should apply autoExternal to Rspack externals', async () => {
    const root = createTempRoot({
      dependencies: {
        foo: '1.0.0',
      },
      peerDependencies: {
        bar: '1.0.0',
      },
      devDependencies: {
        baz: '1.0.0',
      },
    });
    const rsbuild = await createRsbuild({
      cwd: root,
      config: {
        source: {
          entry: {
            index: './src/index.js',
          },
        },
        output: {
          autoExternal: true,
        },
      },
    });

    const [config] = await rsbuild.initConfigs();

    expect(config.externals).toEqual([/^foo(?:$|[/\\])/, /^bar(?:$|[/\\])/]);
  });

  it('should keep user externals before autoExternal rules', async () => {
    const root = createTempRoot({
      dependencies: {
        foo: '1.0.0',
        bar: '1.0.0',
      },
    });
    const userExternals = {
      foo: 'foo-1',
    };
    const rsbuild = await createRsbuild({
      cwd: root,
      config: {
        source: {
          entry: {
            index: './src/index.js',
          },
        },
        output: {
          autoExternal: true,
          externals: userExternals,
        },
      },
    });

    const [config] = await rsbuild.initConfigs();

    expect(config.externals).toEqual([userExternals, /^bar(?:$|[/\\])/]);
  });

  it('should apply autoExternal before creating compiler for web worker target', async () => {
    const root = createTempRoot({
      dependencies: {
        foo: '1.0.0',
      },
    });
    const rsbuild = await createRsbuild({
      cwd: root,
      config: {
        source: {
          entry: {
            index: './src/index.js',
          },
        },
        output: {
          target: 'web-worker',
          autoExternal: true,
        },
      },
    });

    const [config] = await rsbuild.initConfigs();

    // The final web worker externals are removed in the onBeforeCreateCompiler hook.
    // initConfigs only verifies the generated Rspack config before that hook runs.
    expect(config.externals).toEqual([/^foo(?:$|[/\\])/]);
  });
});
