import { createAgentsRoute } from '@vercel/geistdocs/routes/agents';
import { config } from '@/lib/geistdocs/config';

const agentsRoute = createAgentsRoute({ config });

export const GET = agentsRoute.GET;
export const generateStaticParams = agentsRoute.generateStaticParams;
export const revalidate = false;
