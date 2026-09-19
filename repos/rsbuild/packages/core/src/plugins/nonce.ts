import { rspack } from '@rspack/core';
import { createVirtualModule } from '../helpers';
import { applyToCompiler } from '../helpers/compiler';
import type { RsbuildPlugin } from '../types';

export const pluginNonce = (): RsbuildPlugin => ({
  name: 'rsbuild:nonce',

  setup(api) {
    api.onAfterCreateCompiler(({ compiler, environments }) => {
      const environmentList = Object.values(environments);
      const nonces = Object.values(environments).map(
        (environment) => environment.config.security.nonce,
      );

      if (!nonces.some((nonce) => !!nonce)) {
        return;
      }

      applyToCompiler(compiler, (compiler, index) => {
        const nonce = nonces[index];
        const environment = environmentList.find((item) => item.index === index);
        const hasHTML = Object.keys(environment?.htmlPaths ?? {}).length;

        if (!hasHTML || !nonce) {
          return;
        }

        // apply import.meta.rspackNonce
        // https://rspack.rs/api/runtime-api/module-variables#importmetarspacknonce
        const injectCode = createVirtualModule(
          `import.meta.rspackNonce = ${JSON.stringify(nonce)};`,
        );
        new rspack.EntryPlugin(compiler.context, injectCode, {
          name: undefined,
        }).apply(compiler);
      });
    });

    api.modifyHTMLTags({
      // ensure `nonce` can be applied to all tags
      order: 'post',
      handler: ({ headTags, bodyTags }, { environment }) => {
        const { config } = environment;
        const { nonce } = config.security;
        const allTags = [...headTags, ...bodyTags];

        if (nonce) {
          for (const tag of allTags) {
            if (
              tag.tag === 'script' ||
              tag.tag === 'style' ||
              (tag.tag === 'link' && tag.attrs?.rel === 'preload' && tag.attrs?.as === 'script')
            ) {
              tag.attrs ??= {};
              tag.attrs.nonce = nonce;
            }
          }
        }

        return { headTags, bodyTags };
      },
    });
  },
});
