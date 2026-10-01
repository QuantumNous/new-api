'use client';

import { useState } from 'react';

const providers = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    import: "import { anthropic } from '@ai-sdk/anthropic';",
    model: "anthropic('claude-sonnet-4-5')",
  },
  {
    id: 'openai',
    label: 'OpenAI',
    import: "import { openai } from '@ai-sdk/openai';",
    model: "openai('gpt-5.1')",
  },
  {
    id: 'google',
    label: 'Google',
    import: "import { google } from '@ai-sdk/google';",
    model: "google('gemini-2.5-flash')",
  },
] as const;

export const PreviewSwitchProviders = () => {
  const [providerId, setProviderId] =
    useState<(typeof providers)[number]['id']>('anthropic');
  const provider =
    providers.find(candidate => candidate.id === providerId) ?? providers[0];

  return (
    <div className="not-prose my-6 overflow-hidden rounded-lg border border-gray-alpha-400">
      <div className="flex items-center justify-between gap-4 border-gray-alpha-400 border-b bg-gray-100 px-4 py-3">
        <span className="font-medium text-gray-1000 text-sm">Provider</span>
        <select
          aria-label="Language model provider"
          className="rounded-md border border-gray-alpha-400 bg-background-100 px-3 py-1.5 text-gray-1000 text-sm"
          onChange={event =>
            setProviderId(
              event.target.value as (typeof providers)[number]['id'],
            )
          }
          value={providerId}
        >
          {providers.map(candidate => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.label}
            </option>
          ))}
        </select>
      </div>
      <pre className="overflow-x-auto bg-background-100 p-4 font-mono text-[13px] leading-6 text-gray-1000">
        <code>{`import { generateText } from 'ai';
${provider.import}

const { text } = await generateText({
  model: ${provider.model},
  prompt: 'What is love?',
});`}</code>
      </pre>
      <div className="border-gray-alpha-400 border-t p-4 text-gray-900 text-sm leading-6">
        Love is a deep connection built through care, trust, and shared
        experience.
      </div>
    </div>
  );
};
