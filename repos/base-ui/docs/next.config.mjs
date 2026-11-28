// @ts-check
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';
import { withDeploymentConfig } from '@mui/internal-docs-infra/withDocsInfra';
import nextMdx from '@next/mdx';
import { ordering } from 'docs/src/utils/typeOrder.mjs';

const currentDirectory = url.fileURLToPath(new URL('.', import.meta.url));
const workspaceRoot = path.resolve(currentDirectory, '../');
const baseDir = path.dirname(url.fileURLToPath(import.meta.url));

/**
 * @param {string} relativePath
 * @returns {string}
 */
const localPlugin = (relativePath) => path.join(baseDir, relativePath);

const withMdx = nextMdx({
  options: {
    remarkPlugins: [
      'remark-gfm',
      [
        '@mui/internal-docs-infra/pipeline/transformMarkdownMetadata',
        {
          titleSuffix: ' · Base UI',
          extractToIndex: {
            include: ['src/app/react'],
            exclude: [
              'src/app/careers',
              'src/app/production-error',
              'src/app/test',
              'src/app/experiments',
              'src/app/playground',
            ],
            baseDir,
            useVisibleDescription: true,
          },
        },
      ],
      'remark-typography',
      localPlugin('src/components/QuickNav/remarkQuickNavExcludeHeading.mjs'),
      '@mui/internal-docs-infra/pipeline/transformMarkdownRelativePaths',
      '@mui/internal-docs-infra/pipeline/transformMarkdownCode',
    ],
    rehypePlugins: [
      '@mui/internal-docs-infra/pipeline/transformHtmlCodeBlock',
      localPlugin('src/components/CodeBlock/rehypeEagerCodeBlocks.mjs'),
      '@mui/internal-docs-infra/pipeline/transformHtmlCodeInline',
      '@mui/internal-docs-infra/pipeline/enhanceCodeInline',
      localPlugin('src/components/QuickNav/rehypeSlug.mjs'),
      localPlugin('src/components/QuickNav/rehypeConcatHeadings.mjs'),
      '@stefanprobst/rehype-extract-toc',
      localPlugin('src/components/QuickNav/rehypeQuickNav.mjs'),
      localPlugin('src/components/Subtitle/rehypeSubtitle.mjs'),
      localPlugin('src/components/Kbd/rehypeKbd.mjs'),
    ],
  },
});

/**
 * @returns {{version: string}}
 */
function loadPackageJson() {
  const pkgContent = fs.readFileSync(path.resolve(workspaceRoot, 'package.json'), 'utf8');
  return JSON.parse(pkgContent);
}

const rootPackage = loadPackageJson();

/** @type {import('@mui/internal-docs-infra/pipeline/loadPrecomputedTypes').LoaderOptions} */
const typesGenerationOptions = {
  socketDir: '.next/docs-infra',
  updateParentIndex: {
    baseDir,
    onlyUpdateIndexes: true,
  },
  ordering,
  descriptionReplacements: [
    { pattern: '\\n\\nDocumentation: .*$', replacement: '', flags: 'm' },
    { pattern: 'Base UI', replacement: 'Base UI', flags: 'g' },
  ],
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: false,
  pageExtensions: ['mdx', 'tsx'],
  turbopack: {
    rules: {
      './src/app/**/types.ts': {
        as: '*.ts',
        loaders: [
          {
            loader: '@mui/internal-docs-infra/pipeline/loadPrecomputedTypes',
            options: typesGenerationOptions,
          },
        ],
      },
      './src/app/sitemap/index.ts': {
        as: '*.ts',
        loaders: ['@mui/internal-docs-infra/pipeline/loadPrecomputedSitemap'],
      },
      './src/app/**/demos/*/index.ts': {
        as: '*.ts',
        loaders: [
          {
            loader: '@mui/internal-docs-infra/pipeline/loadPrecomputedCodeHighlighter',
            options: { emphasisOptions: { focusFramesMaxSize: 6 } },
          },
        ],
      },
      './src/demo-data/*/index.ts': {
        as: '*.ts',
        loaders: ['@mui/internal-docs-infra/pipeline/loadPrecomputedCodeHighlighter'],
      },
    },
  },
  webpack: (config, { defaultLoaders }) => {
    // for production builds
    config.module.rules.push({
      test: /[/\\\\]src[/\\\\]app[/\\\\].*[/\\\\]types\.ts$/,
      use: [
        defaultLoaders.babel,
        {
          loader: '@mui/internal-docs-infra/pipeline/loadPrecomputedTypes',
          options: typesGenerationOptions,
        },
      ],
    });
    config.module.rules.push({
      test: /[/\\\\]sitemap[/\\\\]index\.ts$/,
      use: [defaultLoaders.babel, '@mui/internal-docs-infra/pipeline/loadPrecomputedSitemap'],
    });
    config.module.rules.push({
      test: /[/\\\\]demos[/\\\\][^/\\\\]+[/\\\\]index\.ts$/,
      use: [
        defaultLoaders.babel,
        {
          loader: '@mui/internal-docs-infra/pipeline/loadPrecomputedCodeHighlighter',
          options: { emphasisOptions: { focusFramesMaxSize: 6 } },
        },
      ],
    });
    config.module.rules.push({
      test: /[/\\\\]src[/\\\\]demo-data[/\\\\][^/\\\\]+[/\\\\]index\.ts$/,
      use: [
        defaultLoaders.babel,
        '@mui/internal-docs-infra/pipeline/loadPrecomputedCodeHighlighter',
      ],
    });

    return config;
  },
  env: {
    // docs-infra
    LIB_VERSION: rootPackage.version,
    SOURCE_CODE_REPO: 'https://github.com/mui/base-ui',
    BASE_URL: 'https://base-ui.com',
  },
  ...(process.env.NODE_ENV === 'production' && { distDir: 'export', output: 'export' }),
  devIndicators: false,
  experimental: {
    globalNotFound: true,
    turbopackFileSystemCacheForBuild: true,
  },
};

const mergedConfig = withMdx(withDeploymentConfig(nextConfig));

if (!process.env.CI) {
  delete mergedConfig.experimental?.cpus;
}

export default mergedConfig;
