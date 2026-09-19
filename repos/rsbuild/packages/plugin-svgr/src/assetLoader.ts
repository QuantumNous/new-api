import path from 'node:path';
import { Buffer } from 'node:buffer';
import type { Rspack } from '@rsbuild/core';
import { interpolateName } from 'loader-utils';

type FilenameTemplate = string | ((resourcePath: string, resourceQuery?: string) => string);

export type SvgAssetLoaderOptions = {
  limit: number;
  name: FilenameTemplate;
  publicPath?: string | ((url: string, resourcePath: string, context: string) => string);
};

type RawLoaderDefinition<OptionsType> = ((
  this: Rspack.LoaderContext<OptionsType>,
  content: Buffer | string,
) => string | Buffer | void | Promise<string | Buffer | void>) & {
  raw: true;
};

const SVG_MIME_TYPE = 'image/svg+xml';
const HASH_TEMPLATE_REGEX = /\[(?:[^:\]]+:)?(?:hash|contenthash)(?::[^\]]+)?]/i;

const normalizePath = (value: string) => value.replace(/\\/g, '/');

const assetLoader: RawLoaderDefinition<SvgAssetLoaderOptions> = function (content) {
  const { limit, name, publicPath } = this.getOptions();
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');

  if (buffer.length <= limit) {
    const dataUrl = `data:${SVG_MIME_TYPE};base64,${buffer.toString('base64')}`;
    return `export default ${JSON.stringify(dataUrl)}`;
  }

  const filename = interpolateName(this, name, {
    context: this.rootContext,
    content: buffer,
  });

  const assetInfo: {
    immutable?: true;
    sourceFilename: string;
  } = {
    sourceFilename: normalizePath(path.relative(this.rootContext, this.resourcePath)),
  };

  if (typeof name === 'string' && HASH_TEMPLATE_REGEX.test(name)) {
    assetInfo.immutable = true;
  }

  this.emitFile(filename, buffer, undefined, assetInfo);

  /**
   * Keep compatibility with Rslib, which overrides this loader option
   * with a function to inject a stable placeholder into library output.
   */
  const publicPathCode =
    typeof publicPath === 'function'
      ? JSON.stringify(publicPath(filename, this.resourcePath, this.rootContext))
      : typeof publicPath === 'string'
        ? JSON.stringify(`${publicPath.endsWith('/') ? publicPath : `${publicPath}/`}${filename}`)
        : `__webpack_public_path__ + ${JSON.stringify(filename)}`;

  return `export default ${publicPathCode};`;
};

assetLoader.raw = true;

export default assetLoader;
