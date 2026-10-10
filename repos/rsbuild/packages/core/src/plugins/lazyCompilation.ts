import { getHostInUrl } from '../server/helper';
import { replacePortPlaceholder } from '../server/open';
import type { NormalizedEnvironmentConfig, RsbuildContext, RsbuildPlugin } from '../types';

const getServerUrlFromClientConfig = async (
  config: NormalizedEnvironmentConfig,
  context: RsbuildContext,
): Promise<string | undefined> => {
  const { devServer } = context;
  if (!devServer) {
    return;
  }

  const { client } = config.dev;
  const hasClientHost = Boolean(client.host);
  const hasClientPort = client.port !== undefined && client.port !== '';

  if (!hasClientHost && !hasClientPort) {
    return;
  }

  const protocol = client.protocol ? `${client.protocol === 'wss' ? 'https' : 'http'}:` : '';
  const hostname = await getHostInUrl(client.host || devServer.hostname);
  const port = client.port && client.port !== '<port>' ? client.port : devServer.port;

  return `${protocol}//${hostname}:${port}`;
};

export const pluginLazyCompilation = (): RsbuildPlugin => ({
  name: 'rsbuild:lazy-compilation',

  apply: 'serve',

  setup(api) {
    api.modifyBundlerChain(async (chain, { environment, target }) => {
      if (target !== 'web') {
        return;
      }

      const { config } = environment;
      // Lazy compilation needs the dev client to load the compiled modules.
      if (!config.dev.hmr && !config.dev.liveReload) {
        return;
      }

      const options = config.dev?.lazyCompilation;
      if (!options) {
        return;
      }

      if (options === true) {
        const entries = chain.entryPoints.entries() || {};
        const serverUrl = await getServerUrlFromClientConfig(config, api.context);

        // If there is only one entry, do not enable lazy compilation for entries
        // this can reduce the rebuild time
        if (Object.keys(entries).length <= 1) {
          chain.lazyCompilation({
            entries: false,
            imports: true,
            ...(serverUrl ? { serverUrl } : {}),
          });
          return;
        }

        if (serverUrl) {
          chain.lazyCompilation({
            entries: true,
            imports: true,
            serverUrl,
          });
          return;
        }
      }

      // replace port placeholder in `serverUrl` with actual port
      if (
        typeof options === 'object' &&
        typeof options.serverUrl === 'string' &&
        api.context.devServer
      ) {
        chain.lazyCompilation({
          ...options,
          serverUrl: replacePortPlaceholder(options.serverUrl, api.context.devServer.port),
        });
        return;
      }

      if (typeof options === 'object') {
        const serverUrl = await getServerUrlFromClientConfig(config, api.context);
        chain.lazyCompilation(serverUrl ? { ...options, serverUrl } : options);
        return;
      }

      chain.lazyCompilation(options);
    });
  },
});
