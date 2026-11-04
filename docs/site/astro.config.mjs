// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import lucode from 'lucode-starlight';
import remarkApiHost from './src/plugins/remark-api-host.mjs';
import rehypeTableScroll from './src/plugins/rehype-table-scroll.mjs';
import remarkBasePath from './src/plugins/remark-base-path.mjs';
import { DOCS_BASE } from './src/site.mjs';

const topicScript = `var b=${JSON.stringify(DOCS_BASE)},p=location.pathname;if(b&&p.indexOf(b+'/')===0)p=p.slice(b.length);if(p.indexOf('/en/')===0)p=p.slice(3);document.documentElement.dataset.currentTopic=p.indexOf('/api/')===0?'api':'guide';`;

export default defineConfig({
	site: process.env.DP_DOCS_SITE,
	base: DOCS_BASE || undefined,
	redirects: { '/': `${DOCS_BASE}/start/intro/`, '/en': `${DOCS_BASE}/en/start/intro/` },
	markdown: {
		remarkPlugins: [remarkApiHost, remarkBasePath],
		rehypePlugins: [rehypeTableScroll],
	},
	integrations: [
		starlight({
			title: { 'zh-CN': 'DeepPattern API 文档', en: 'DeepPattern API Docs' },
			description: '在客户端或程序中调用模型，统一管理密钥、用量和费用。',
			logo: { src: './src/assets/logo.svg', alt: 'DeepPattern API' },
			favicon: '/logo.svg',
			defaultLocale: 'root',
			locales: {
				root: { label: '简体中文', lang: 'zh-CN' },
				en: { label: 'English', lang: 'en' },
			},
			head: [{ tag: 'script', content: topicScript }],
			customCss: [
				'@fontsource-variable/public-sans/index.css',
				'@fontsource-variable/jetbrains-mono/index.css',
				'./src/styles/custom.css',
			],
			components: {
				Header: './src/components/Header.astro',
				PageFrame: './src/components/PageFrame.astro',
				TwoColumnContent: './src/components/TwoColumnContent.astro',
				PageTitle: './src/components/PageTitle.astro',
			},
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
			sidebar: [
				{
					label: '快速开始',
					translations: { en: 'Get started' },
					items: ['start/intro', 'start/redeem', 'start/api-key', 'start/quickstart', 'start/models'],
				},
				{
					label: '客户端配置',
					translations: { en: 'Clients' },
					items: [
						'clients/downloads',
						'clients/cc-switch',
						'clients/claude-code',
						'clients/codex',
						'clients/chatgpt-codex',
						'clients/opencode',
						'clients/cursor-cline',
						'clients/cherry-studio',
						'clients/workbuddy',
						'clients/sdk',
					],
				},
				{
					label: '使用指南',
					translations: { en: 'Guides' },
					items: ['guides/streaming', 'guides/rate-limit', 'guides/billing', 'guides/faq'],
				},
			],
			plugins: [
				lucode({ warnOverrides: false }),
			],
		}),
	],
});
