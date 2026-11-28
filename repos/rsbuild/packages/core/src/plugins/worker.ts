import path from 'node:path';
import { LOADER_PATH, WORKER_QUERY_REGEX } from '../constants';
import type { RsbuildPlugin } from '../types';

export const pluginWorker = (): RsbuildPlugin => ({
  name: 'rsbuild:worker',

  setup(api) {
    api.modifyBundlerChain({
      order: 'pre',
      handler: (chain, { CHAIN_ID }) => {
        chain.module
          .rule(CHAIN_ID.RULE.JS)
          .oneOf(CHAIN_ID.ONE_OF.JS_WORKER)
          .resourceQuery(WORKER_QUERY_REGEX)
          .type('javascript/auto')
          .use(CHAIN_ID.USE.WORKER_QUERY)
          .loader(path.join(LOADER_PATH, 'workerLoader.mjs'));
      },
    });
  },
});
