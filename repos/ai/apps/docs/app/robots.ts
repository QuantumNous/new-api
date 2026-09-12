import type { MetadataRoute } from 'next';

const PRODUCTION_DOMAIN = 'ai-sdk.dev';

export default function robots(): MetadataRoute.Robots {
  const isProduction =
    process.env.VERCEL_ENV === 'production' &&
    process.env.VERCEL_PROJECT_PRODUCTION_URL === PRODUCTION_DOMAIN;

  if (!isProduction) {
    return {
      rules: { userAgent: '*', disallow: '/' },
    };
  }

  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `https://${PRODUCTION_DOMAIN}/sitemap.xml`,
  };
}
