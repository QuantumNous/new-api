import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: anthropic('claude-sonnet-4-5-20250514'),
    messages: [
      {
        role: 'user',
        content:
          'I have a very long document. ' +
          'Can you help me understand the key concepts? ' +
          '(Imagine this is a 50k+ token conversation.)',
      },
      {
        role: 'assistant',
        content: 'Of course! I can help you understand the key concepts.',
      },
      {
        role: 'user',
        content: 'Summarize the main takeaways.',
      },
    ],
    providerOptions: {
      anthropic: {
        contextManagement: {
          edits: [
            {
              type: 'compact_20260112',
              trigger: { type: 'input_tokens', value: 50000 },
              instructions: 'Preserve all key facts and decisions.',
            },
          ],
        },
      } satisfies AnthropicLanguageModelOptions,
    },
  });

  for await (const part of result.stream) {
    switch (part.type) {
      case 'text-start': {
        const isCompaction =
          part.providerMetadata?.anthropic?.type === 'compaction';
        if (isCompaction) {
          console.log('[compaction summary]');
        } else {
          console.log('[response]');
        }
        break;
      }

      case 'text-delta': {
        process.stdout.write(part.text);
        break;
      }

      case 'text-end': {
        console.log();
        break;
      }

      case 'finish': {
        console.log('\n--- Finish ---');
        console.log('Reason:', part.finishReason);
        break;
      }
    }
  }

  const metadata = (await result.finalStep).providerMetadata?.anthropic;
  const iterations = metadata?.iterations as
    | Array<{
        type: string;
        inputTokens: number;
        outputTokens: number;
      }>
    | undefined;
  if (iterations) {
    console.log('\nIterations:');
    for (const iteration of iterations) {
      console.log(
        `  ${iteration.type}: ${iteration.inputTokens} input, ${iteration.outputTokens} output`,
      );
    }
  }

  const contextManagement = metadata?.contextManagement as {
    appliedEdits: Array<{ type: string }>;
  } | null;
  if (contextManagement?.appliedEdits?.length) {
    console.log('\nApplied edits:');
    for (const edit of contextManagement.appliedEdits) {
      console.log(`  type: ${edit.type}`);
    }
  }
});
