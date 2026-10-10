import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    system: [
      'You have access to an `advisor` tool backed by a stronger reviewer model.',
      'Call advisor BEFORE substantive work and again before declaring done.',
      'The advisor should respond in under 100 words and use enumerated steps,',
      'not explanations.',
    ].join('\n'),
    prompt:
      'Build a concurrent worker pool in Go with graceful shutdown. Outline the design first.',
    tools: {
      advisor: anthropic.tools.advisor_20260301({
        model: 'claude-opus-4-7',
        maxUses: 3,
      }),
    },
  });

  console.dir(result.content, { depth: Infinity });
});
