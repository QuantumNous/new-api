import { createVersionedSources } from '@vercel/geistdocs/source';
import { docsV6, docsV7 } from '@/.source/server';
import { config } from './config';

export const versions = createVersionedSources({
  config,
  current: 'v6',
  versions: [
    {
      id: 'v6',
      label: 'v6',
      docs: docsV6,
      baseUrl: '/docs',
      routePrefix: '',
    },
    {
      id: 'v7',
      label: 'v7',
      docs: docsV7,
      baseUrl: '/v7/docs',
      routePrefix: '/v7',
    },
  ],
});

export const v6Source = versions.byId.v6;
export const v7Source = versions.byId.v7;
export const sources = versions.all.map(version => version.source);
