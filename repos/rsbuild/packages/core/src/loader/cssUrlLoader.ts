import path from 'node:path';
import type {
  AssetInfo,
  LoaderDefinitionFunction,
  PathData,
  PitchLoaderDefinitionFunction,
} from '@rspack/core';
import { isCSSModules } from '../helpers/css';
import type { CSSLoaderOptions } from '../types';

type CSSUrlLoaderOptions = {
  filename: string | ((pathData: PathData, assetInfo?: AssetInfo) => string);
  modules: CSSLoaderOptions['modules'];
};

const HASH_PLACEHOLDER_REGEX =
  /\[(?:[^:\]]+:)?(?:chunkhash|contenthash|hash|fullhash)(?::[^\]]+)?]/i;

const normalizePath = (value: string) => value.replace(/\\/g, '/');

const isParentDirRelativePath = (value: string) =>
  value === '..' || value.startsWith(`..${path.sep}`);

const getRelativePath = (root: string, resourcePath: string) => {
  const relativePath = path.relative(root, resourcePath);
  if (relativePath && !isParentDirRelativePath(relativePath) && !path.isAbsolute(relativePath)) {
    return normalizePath(relativePath);
  }
};

const getCSSUrlNameSource = (root: string, resourcePath: string) =>
  getRelativePath(path.join(root, 'src'), resourcePath) ??
  getRelativePath(root, resourcePath) ??
  path.basename(resourcePath);

const getCSSUrlAssetName = (nameSource: string, ext: string) =>
  ext ? nameSource.slice(0, -ext.length) : nameSource;

const getCSSContent = (moduleExports: unknown): string => {
  const content =
    moduleExports && typeof moduleExports === 'object' && 'default' in moduleExports
      ? moduleExports.default
      : moduleExports;

  if (typeof content !== 'string') {
    throw new Error('[rsbuild:css] Expected CSS ?url imports to export a string.');
  }

  return content;
};

const getContentHash = (
  loaderContext: ThisParameterType<LoaderDefinitionFunction<CSSUrlLoaderOptions>>,
  content: string,
) => {
  const hash = loaderContext.utils.createHash(
    loaderContext._compilation.outputOptions.hashFunction,
  );
  hash.update(Buffer.from(content));

  return hash.digest(loaderContext._compilation.outputOptions.hashDigest || 'hex');
};

const cssUrlLoader: LoaderDefinitionFunction<CSSUrlLoaderOptions> = function (source) {
  return source;
};

export const pitch: PitchLoaderDefinitionFunction<CSSUrlLoaderOptions> = async function (
  remainingRequest,
) {
  const options = this.getOptions();

  if (isCSSModules(options.modules, this)) {
    throw new Error(
      '[rsbuild:css] CSS Modules do not support the ?url query. Use ?inline to import the compiled CSS content as a string.',
    );
  }

  const moduleExports = await this.importModule(`!!${remainingRequest}`);
  const content = getCSSContent(moduleExports);

  const ext = path.extname(this.resourcePath);
  const sourceFilename = normalizePath(path.relative(this.rootContext, this.resourcePath));
  const nameSource = getCSSUrlNameSource(this.rootContext, this.resourcePath);
  const name = getCSSUrlAssetName(nameSource, ext);
  const contentHash = getContentHash(this, content);
  const pathData: PathData = {
    contentHash,
    chunk: {
      name,
      hash: contentHash,
      contentHash: {
        css: contentHash,
      },
    },
  };
  const assetInfo: AssetInfo = {
    sourceFilename,
  };
  const filenameTemplate =
    typeof options.filename === 'function'
      ? options.filename(pathData, assetInfo)
      : options.filename;
  const { path: filename, info } = this._compilation.getAssetPathWithInfo(
    filenameTemplate,
    pathData,
  );

  this.emitFile(filename, content, undefined, {
    ...info,
    ...assetInfo,
    immutable: info.immutable || HASH_PLACEHOLDER_REGEX.test(filenameTemplate),
  });

  return `export default import.meta.rspackPublicPath + ${JSON.stringify(filename)};`;
};

export default cssUrlLoader;
