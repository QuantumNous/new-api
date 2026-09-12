import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
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

  for await (const chunk of result.stream) {
    switch (chunk.type) {
      case 'text-delta': {
        process.stdout.write(chunk.text);
        break;
      }

      case 'tool-call': {
        if (chunk.toolName === 'advisor') {
          process.stdout.write(
            `\n\x1b[33m[advisor call — executor is pausing for sub-inference]\x1b[0m\n`,
          );
        } else {
          console.log(
            `\x1b[32m\x1b[1mTool call:\x1b[22m ${JSON.stringify(chunk, null, 2)}\x1b[0m`,
          );
        }
        break;
      }

      case 'tool-result': {
        if (chunk.toolName === 'advisor') {
          process.stdout.write(
            `\n\x1b[32m\x1b[1m[advisor result]\x1b[0m ${JSON.stringify(chunk.output, null, 2)}\n`,
          );
        } else {
          console.log(
            `\x1b[32m\x1b[1mTool result:\x1b[22m ${JSON.stringify(chunk, null, 2)}\x1b[0m`,
          );
        }
        break;
      }

      case 'finish-step': {
        const iterations = (
          chunk.providerMetadata?.anthropic as Record<string, unknown>
        )?.iterations;
        if (iterations) {
          console.log('\n\x1b[36m--- Usage iterations ---\x1b[0m');
          console.dir(iterations, { depth: Infinity });
        }
        break;
      }

      case 'error':
        console.error('Error:', chunk.error);
        break;
    }
  }
});
