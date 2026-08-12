import { pluginSass } from '@rsbuild/plugin-sass';
import { defineConfig } from '@rspress/core';
import { pluginAlgolia } from '@rspress/plugin-algolia';
import { pluginClientRedirects } from '@rspress/plugin-client-redirects';
import { pluginRss } from '@rspress/plugin-rss';
import { pluginSitemap } from '@rspress/plugin-sitemap';
import {
  transformerNotationDiff,
  transformerNotationFocus,
  transformerNotationHighlight,
} from '@shikijs/transformers';
import { pluginGoogleAnalytics } from 'rsbuild-plugin-google-analytics';
import { pluginOpenGraph } from 'rsbuild-plugin-open-graph';
import { pluginFontOpenSans } from 'rspress-plugin-font-open-sans';
import { rsbuildPluginOverview } from './theme/rsbuildPluginOverview';

const siteUrl = 'https://rsbuild.rs';
const description = 'The Rspack-based build tool';

export default defineConfig({
  plugins: [
    pluginAlgolia(),
    pluginSitemap({
      siteUrl,
    }),
    pluginFontOpenSans(),
    pluginRss({
      siteUrl,
      feed: [
        {
          id: 'releases-rss',
          test: '/blog/v',
          title: 'Rsbuild Blogs',
          language: 'en',
          output: {
            type: 'rss',
            filename: 'releases-rss.xml',
          },
        },
        {
          id: 'releases-atom',
          test: '/blog/v',
          title: 'Rsbuild Blogs',
          language: 'en',
          output: {
            type: 'atom',
          },
        },
        {
          id: 'releases-rss-zh',
          test: '/zh/blog/v',
          title: 'Rsbuild Blogs',
          language: 'zh-CN',
          output: {
            type: 'rss',
            filename: 'releases-rss-zh.xml',
          },
        },
        {
          id: 'releases-atom-zh',
          test: '/zh/blog/v',
          title: 'Rsbuild Blogs',
          language: 'zh-CN',
          output: {
            type: 'atom',
          },
        },
      ],
    }),
    pluginClientRedirects({
      redirects: [
        {
          from: '/config/source/alias',
          to: '/config/resolve/alias',
        },
        {
          from: '/config/dev/setup-middlewares',
          to: '/config/server/setup',
        },
        {
          from: '/api/javascript-api/dev-server-api',
          to: '/api/javascript-api/server-api',
        },
        {
          from: '/config/source/alias-strategy',
          to: '/config/resolve/alias-strategy',
        },
        {
          from: '/config/performance/chunk-split',
          to: '/config/split-chunks',
        },
        {
          from: '/plugins/list/plugin-assets-retry',
          to: 'https://github.com/rstackjs/rsbuild-plugin-assets-retry',
        },
        {
          from: '/plugins/list/plugin-stylus',
          to: 'https://github.com/rstackjs/rsbuild-plugin-stylus',
        },
        {
          from: '/zh/plugins/list/plugin-stylus',
          to: 'https://github.com/rstackjs/rsbuild-plugin-stylus',
        },
        {
          from: '/guide/basic/css-usage',
          to: '/guide/styling/css-usage',
        },
        {
          from: '/guide/basic/css-modules',
          to: '/guide/styling/css-modules',
        },
        {
          from: '/guide/basic/tailwindcss',
          to: '/guide/styling/tailwindcss',
        },
        {
          from: '/guide/basic/tailwindcss-v3',
          to: '/guide/styling/tailwindcss-v3',
        },
        {
          from: '/guide/basic/unocss',
          to: '/guide/styling/unocss',
        },
        {
          from: '/guide/basic/configure-rspack',
          to: '/guide/configuration/rspack',
        },
        {
          from: '/guide/basic/configure-rsbuild',
          to: '/guide/configuration/rsbuild',
        },
        {
          from: '/guide/basic/configure-swc',
          to: '/guide/configuration/swc',
        },
        {
          from: '/guide/basic/static-deploy',
          to: '/guide/basic/deployment',
        },
        ...['v0-1', 'v0-2', 'v0-3', 'v0-4', 'v0-5', 'v0-6', 'v0-7', 'v1-0', 'v2-0'].map(
          (version) => ({
            from: `/community/releases/${version}`,
            to: `/blog/${version}`,
          }),
        ),
      ],
    }),
  ],
  lang: 'en',
  title: 'Rsbuild',
  description: 'Rsbuild is a high-performance build tool powered by Rspack.',
  icon: 'https://assets.rspack.rs/rsbuild/favicon-128x128.png',
  logo: {
    light: 'https://assets.rspack.rs/rsbuild/navbar-logo-light.png',
    dark: 'https://assets.rspack.rs/rsbuild/navbar-logo-dark.png',
  },
  llms: true,
  markdown: {
    link: {
      checkAnchors: true,
    },
    shiki: {
      langs: ['styl', 'html', 'toml'],
      langAlias: {
        ejs: 'js',
      },
      transformers: [
        transformerNotationDiff(),
        transformerNotationHighlight(),
        transformerNotationFocus(),
      ],
    },
  },
  route: {
    cleanUrls: true,
    // exclude document fragments from routes
    exclude: ['**/zh/shared/**', '**/en/shared/**'],
  },
  themeConfig: {
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/web-infra-dev/rsbuild',
      },
      {
        icon: 'x',
        mode: 'link',
        content: 'https://twitter.com/rspack_dev',
      },
      {
        icon: 'discord',
        mode: 'link',
        content: 'https://discord.gg/XsaKEEk4mW',
      },
      {
        icon: 'bluesky',
        mode: 'link',
        content: 'https://bsky.app/profile/rspack.rs',
      },
    ],
    editLink: {
      docRepoBaseUrl: 'https://github.com/web-infra-dev/rsbuild/tree/main/website/docs',
    },
    locales: [
      {
        lang: 'en',
        label: 'English',
        description,
      },
      {
        lang: 'zh',
        label: '简体中文',
        description: '由 Rspack 驱动的构建工具',
      },
    ],
  },
  head: [
    ({ routePath }) => {
      const getOgImage = () => {
        if (routePath.includes('blog/v1-') || routePath.includes('blog/v2-')) {
          const version = routePath.split('blog/v')[1];
          return `assets/rsbuild-og-image-v${version}.png`;
        }
        return 'rsbuild-og-image.png';
      };
      return `<meta property="og:image" content="https://assets.rspack.rs/rsbuild/${getOgImage()}">`;
    },
  ],
  builderConfig: {
    plugins: [
      rsbuildPluginOverview,
      pluginSass(),
      pluginGoogleAnalytics({ id: 'G-L6BZ6TKW4R' }),
      pluginOpenGraph({
        url: siteUrl,
        description,
        twitter: {
          site: '@rspack_dev',
          card: 'summary_large_image',
        },
      }),
    ],
    server: {
      open: true,
    },
    tools: {
      rspack: {
        experiments: {
          nativeWatcher: true,
        },
      },
    },
    html: {
      tags: [
        // for baidu SEO verification
        {
          tag: 'meta',
          attrs: {
            name: 'baidu-site-verification',
            content: 'codeva-mYbzBtlg6o',
          },
        },
      ],
      appIcon: {
        name: 'Rsbuild',
        icons: [
          {
            src: 'https://assets.rspack.rs/rsbuild/rsbuild-logo-192x192.png',
            size: 192,
          },
          {
            src: 'https://assets.rspack.rs/rsbuild/rsbuild-logo-512x512.png',
            size: 512,
          },
        ],
      },
    },
  },
});
