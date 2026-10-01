import { DEFAULT_WEB_BROWSERSLIST } from '../constants';
import type { RsbuildPlugin } from '../types';

export const pluginTarget = (): RsbuildPlugin => ({
  name: 'rsbuild:target',

  setup(api) {
    api.modifyBundlerChain({
      order: 'pre',
      handler: (chain, { target, environment }) => {
        if (target === 'node') {
          chain.target('node');
          return;
        }

        const { browserslist } = environment;

        // skip calculation if the browserslist is the default value
        const isDefaultBrowserslist = browserslist.join(',') === DEFAULT_WEB_BROWSERSLIST.join(',');

        if (target === 'web-worker') {
          chain.target(
            isDefaultBrowserslist
              ? ['webworker', 'es2017']
              : // TODO: Rspack should support `browserslist:` for webworker target
                ['webworker', 'es5'],
          );
          return;
        }

        const esQuery = isDefaultBrowserslist
          ? 'es2017'
          : (`browserslist:${browserslist.join(',')}` as const);
        chain.target(['web', esQuery]);
      },
    });
  },
});
