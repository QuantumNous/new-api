import { createDocsMarkdownRoute } from '@vercel/geistdocs/routes/llms';
import { v7Source } from '@/lib/geistdocs/source';

const markdownRoute = createDocsMarkdownRoute({ source: v7Source });

export const GET = markdownRoute.GET;
export const generateStaticParams = markdownRoute.generateStaticParams;
export const revalidate = false;
