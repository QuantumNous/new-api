export type Lang = 'zh' | 'en';

const docsBase = import.meta.env.BASE_URL.replace(/\/+$/, '');

export const withBase = (path: string) => docsBase + path;

const stripBase = (pathname: string) =>
	docsBase && (pathname === docsBase || pathname.startsWith(`${docsBase}/`)) ? pathname.slice(docsBase.length) || '/' : pathname;

export const langOf = (pathname: string): Lang => (/^\/en(\/|$)/.test(stripBase(pathname)) ? 'en' : 'zh');

export const stripLocale = (pathname: string) => stripBase(pathname).replace(/^\/en(?=\/|$)/, '') || '/';

export const localePath = (lang: Lang, pathname: string) => {
	const path = stripLocale(pathname);
	return withBase(lang === 'en' ? `/en${path}` : path);
};

export const isApiPath = (pathname: string) => stripLocale(pathname).startsWith('/api/');

export const languages: { lang: Lang; tag: string; label: string }[] = [
	{ lang: 'zh', tag: 'zh-CN', label: '简体中文' },
	{ lang: 'en', tag: 'en', label: 'English' },
];

const strings = {
	zh: {
		guide: '指南',
		apiReference: 'API 参考',
		console: '控制台',
		mainNav: '主要',
		cancel: '取消',
		chooseLanguage: '选择语言',
		apiNav: 'API 导航',
		apiSearch: '搜索厂商或操作',
		apiLoading: '正在加载 API 目录…',
		apiNoscriptBefore: '请启用 JavaScript 查看交互式接口文档，或下载 ',
		apiNoscriptLink: 'OpenAPI 定义',
		apiNoscriptAfter: '。',
		apiDescription: 'DeepPattern API 模型接口：请求示例、响应结构和多语言代码示例。',
		apiUnavailable: 'API 目录暂时不可用。',
		models: '模型列表',
		modelsNote: '账号实际可用模型以 GET /v1/models 返回为准。',
	},
	en: {
		guide: 'Guide',
		apiReference: 'API Reference',
		console: 'Console',
		mainNav: 'Main',
		cancel: 'Cancel',
		chooseLanguage: 'Choose language',
		apiNav: 'API navigation',
		apiSearch: 'Search providers or operations',
		apiLoading: 'Loading API catalog…',
		apiNoscriptBefore: 'Enable JavaScript to view the interactive API reference, or download the ',
		apiNoscriptLink: 'OpenAPI definition',
		apiNoscriptAfter: '.',
		apiDescription: 'DeepPattern API model reference with request examples and response schemas.',
		apiUnavailable: 'The API catalog is temporarily unavailable.',
		models: 'Models',
		modelsNote: 'Available models depend on your account: GET /v1/models.',
	},
} as const;

export const t = (lang: Lang) => strings[lang];
