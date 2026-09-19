import { createLlmsRoute } from '@vercel/geistdocs/routes/llms';
import { v6Source } from '@/lib/geistdocs/source';

const llmsRoute = createLlmsRoute({ source: v6Source });

export const GET = llmsRoute.GET;
export const revalidate = false;
