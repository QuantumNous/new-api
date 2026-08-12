import { posix } from 'node:path';
import { ALL_INTERFACES_IPV4, DEFAULT_ASSET_PREFIX, DEFAULT_PORT, LOCALHOST } from '../constants';
import { getFilename } from '../helpers';
import { formatPublicPath, urlJoin } from '../helpers/url';
import { replacePortPlaceholder } from '../server/open';
import type { NormalizedEnvironmentConfig, RsbuildContext, RsbuildPlugin } from '../types';

function getPublicPath({
  isDev,
  config,
  context,
}: {
  isDev: boolean;
  config: NormalizedEnvironmentConfig;
  context: RsbuildContext;
}) {
  const { dev, output, server } = config;

  let publicPath = DEFAULT_ASSET_PREFIX;

  // If `mode` is `production` or `none`, use `output.assetPrefix`
  if (!isDev) {
    if (typeof output.assetPrefix === 'string') {
      publicPath = output.assetPrefix;
    }
  } else if (typeof dev.assetPrefix === 'string') {
    publicPath = dev.assetPrefix;
  } else if (dev.assetPrefix) {
    const protocol = context.devServer?.https ? 'https' : 'http';
    const hostname = context.devServer?.hostname || LOCALHOST;

    if (hostname === ALL_INTERFACES_IPV4) {
      // http://0.0.0.0:port can't visit on Windows, so we shouldn't set publicPath as `//0.0.0.0:${port}/`;
      // Relative to docs:
      // - https://github.com/quarkusio/quarkus/issues/12246
      publicPath = `${protocol}://localhost:<port>/`;
    } else {
      publicPath = `${protocol}://${hostname}:<port>/`;
    }

    if (server.base && server.base !== '/') {
      publicPath = urlJoin(publicPath, server.base);
    }
  }

  const defaultPort = server.port ?? DEFAULT_PORT;
  const port = isDev ? (context.devServer?.port ?? defaultPort) : defaultPort;
  return formatPublicPath(replacePortPlaceholder(publicPath, port));
}

const getJsAsyncPath = (jsPath: string, isServer: boolean, jsAsync?: string) => {
  if (jsAsync !== undefined) {
    return jsAsync;
  }
  if (isServer) {
    return jsPath;
  }

  return jsPath ? `${jsPath}/async` : 'async';
};

export const pluginOutput = (): RsbuildPlugin => ({
  name: 'rsbuild:output',

  setup(api) {
    api.modifyBundlerChain(
      (chain, { CHAIN_ID, isDev, isProd, isServer, environment, rspack, target }) => {
        const { distPath, config } = environment;

        const publicPath = getPublicPath({
          config,
          isDev,
          context: api.context,
        });

        // js output
        const jsPath = config.output.distPath.js;
        const jsAsyncPath = getJsAsyncPath(jsPath, isServer, config.output.distPath.jsAsync);
        const jsFilename = getFilename(config, 'js', isProd, isServer);
        const isJsFilenameFn = typeof jsFilename === 'function';

        chain.output
          .path(distPath)
          .filename(
            isJsFilenameFn
              ? (...args) => {
                  const name = jsFilename(...args);
                  return posix.join(jsPath, name);
                }
              : posix.join(jsPath, jsFilename),
          )
          .chunkFilename(
            isJsFilenameFn
              ? (...args) => {
                  const name = jsFilename(...args);
                  return posix.join(jsAsyncPath, name);
                }
              : posix.join(jsAsyncPath, jsFilename),
          )
          .publicPath(publicPath);

        if (target === 'web' || target === 'web-worker') {
          // Prefer var in Rspack runtime for web-like targets to avoid TDZ checks in browsers.
          chain.output.merge({
            environment: {
              const: false,
            },
          });
        }

        const isESM = config.output.module;

        if (isServer) {
          chain.output.library({
            ...(chain.output.get('library') || {}),
            type: isESM ? 'module' : 'commonjs2',
          });
        }

        if (isESM) {
          if (target === 'web-worker') {
            throw new Error(
              '[rsbuild:config] `output.module: true` is not supported for web-worker target.',
            );
          }

          // For ESM targets, import.meta.dirname / import.meta.filename / __dirname / __filename
          // are preserved as-is. This matches the native behavior in browsers and Node.js.
          chain.node.set('__dirname', false).set('__filename', false);
          chain.output
            .module(true)
            .chunkFormat('module')
            .chunkLoading('import')
            .workerChunkLoading('import');
        }

        if (config.output.copy) {
          const { copy } = config.output;
          const options = Array.isArray(copy) ? { patterns: copy } : copy;

          chain.plugin(CHAIN_ID.PLUGIN.COPY).use(rspack.CopyRspackPlugin, [options]);
        }
      },
    );
  },
});
