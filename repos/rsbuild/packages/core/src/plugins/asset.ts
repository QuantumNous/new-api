import path from 'node:path';
import type { AssetModuleFilename, GeneratorOptionsByModuleType } from '@rspack/core';
import { CHAIN_ID } from '../configChain';
import {
  AUDIO_EXTENSIONS,
  ASSET_EXTENSIONS,
  FONT_EXTENSIONS,
  IMAGE_EXTENSIONS,
  INLINE_QUERY_REGEX,
  RAW_QUERY_REGEX,
  TRACK_EXTENSIONS,
  URL_QUERY_REGEX,
  VIDEO_EXTENSIONS,
} from '../constants';
import { getFilename } from '../helpers';
import type { RsbuildPlugin, RspackChain } from '../types';

const chainStaticAssetRule = ({
  emit,
  rule,
  maxSize,
  filename,
  assetType,
}: {
  emit: boolean;
  rule: RspackChain.Rule;
  maxSize: number;
  filename: AssetModuleFilename;
  assetType: string;
}) => {
  const generatorOptions:
    | GeneratorOptionsByModuleType['asset']
    | GeneratorOptionsByModuleType['asset/resource'] = {
    filename,
  };

  if (!emit) {
    generatorOptions.emit = false;
  }

  // get asset URL: "foo.png?url"
  rule
    .oneOf(`${assetType}-asset-url`)
    .type('asset/resource')
    .resourceQuery(URL_QUERY_REGEX)
    .set('generator', generatorOptions);

  // get inlined base64 content: "foo.png?inline"
  rule.oneOf(`${assetType}-asset-inline`).type('asset/inline').resourceQuery(INLINE_QUERY_REGEX);

  // get asset source: `import source from "foo.png" with { type: "text" }`
  rule.oneOf(`${assetType}-asset-text`).type('asset/source').with({ type: 'text' });

  // get raw content: "foo.png?raw"
  rule.oneOf(`${assetType}-asset-raw`).type('asset/source').resourceQuery(RAW_QUERY_REGEX);

  rule
    .oneOf(`${assetType}-asset`)
    .type('asset')
    .parser({
      // asset will be inlined if file size < maxSize
      dataUrlCondition: {
        maxSize,
      },
    })
    .set('generator', generatorOptions);
};

export function getRegExpForExts(exts: string[]): RegExp {
  const normalizedExts: string[] = [];

  for (const ext of exts) {
    const trimmed = ext.trim();
    normalizedExts.push(trimmed.startsWith('.') ? trimmed.slice(1) : trimmed);
  }

  const matcher = normalizedExts.join('|');

  return new RegExp(normalizedExts.length === 1 ? `\\.${matcher}$` : `\\.(?:${matcher})$`, 'i');
}

export const pluginAsset = (): RsbuildPlugin => ({
  name: 'rsbuild:asset',

  setup(api) {
    api.modifyBundlerChain((chain, { isProd, environment }) => {
      const { config } = environment;

      const getMergedFilename = (
        assetType: 'svg' | 'font' | 'image' | 'media' | 'assets',
      ): AssetModuleFilename => {
        const distDir = config.output.distPath[assetType];
        const filename = getFilename(config, assetType, isProd);

        if (typeof filename === 'function') {
          return (...args) => {
            const name = filename(...args);
            return path.posix.join(distDir, name);
          };
        }

        return path.posix.join(distDir, filename);
      };

      const createAssetRule = (
        assetType: 'svg' | 'font' | 'image' | 'media' | 'assets',
        exts: string[],
        emit: boolean,
      ) => {
        const regExp = getRegExpForExts(exts);
        const { dataUriLimit } = config.output;
        const maxSize = typeof dataUriLimit === 'number' ? dataUriLimit : dataUriLimit[assetType];
        const rule = chain.module.rule(assetType).test(regExp);

        chainStaticAssetRule({
          emit,
          rule,
          maxSize,
          filename: getMergedFilename(assetType),
          assetType,
        });
      };

      const { emitAssets } = config.output;

      // image
      createAssetRule(CHAIN_ID.RULE.IMAGE, IMAGE_EXTENSIONS, emitAssets);

      // svg
      createAssetRule(CHAIN_ID.RULE.SVG, ['svg'], emitAssets);

      // media
      createAssetRule(
        CHAIN_ID.RULE.MEDIA,
        [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...TRACK_EXTENSIONS],
        emitAssets,
      );

      // font
      createAssetRule(CHAIN_ID.RULE.FONT, FONT_EXTENSIONS, emitAssets);

      // other built-in assets
      createAssetRule(CHAIN_ID.RULE.ASSETS, ASSET_EXTENSIONS, emitAssets);

      // JSON
      // Rspack has built-in rule for JSON, so we only need to handle imports with query or import attributes
      const rule = chain.module.rule(CHAIN_ID.RULE.JSON).test(/\.json$/i);
      // get JSON source: `import source from "foo.json" with { type: "text" }`
      rule.oneOf('json-asset-text').type('asset/source').with({ type: 'text' });
      // get raw content: "foo.json?raw"
      rule.oneOf('json-asset-raw').type('asset/source').resourceQuery(RAW_QUERY_REGEX);

      // assets
      const assetsFilename = getMergedFilename('assets');
      chain.output.assetModuleFilename(assetsFilename);
      if (!emitAssets) {
        chain.module.generator.merge({ 'asset/resource': { emit: false } });
      }

      // additional assets
      const { assetsInclude } = config.source;
      if (assetsInclude) {
        const { dataUriLimit } = config.output;
        const rule = chain.module.rule(CHAIN_ID.RULE.ADDITIONAL_ASSETS).test(assetsInclude);
        const maxSize = typeof dataUriLimit === 'number' ? dataUriLimit : dataUriLimit.assets;

        chainStaticAssetRule({
          emit: emitAssets,
          rule,
          maxSize,
          filename: assetsFilename,
          assetType: 'additional-assets',
        });
      }
    });
  },
});
