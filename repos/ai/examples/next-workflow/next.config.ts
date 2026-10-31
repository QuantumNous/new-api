import type { NextConfig } from 'next';
import { withWorkflow } from 'workflow/next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['ajv', '@vercel/oidc'],
};

export default withWorkflow(nextConfig);
