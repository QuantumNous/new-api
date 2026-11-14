import Link from 'next/link';
import type { ReactNode } from 'react';

type ResolveHref = (href: string) => string;

const templates = [
  {
    title: 'Chatbot Starter',
    description:
      'A production-ready Next.js chatbot with persistence and tools.',
    type: 'starter-kits',
    href: 'https://vercel.com/templates/next.js/nextjs-ai-chatbot',
  },
  {
    title: 'Internal Knowledge Base',
    description: 'A retrieval-augmented generation starter with guardrails.',
    type: 'starter-kits',
    href: 'https://vercel.com/templates/next.js/ai-sdk-internal-knowledge-base',
  },
  {
    title: 'Structured Object Streaming',
    description: 'Stream typed objects into a responsive interface.',
    type: 'feature-exploration',
    href: 'https://vercel.com/templates/next.js/use-object',
  },
  {
    title: 'Multi-Step Tools',
    description: 'Run multiple model and tool steps automatically.',
    type: 'feature-exploration',
    href: 'https://vercel.com/templates/next.js/ai-sdk-roundtrips',
  },
  {
    title: 'Next.js App Router',
    description: 'Build an AI application with the Next.js App Router.',
    type: 'frameworks',
    href: 'https://ai-sdk.dev/docs/getting-started/nextjs-app-router',
  },
  {
    title: 'SvelteKit OpenAI Starter',
    description: 'Use AI SDK with OpenAI and SvelteKit.',
    type: 'frameworks',
    href: 'https://github.com/vercel/ai/tree/main/examples/sveltekit-openai',
  },
  {
    title: 'Gemini Chatbot',
    description: 'A generative chat interface built with Gemini and Next.js.',
    type: 'generative-ui',
    href: 'https://vercel.com/templates/next.js/gemini-ai-chatbot',
  },
  {
    title: 'Generative UI with RSC',
    description: 'Stream React Server Components from model tool calls.',
    type: 'generative-ui',
    href: 'https://vercel.com/templates/next.js/rsc-genui',
  },
  {
    title: 'Bot Protection',
    description: 'Protect an AI application from automated abuse.',
    type: 'security',
    href: 'https://vercel.com/templates/next.js/advanced-ai-bot-protection',
  },
  {
    title: 'Rate Limiting',
    description: 'Add per-user limits to an AI SDK application.',
    type: 'security',
    href: 'https://github.com/vercel/ai/tree/main/examples/next-openai-upstash-rate-limits',
  },
] as const;

const providers = [
  ['AI Gateway', '/providers/ai-sdk-providers/ai-gateway'],
  ['OpenAI', '/providers/ai-sdk-providers/openai'],
  ['Anthropic', '/providers/ai-sdk-providers/anthropic'],
  ['Google', '/providers/ai-sdk-providers/google'],
  ['Amazon Bedrock', '/providers/ai-sdk-providers/amazon-bedrock'],
  ['Azure', '/providers/ai-sdk-providers/azure'],
] as const;

const quickstarts = [
  ['Next.js App Router', '/docs/getting-started/nextjs-app-router'],
  ['Next.js Pages Router', '/docs/getting-started/nextjs-pages-router'],
  ['SvelteKit', '/docs/getting-started/svelte'],
  ['Nuxt', '/docs/getting-started/nuxt'],
  ['Node.js', '/docs/getting-started/nodejs'],
  ['Expo', '/docs/getting-started/expo'],
] as const;

const supportItems = [
  {
    title: 'Report an Issue',
    description: 'Share a reproducible bug report with the maintainers.',
    href: 'https://github.com/vercel/ai/issues/new?template=1.bug_report.yml',
  },
  {
    title: 'Request a Feature',
    description: 'Propose an improvement for the SDK or documentation.',
    href: 'https://github.com/vercel/ai/issues/new?template=2.feature_request.yml',
  },
  {
    title: 'Ask the Community',
    description: 'Browse discussions and ask implementation questions.',
    href: 'https://github.com/vercel/ai/discussions',
  },
  {
    title: 'Migration Guides',
    description: 'Upgrade an application between AI SDK versions.',
    href: '/docs/migration-guides',
  },
] as const;

const CardLink = ({
  description,
  href,
  title,
}: {
  description?: string;
  href: string;
  title: string;
}) => (
  <Link
    className="flex min-w-0 flex-col gap-1 rounded-lg border border-gray-alpha-400 p-4 text-gray-1000 transition-colors hover:border-gray-alpha-600 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-700"
    href={href}
  >
    <span className="font-medium">{title}</span>
    {description ? (
      <span className="text-gray-900 text-sm leading-5">{description}</span>
    ) : null}
  </Link>
);

export const Templates = ({
  type,
}: {
  type: (typeof templates)[number]['type'];
}) => (
  <div className="not-prose grid grid-cols-1 gap-4 sm:grid-cols-2">
    {templates
      .filter(template => template.type === type)
      .map(template => (
        <CardLink key={template.title} {...template} />
      ))}
  </div>
);

export const OfficialModelCards = () => (
  <div className="not-prose grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {providers.map(([title, path]) => (
      <CardLink href={`https://ai-sdk.dev${path}`} key={title} title={title} />
    ))}
  </div>
);

export const QuickstartFrameworkCards = ({
  resolveHref = href => href,
}: {
  resolveHref?: ResolveHref;
}) => (
  <div className="not-prose grid grid-cols-1 gap-4 sm:grid-cols-2">
    {quickstarts.map(([title, href]) => (
      <CardLink href={resolveHref(href)} key={title} title={title} />
    ))}
  </div>
);

export const Support = ({
  resolveHref = href => href,
}: {
  resolveHref?: ResolveHref;
}) => (
  <div className="not-prose grid grid-cols-1 gap-4 sm:grid-cols-2">
    {supportItems.map(item => (
      <CardLink {...item} href={resolveHref(item.href)} key={item.title} />
    ))}
  </div>
);

export const Card = ({
  children,
  description,
  title,
}: {
  children?: ReactNode;
  description?: string;
  title: string;
}) => (
  <section className="not-prose flex h-full flex-col rounded-lg border border-gray-alpha-400 p-5">
    <div className="flex min-h-48 flex-1 items-center justify-center overflow-hidden">
      {children}
    </div>
    <h3 className="mt-3 font-semibold text-gray-1000 text-lg">{title}</h3>
    {description ? (
      <p className="mt-1 text-gray-900 text-sm leading-5">{description}</p>
    ) : null}
  </section>
);
