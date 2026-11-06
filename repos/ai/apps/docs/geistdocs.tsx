import type { GeistdocsConfig } from '@vercel/geistdocs/config';

export const title = 'AI SDK';

export const Logo = () => (
  <span className="font-semibold text-gray-1000">AI SDK</span>
);

export const nav: NonNullable<GeistdocsConfig['nav']> = [
  { label: 'Docs', href: '/docs' },
];

export const content: NonNullable<GeistdocsConfig['content']> = [
  { id: 'v6', label: 'v6', dir: 'content/v6/docs', route: '/docs' },
  {
    id: 'v7',
    label: 'v7',
    dir: 'content/v7/docs',
    route: '/v7/docs',
  },
];

export const versions: NonNullable<GeistdocsConfig['versions']> = {
  current: 'v6',
  items: [
    {
      id: 'v6',
      label: 'v6',
      description: 'v6 documentation',
      routePrefix: '',
    },
    {
      id: 'v7',
      label: 'v7',
      description: 'Latest documentation',
      routePrefix: '/v7',
    },
  ],
};

export const translations = {
  en: { displayName: 'English' },
};
