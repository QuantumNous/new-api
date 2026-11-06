import { defineConfig } from '@vercel/geistdocs/config';
import { content, Logo, nav, title, translations, versions } from '@/geistdocs';

export const config = defineConfig({
  title,
  defaultLanguage: 'en',
  logo: <Logo />,
  nav,
  content,
  versions,
  translations,
  github: { owner: 'vercel', repo: 'ai' },
  agent: {
    product: {
      name: 'AI SDK',
      description:
        'The TypeScript toolkit for building AI applications and agents.',
      category: 'Developer tools',
      audience: ['JavaScript and TypeScript developers'],
      useCases: [
        'Generate text and structured data',
        'Build agents and chat interfaces',
        'Integrate language model providers',
      ],
    },
  },
  // Phase 1: Ask AI is disabled (no chat route / AI Gateway wiring yet).
  ai: { enabled: false },
  // Phase 1: no edit-source action. Upstream content still uses `NN-`
  // filename prefixes, so page paths here don't match source paths yet.
  // Enable once the content codemod lands on `main`.
  pageActions: {
    editSource: false,
    askAI: false,
    copyPage: true,
    openInChat: false,
  },
  feedback: { enabled: false },
});
