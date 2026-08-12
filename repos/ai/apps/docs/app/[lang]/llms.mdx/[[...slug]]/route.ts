import { createDocsMarkdownRoute } from '@vercel/geistdocs/routes/llms';
import { v6Source } from '@/lib/geistdocs/source';

const markdownRoute = createDocsMarkdownRoute({ source: v6Source });

export const GET = markdownRoute.GET;
export const generateStaticParams = markdownRoute.generateStaticParams;
export const revalidate = false;
