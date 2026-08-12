import { createSearchRoute } from '@vercel/geistdocs/routes/search';
import { config } from '@/lib/geistdocs/config';
import { v6Source, v7Source } from '@/lib/geistdocs/source';

const v6Search = createSearchRoute({ config, source: v6Source });
const v7Search = createSearchRoute({ config, source: v7Source });

export const GET = async (request: Request) => {
  const referer = request.headers.get('referer');
  let isV7 = false;
  if (referer) {
    try {
      isV7 = new URL(referer).pathname.startsWith('/v7/');
    } catch {
      // Invalid or synthetic Referer headers fall back to v6 docs search.
    }
  }
  const response = await (isV7 ? v7Search : v6Search)(request);
  response.headers.append('Vary', 'Referer');
  return response;
};
