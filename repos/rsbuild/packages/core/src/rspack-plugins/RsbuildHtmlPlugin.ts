import path from 'node:path';
import { type Compilation, type Compiler, rspack } from '@rspack/core';
import { color, isFunction, partition } from '../helpers';
import { addCompilationError } from '../helpers/compiler';
import { readFileAsync } from '../helpers/fs';
import { ensureAssetPrefix, isURL } from '../helpers/url';
import type { Logger } from '../logger';
import type {
  EnvironmentContext,
  HtmlBasicTag,
  HtmlRspackPlugin,
  HtmlTag,
  HtmlTagContext,
  HtmlTagDescriptor,
  InternalContext,
  Rspack,
} from '../types';

type HtmlTagObject = HtmlRspackPlugin.HtmlTagObject;

export type TagConfig = {
  tags?: HtmlTagDescriptor[];
  hash?: HtmlTag['hash'];
  append?: HtmlTag['append'];
  publicPath?: HtmlTag['publicPath'];
};

/**
 * A unique identifier for providing extra data to RsbuildHtmlPlugin
 */
export const entryNameSymbol: unique symbol = Symbol('entryName');

/**
 * @see https://developer.mozilla.org/en-US/docs/Glossary/Void_element}
 */
const VOID_TAGS = [
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
];

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/head#see_also
 */
const HEAD_TAGS = ['title', 'base', 'link', 'style', 'meta', 'script', 'noscript', 'template'];

const FILE_ATTRS = {
  link: 'href',
  script: 'src',
};

export type HtmlExtraData = {
  entryName: string;
  context: InternalContext;
  environment: EnvironmentContext;
  favicon?: string;
  faviconDistPath: string;
  tagConfig?: TagConfig;
  templateContent?: string;
};

export type AlterAssetTagGroupsData = {
  headTags: HtmlTagObject[];
  bodyTags: HtmlTagObject[];
  outputName: string;
  publicPath: string;
  plugin: HtmlRspackPlugin;
};

export const hasTitle = (html?: string): boolean =>
  html ? /<title/i.test(html) && /<\/title/i.test(html) : false;

const getTagPriority = (tag: HtmlTag, tagConfig: TagConfig) => {
  const head = tag.head ?? HEAD_TAGS.includes(tag.tag);
  let priority = head ? -2 : 2;

  const append = tag.append ?? tagConfig.append;
  if (typeof append === 'boolean') {
    priority += append ? 1 : -1;
  }

  return priority;
};

/**
 * `HtmlTagObject` -> `HtmlBasicTag`
 */
const formatBasicTag = (tag: HtmlTagObject): HtmlBasicTag => ({
  tag: tag.tagName,
  attrs: tag.attributes,
  children: tag.innerHTML,
  metadata: tag.meta,
});

/**
 * `HtmlBasicTag` -> `HtmlTagObject`
 */
const fromBasicTag = (tag: HtmlBasicTag): HtmlTagObject => ({
  meta: tag.metadata ?? {},
  tagName: tag.tag,
  attributes: tag.attrs ?? {},
  voidTag: VOID_TAGS.includes(tag.tag),
  innerHTML: tag.children,
});

/**
 * `HtmlTagObject[]` -> `HtmlTag[]`
 */
const formatTags = (tags: HtmlTagObject[], override?: Partial<HtmlTag>): HtmlTag[] =>
  tags.map((tag) => ({
    ...formatBasicTag(tag),
    publicPath: false,
    ...override,
  }));

const applyTagConfig = (
  data: AlterAssetTagGroupsData,
  tagConfig: TagConfig,
  compilationHash: string,
  entryName: string,
) => {
  if (!tagConfig.tags?.length) {
    return data;
  }

  const fromInjectTags = (tags: HtmlTag[]) => {
    const ret: HtmlTagObject[] = [];

    for (const tag of tags) {
      // apply publicPath and hash to filename attr.
      const attrs = { ...tag.attrs };
      const filenameTag = FILE_ATTRS[tag.tag as keyof typeof FILE_ATTRS];
      let filename = attrs[filenameTag];

      if (typeof filename === 'string') {
        const optPublicPath = tag.publicPath ?? tagConfig.publicPath;

        if (typeof optPublicPath === 'function') {
          filename = optPublicPath(filename, data.publicPath);
        } else if (typeof optPublicPath === 'string') {
          filename = ensureAssetPrefix(filename, optPublicPath);
        } else if (optPublicPath !== false) {
          filename = ensureAssetPrefix(filename, data.publicPath);
        }

        const optHash = tag.hash ?? tagConfig.hash;

        if (typeof optHash === 'function') {
          if (compilationHash.length) {
            filename = optHash(filename, compilationHash);
          }
        } else if (typeof optHash === 'string') {
          if (optHash.length) {
            filename = `${filename}?${optHash}`;
          }
        } else if (optHash === true) {
          if (compilationHash.length) {
            filename = `${filename}?${compilationHash}`;
          }
        }

        attrs[filenameTag] = filename;
      }

      ret.push(fromBasicTag({ ...tag, attrs }));
    }
    return ret;
  };

  let tags = [
    ...formatTags(data.headTags, { head: true }),
    ...formatTags(data.bodyTags, { head: false }),
  ];

  const context: HtmlTagContext = {
    hash: compilationHash,
    entryName,
    outputName: data.outputName,
    publicPath: data.publicPath,
  };

  for (const item of tagConfig.tags) {
    if (isFunction(item)) {
      tags = item(tags, context) || tags;
    } else {
      tags.push(item);
    }

    tags = tags.sort(
      (tag1, tag2) => getTagPriority(tag1, tagConfig) - getTagPriority(tag2, tagConfig),
    );
  }

  const [headTags, bodyTags] = partition(tags, (tag) => tag.head ?? HEAD_TAGS.includes(tag.tag));
  data.headTags = fromInjectTags(headTags);
  data.bodyTags = fromInjectTags(bodyTags);

  return data;
};

const addTitleTag = (headTags: HtmlTagObject[], title = '') => {
  if (title !== '' && title !== undefined) {
    headTags.unshift({
      tagName: 'title',
      innerHTML: title,
      attributes: {},
      voidTag: false,
      meta: {},
    });
  }
};

export class RsbuildHtmlPlugin {
  readonly name: string;

  readonly getExtraData: (entryName: string) => HtmlExtraData | undefined;

  readonly getHTMLPlugin: () => typeof HtmlRspackPlugin;

  constructor(
    getExtraData: (entryName: string) => HtmlExtraData | undefined,
    getHTMLPlugin: () => typeof HtmlRspackPlugin,
  ) {
    this.name = 'RsbuildHtmlPlugin';
    this.getExtraData = getExtraData;
    this.getHTMLPlugin = getHTMLPlugin;
  }

  apply(compiler: Compiler): void {
    const emitFavicon = async ({
      compilation,
      favicon,
      faviconDistPath,
      logger,
    }: {
      compilation: Rspack.Compilation;
      favicon: string;
      faviconDistPath: string;
      logger: Logger;
    }) => {
      const name = path.basename(favicon);

      if (compilation.assets[name]) {
        return name;
      }

      const inputFs = compilation.inputFileSystem;
      if (!inputFs) {
        addCompilationError(
          compilation,
          `${color.dim('[rsbuild:html]')} Failed to read the favicon file as ${color.yellow(
            'compilation.inputFileSystem',
          )} is not available.`,
        );
        return null;
      }

      const inputFilename = path.isAbsolute(favicon)
        ? favicon
        : path.join(compilation.compiler.context, favicon);

      let fileContent: Buffer | string | undefined;

      try {
        fileContent = await readFileAsync(inputFs, inputFilename);
      } catch (error) {
        logger.debug(`read favicon error: ${error}`);

        addCompilationError(
          compilation,
          `${color.dim('[rsbuild:html]')} Failed to read the favicon file at ${color.yellow(
            inputFilename,
          )}.`,
        );
        return null;
      }

      const source = new rspack.sources.RawSource(fileContent, false);
      const outputFilename = path.posix.join(faviconDistPath, name);
      compilation.emitAsset(outputFilename, source);

      return outputFilename;
    };

    const addFavicon = async ({
      headTags,
      favicon,
      faviconDistPath,
      compilation,
      publicPath,
      logger,
    }: {
      headTags: HtmlTagObject[];
      favicon: string;
      faviconDistPath: string;
      compilation: Rspack.Compilation;
      publicPath: string;
      logger: Logger;
    }) => {
      let href = favicon;

      if (!isURL(favicon)) {
        const name = await emitFavicon({
          compilation,
          favicon,
          faviconDistPath,
          logger,
        });

        if (name === null) {
          return;
        }

        href = ensureAssetPrefix(name, publicPath);
      }

      const tag: HtmlRspackPlugin.HtmlTagObject = {
        tagName: 'link',
        voidTag: true,
        attributes: {
          rel: 'icon',
          href,
        },
        meta: {},
      };

      if (href.endsWith('.svg')) {
        tag.attributes.type = 'image/svg+xml';
      }

      headTags.unshift(tag);
    };

    const getExtraDataByPlugin = (plugin: HtmlRspackPlugin) => {
      if (!plugin.options) {
        return undefined;
      }

      const entryName = (plugin.options as Record<symbol, string>)[entryNameSymbol];
      if (!entryName) {
        return undefined;
      }

      return this.getExtraData(entryName);
    };

    compiler.hooks.compilation.tap(this.name, (compilation: Compilation) => {
      const hooks = this.getHTMLPlugin().getCompilationHooks(compilation);

      hooks.alterAssetTagGroups.tapPromise(this.name, async (data) => {
        const extraData = getExtraDataByPlugin(data.plugin);
        if (!extraData) {
          return data;
        }

        const { headTags, bodyTags } = data;
        const {
          favicon,
          faviconDistPath,
          context,
          tagConfig,
          entryName,
          environment,
          templateContent,
        } = extraData;

        if (!hasTitle(templateContent)) {
          addTitleTag(headTags, data.plugin.options?.title);
        }

        if (favicon) {
          await addFavicon({
            headTags,
            favicon,
            faviconDistPath,
            compilation,
            publicPath: data.publicPath,
            logger: context.logger,
          });
        }

        const tags = {
          headTags: headTags.map(formatBasicTag),
          bodyTags: bodyTags.map(formatBasicTag),
        };

        const [modified] = await context.hooks.modifyHTMLTags.callChain({
          environment: environment.name,
          args: [
            tags,
            {
              compiler,
              compilation,
              assetPrefix: data.publicPath,
              filename: data.outputName,
              environment,
            },
          ],
        });

        Object.assign(data, {
          headTags: modified.headTags.map(fromBasicTag),
          bodyTags: modified.bodyTags.map(fromBasicTag),
        });

        if (tagConfig) {
          const hash = compilation.hash ?? '';
          applyTagConfig(data, tagConfig, hash, entryName);
        }

        return data;
      });

      hooks.beforeEmit.tapPromise(this.name, async (data) => {
        const extraData = getExtraDataByPlugin(data.plugin);
        if (!extraData) {
          return data;
        }

        const { context, environment } = extraData;
        const [modified] = await context.hooks.modifyHTML.callChain({
          environment: environment.name,
          args: [
            data.html,
            {
              compiler,
              compilation,
              filename: data.outputName,
              environment,
            },
          ],
        });

        return {
          ...data,
          html: modified,
        };
      });
    });
  }
}
