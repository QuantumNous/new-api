import type { MetadataRoute } from 'next';
import { v6Source } from '@/lib/geistdocs/source';

const SITE_URL = 'https://ai-sdk.dev';

export const revalidate = false;

export default function sitemap(): MetadataRoute.Sitemap {
  return v6Source.source.getPages('en').map(page => ({
    changeFrequency: 'weekly',
    priority: page.url === '/docs/introduction' ? 1 : 0.5,
    url: new URL(page.url, SITE_URL).toString(),
  }));
}
