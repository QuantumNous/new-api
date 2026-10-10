import { createProxy } from '@vercel/geistdocs/proxy';
import { config as geistdocsConfig } from '@/lib/geistdocs/config';

const proxy = createProxy({
  config: geistdocsConfig,
  markdownRoutes: [
    { from: '/docs/*path', to: '/[lang]/llms.mdx/*path' },
    { from: '/v7/docs/*path', to: '/[lang]/v7/llms.mdx/*path' },
  ],
});

export const config = {
  matcher: [
    '/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|icon.svg|images(?:/|$)|sitemap.xml|robots.txt).*)',
  ],
};

export default proxy;
