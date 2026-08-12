import { createLlmsRoute } from '@vercel/geistdocs/routes/llms';
import { v7Source } from '@/lib/geistdocs/source';

const llmsRoute = createLlmsRoute({ source: v7Source });

export const GET = llmsRoute.GET;
export const revalidate = false;
