import { createApiReference } from '@scalar/api-reference';
import { t, withBase, type Lang } from '../i18n';

type Label = string | Record<string, string>;
type OpenApiDocument = {
	info?: { title?: string; description?: string; [key: string]: unknown };
	paths?: Record<string, Record<string, unknown>>;
	'x-providerModels'?: unknown;
	[key: string]: unknown;
};
type Operation = { id: string; label: Label; document: OpenApiDocument };
type Provider = { id: string; label: Label; operations: Operation[] };
type Group = { id: string; label: Label; providers: Provider[] };
type Catalog = { groups: Group[] };
type Entry = { group: Group; provider: Provider; operation: Operation };

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];

const root = document.querySelector<HTMLElement>('.provider-reference');
const sidebar = root?.querySelector<HTMLElement>('[data-provider-sidebar]');
const nav = root?.querySelector<HTMLElement>('[data-provider-nav]');
const search = root?.querySelector<HTMLInputElement>('[data-provider-search]');
const status = root?.querySelector<HTMLElement>('[data-provider-status]');
const menuToggle = root?.querySelector<HTMLButtonElement>('[data-provider-menu-toggle]');

if (!root || !sidebar || !nav || !search || !status || !menuToggle) {
	throw new Error('Provider API reference mount is incomplete.');
}

const lang: Lang = root.dataset.lang === 'en' ? 'en' : 'zh';
const strings = t(lang);
const text = (label: Label) => (typeof label === 'string' ? label : (label[lang] ?? label.en ?? label.zh ?? ''));
const isSafeId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id);
const slugify = (value: string) =>
	value
		.toLowerCase()
		.replace(/[^\x00-\x7f]/gu, (char) => `u${char.codePointAt(0)!.toString(16)}`)
		.replace(/[^a-z0-9_-]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'section';
const escapeHtml = (value: string) =>
	value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const entryKey = ({ group, provider, operation }: Entry) => `${group.id}/${provider.id}/${operation.id}`;

const endpointOf = (operation: Operation) => {
	const paths = operation.document.paths ?? {};
	const path = Object.keys(paths)[0] ?? '';
	const method = Object.keys(paths[path] ?? {}).find((key) => HTTP_METHODS.includes(key.toLowerCase())) ?? '';
	return { path, method: method.toUpperCase() };
};

const isDark = () => document.documentElement.dataset.theme === 'dark';

const baseConfig = {
	theme: 'default',
	layout: 'modern',
	showSidebar: false,
	localization: { locale: lang === 'en' ? 'en' : 'zh-CN' },
	searchHotKey: 'j',
	defaultOpenAllTags: true,
	defaultOpenFirstTag: true,
	hideModels: true,
	defaultHttpClient: { targetKey: 'shell', clientKey: 'curl' },
	hideDarkModeToggle: true,
	hideClientButton: true,
	hideTestRequestButton: true,
	showDeveloperTools: 'never',
	withDefaultFonts: false,
	persistAuth: false,
	telemetry: false,
	agent: { disabled: true },
	mcp: { disabled: true },
	generateHeadingSlug: ({ slug }: { slug?: string }) => (slug ? `description/${slugify(slug)}` : ''),
	generateTagSlug: ({ name }: { name?: string }) => slugify(name ?? 'default'),
	generateOperationSlug: ({ operationId, method, path }: { operationId?: string; method: string; path: string }) =>
		slugify(operationId ?? `${method}${path}`),
	onLoaded: () => {
		if (activeKey) history.replaceState(null, '', `#${activeKey}`);
	},
};

let catalog: Catalog = { groups: [] };
let activeKey = '';
let activeDocument: OpenApiDocument | undefined;
let reference: ReturnType<typeof createApiReference> | undefined;

const entries = (): Entry[] =>
	catalog.groups.flatMap((group) =>
		group.providers.flatMap((provider) => provider.operations.map((operation) => ({ group, provider, operation }))),
	);
const findEntry = (key: string) => entries().find((entry) => entryKey(entry) === key);
const entryForHash = (hash: string) =>
	findEntry(hash) ?? entries().find((entry) => hash.startsWith(`${entryKey(entry)}/`));

const scalarConfig = () => ({
	...baseConfig,
	content: activeDocument,
	darkMode: isDark(),
	forceDarkModeState: isDark() ? 'dark' : 'light',
});

const renderNav = () => {
	const openProviders = new Set(
		[...nav.querySelectorAll<HTMLDetailsElement>('details[data-provider-key][open]')].map(
			(details) => details.dataset.providerKey,
		),
	);
	const query = search.value.trim().toLocaleLowerCase();
	const matches = (...labels: string[]) => !query || labels.join(' ').toLocaleLowerCase().includes(query);

	nav.innerHTML = catalog.groups
		.map((group) => {
			const providers = group.providers
				.map((provider) => ({
					provider,
					operations: provider.operations.filter((operation) =>
						matches(text(group.label), text(provider.label), text(operation.label)),
					),
				}))
				.filter(({ operations }) => operations.length > 0);
			if (!providers.length) return '';

			const providerHtml = providers
				.map(({ provider, operations }) => {
					const providerKey = `${group.id}/${provider.id}`;
					const open = query || activeKey.startsWith(`${providerKey}/`) || openProviders.has(providerKey);
					const operationHtml = operations
						.map((operation) => {
							const key = `${providerKey}/${operation.id}`;
							const active = key === activeKey;
							const { path, method } = endpointOf(operation);
							return `<a class="provider-nav-operation${active ? ' is-active' : ''}" href="#${key}"${active ? ' aria-current="page"' : ''}>
								<span>${escapeHtml(text(operation.label))}</span>
								<span class="provider-nav-meta"><code class="provider-nav-method">${escapeHtml(method)}</code><code>${escapeHtml(path)}</code></span>
							</a>`;
						})
						.join('');
					return `<details ${open ? 'open' : ''} class="provider-nav-provider" data-provider-key="${providerKey}">
						<summary><svg class="provider-nav-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>${escapeHtml(text(provider.label))}</summary>
						<div class="provider-nav-operations">${operationHtml}</div>
					</details>`;
				})
				.join('');
			return `<section class="provider-nav-group"><h2>${escapeHtml(text(group.label))}</h2>${providerHtml}</section>`;
		})
		.join('');
};

const setMenuOpen = (open: boolean) => {
	sidebar.classList.toggle('is-open', open);
	menuToggle.setAttribute('aria-expanded', String(open));
};

const documentFor = ({ provider, operation }: Entry): OpenApiDocument => {
	const info = operation.document.info ?? {};
	const models = operation.document['x-providerModels'];
	const modelList = Array.isArray(models) ? models.filter((model): model is string => typeof model === 'string') : [];
	const description = modelList.length
		? `**${strings.models}**\n\n${modelList.map((model) => `- \`${model}\``).join('\n')}\n\n${strings.modelsNote}`
		: info.description;
	return { ...operation.document, info: { ...info, title: `${text(provider.label)} · ${text(operation.label)}`, description } };
};

const select = (entry: Entry, replace: boolean) => {
	activeKey = entryKey(entry);
	activeDocument = documentFor(entry);
	const hash = `#${activeKey}`;
	if (location.hash !== hash) {
		if (replace) history.replaceState(null, '', hash);
		else history.pushState(null, '', hash);
	}
	renderNav();
	setMenuOpen(false);
	status.hidden = true;
	if (reference) reference.updateConfiguration(scalarConfig());
	else reference = createApiReference('#api-reference', scalarConfig());
};

const validateCatalog = (raw: unknown): Catalog => {
	const groups = (raw as Catalog | undefined)?.groups;
	if (!Array.isArray(groups)) throw new Error('Catalog has no groups.');
	for (const group of groups) {
		if (!isSafeId(group.id) || !Array.isArray(group.providers) || !group.providers.length) {
			throw new Error(`Catalog group "${String(group.id)}" is invalid.`);
		}
		for (const provider of group.providers) {
			if (!isSafeId(provider.id) || !Array.isArray(provider.operations) || !provider.operations.length) {
				throw new Error(`Catalog provider "${String(provider.id)}" is invalid.`);
			}
			for (const operation of provider.operations) {
				if (!isSafeId(operation.id) || !operation.document) {
					throw new Error(`Catalog operation "${String(operation.id)}" is invalid.`);
				}
			}
		}
	}
	return { groups };
};

search.addEventListener('input', renderNav);
nav.addEventListener('click', (event) => {
	const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
	if (!link) return;
	event.preventDefault();
	const entry = findEntry(link.hash.slice(1));
	if (entry) select(entry, false);
});
menuToggle.addEventListener('click', () => setMenuOpen(!sidebar.classList.contains('is-open')));
document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape' && sidebar.classList.contains('is-open')) {
		setMenuOpen(false);
		menuToggle.focus();
	}
});
document.addEventListener('click', (event) => {
	const target = event.target as Node;
	if (window.innerWidth <= 767 && !sidebar.contains(target) && !menuToggle.contains(target)) setMenuOpen(false);
});

const syncFromHash = () => {
	const entry = entryForHash(location.hash.slice(1));
	if (entry) {
		if (entryKey(entry) !== activeKey) select(entry, true);
	} else if (activeKey) history.replaceState(null, '', `#${activeKey}`);
};
window.addEventListener('hashchange', syncFromHash);
window.addEventListener('popstate', syncFromHash);

const syncTheme = () => {
	document.body.classList.toggle('dark-mode', isDark());
	document.body.classList.toggle('light-mode', !isDark());
	if (reference && activeDocument) reference.updateConfiguration(scalarConfig());
};
syncTheme();
new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

fetch(withBase(lang === 'en' ? '/openapi/provider-reference.en.json' : '/openapi/provider-reference.json'))
	.then((response) => {
		if (!response.ok) throw new Error(`Catalog request failed (${response.status}).`);
		return response.json();
	})
	.then((raw) => {
		catalog = validateCatalog(raw);
		const entry = entryForHash(location.hash.slice(1)) ?? entries()[0];
		if (!entry) throw new Error('API catalog has no operations.');
		select(entry, true);
	})
	.catch((error) => {
		console.error(error);
		status.hidden = false;
		status.textContent = strings.apiUnavailable;
	});
