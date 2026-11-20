import path from 'node:path';
import { lookup } from 'mrmime';
import { color, pick } from '../helpers';
import { addCompilationError, getPublicPathFromCompiler } from '../helpers/compiler';
import { fileExistsByCompilation, readFileAsync } from '../helpers/fs';
import { ensureAssetPrefix, isURL } from '../helpers/url';
import type { AppIconItem, HtmlBasicTag, RsbuildPlugin } from '../types';

type IconExtra = {
  src: string;
  sizes: string;
  mimeType?: string;
} & (
  | { isURL: true }
  | {
      isURL: false;
      absolutePath: string;
      relativePath: string;
    }
);

export const pluginAppIcon = (): RsbuildPlugin => ({
  name: 'rsbuild:appIcon',

  setup(api) {
    const htmlTagsMap = new Map<string, HtmlBasicTag[]>();
    const iconFormatMap = new Map<string, AppIconItem & IconExtra>();

    const formatIcon = (
      icon: AppIconItem,
      distDir: string,
      publicPath: string,
      lookup: (extension: string) => string | undefined,
    ): AppIconItem & IconExtra => {
      const { src, size } = icon;
      const cacheKey = `${distDir}|${publicPath}|${src}`;
      const cached = iconFormatMap.get(cacheKey);

      if (cached) {
        return cached;
      }

      const sizes = `${size}x${size}`;

      if (isURL(src)) {
        const formatted = {
          ...icon,
          src,
          sizes,
          isURL: true as const,
          mimeType: lookup(src),
        };

        iconFormatMap.set(cacheKey, formatted);
        return formatted;
      }

      const absolutePath = path.isAbsolute(src) ? src : path.join(api.context.rootPath, src);
      const relativePath = path.posix.join(distDir, path.basename(absolutePath));

      const formatted = {
        ...icon,
        sizes,
        src: ensureAssetPrefix(relativePath, publicPath),
        isURL: false as const,
        absolutePath,
        relativePath,
        mimeType: lookup(absolutePath),
      };

      iconFormatMap.set(cacheKey, formatted);
      return formatted;
    };

    api.processAssets({ stage: 'additional' }, async ({ compilation, environment, sources }) => {
      const { config } = environment;
      const { appIcon } = config.html;

      if (!appIcon) {
        return;
      }

      const distDir = config.output.distPath.image;
      const manifestFile = appIcon.filename ?? 'manifest.webmanifest';
      const publicPath = getPublicPathFromCompiler(compilation);
      const icons = appIcon.icons.map((icon) => formatIcon(icon, distDir, publicPath, lookup));
      const tags: HtmlBasicTag[] = [];

      for (const icon of icons) {
        if (icon.target === 'web-app-manifest' && !appIcon.name) {
          addCompilationError(
            compilation,
            `${color.dim('[rsbuild:appIcon]')} ${color.yellow(
              '"appIcon.name"',
            )} is required when ${color.yellow('"target"')} is ${color.yellow(
              '"web-app-manifest"',
            )}.`,
          );
          continue;
        }

        if (!icon.isURL) {
          if (!compilation.inputFileSystem) {
            addCompilationError(
              compilation,
              `${color.dim('[rsbuild:appIcon]')} Failed to read the icon file as ${color.yellow(
                '"compilation.inputFileSystem"',
              )} is not available.`,
            );
            continue;
          }

          if (!(await fileExistsByCompilation(compilation, icon.absolutePath))) {
            addCompilationError(
              compilation,
              `${color.dim('[rsbuild:appIcon]')} Failed to find the icon file at ${color.yellow(
                icon.absolutePath,
              )}.`,
            );
            continue;
          }

          const source = await readFileAsync(compilation.inputFileSystem, icon.absolutePath);

          compilation.emitAsset(icon.relativePath, new sources.RawSource(source));
        }

        if (icon.target === 'apple-touch-icon' || (!icon.target && icon.size < 200)) {
          tags.push({
            tag: 'link',
            attrs: {
              rel: 'apple-touch-icon',
              sizes: icon.sizes,
              href: icon.src,
            },
          });
        }
      }

      if (appIcon.name) {
        const manifestIcons = icons
          .filter((icon) => icon.target === 'web-app-manifest' || !icon.target)
          .map((icon) => {
            const result = pick(icon, ['src', 'sizes', 'purpose']);

            if (icon.mimeType) {
              return { ...result, type: icon.mimeType };
            }
            return result;
          });

        const manifest = {
          name: appIcon.name,
          icons: manifestIcons,
        };

        compilation.emitAsset(manifestFile, new sources.RawSource(JSON.stringify(manifest)));

        tags.push({
          tag: 'link',
          attrs: {
            rel: 'manifest',
            href: ensureAssetPrefix(manifestFile, publicPath),
          },
        });
      }

      if (tags.length) {
        htmlTagsMap.set(environment.name, tags);
      }
    });

    api.modifyHTMLTags(({ headTags, bodyTags }, { environment }) => {
      const tags = htmlTagsMap.get(environment.name);
      if (tags) {
        headTags.unshift(...tags);
      }
      return { headTags, bodyTags };
    });

    const clean = () => {
      htmlTagsMap.clear();
      iconFormatMap.clear();
    };

    api.onCloseDevServer(clean);
    api.onCloseBuild(clean);
  },
});
