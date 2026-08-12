import { createMDX } from 'fumadocs-mdx/next';
import type { NextConfig } from 'next';

const withMDX = createMDX();

const config: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: 'e742qlubrjnjqpp0.public.blob.vercel-storage.com',
        protocol: 'https',
      },
    ],
  },
  redirects: () => [
    {
      source: '/docs',
      destination: '/docs/introduction',
      permanent: false,
    },
    {
      source: '/v7/docs',
      destination: '/v7/docs/introduction',
      permanent: false,
    },
    {
      source: '/docs/ai-sdk-core/prompts',
      destination: '/docs/foundations/prompts',
      permanent: true,
    },
    {
      source: '/docs/ai-sdk-core/prompts.md',
      destination: '/docs/foundations/prompts.md',
      permanent: true,
    },
    {
      source: '/v7/docs/ai-sdk-core/prompts',
      destination: '/v7/docs/foundations/prompts',
      permanent: true,
    },
    {
      source: '/v7/docs/ai-sdk-core/prompts.md',
      destination: '/v7/docs/foundations/prompts.md',
      permanent: true,
    },
    {
      source: '/docs/reference/ai-sdk-core/validate-json-rpc-message',
      destination: '/docs/reference/ai-sdk-core/create-mcp-client',
      permanent: false,
    },
    {
      source: '/docs/reference/ai-sdk-core/validate-json-rpc-message.md',
      destination: '/docs/reference/ai-sdk-core/create-mcp-client.md',
      permanent: false,
    },
    {
      source: '/v7/docs/reference/ai-sdk-core/validate-json-rpc-message',
      destination: '/v7/docs/reference/ai-sdk-core/create-mcp-client',
      permanent: false,
    },
    {
      source: '/v7/docs/reference/ai-sdk-core/validate-json-rpc-message.md',
      destination: '/v7/docs/reference/ai-sdk-core/create-mcp-client.md',
      permanent: false,
    },
  ],
};

export default withMDX(config);
