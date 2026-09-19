import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { run } from '../../lib/run';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const documentCorpus = readFileSync(
  join(__dirname, '../../data/compaction-data.txt'),
  'utf-8',
);

const largeDocumentCorpus = Array.from(
  { length: 5 },
  (_, i) => `=== REFERENCE DOCUMENT COPY ${i + 1} ===\n${documentCorpus}`,
).join('\n\n');

run(async () => {
  const result = await generateText({
    model: anthropic('claude-opus-4-6'),
    messages: [
      {
        role: 'user',
        content: `Here is a comprehensive reference guide:\n\n${largeDocumentCorpus}\n\nBased on this documentation, explain the key differences between React and Vue.js state management.`,
      },
      {
        role: 'assistant',
        content:
          'React uses hooks (useState, useReducer) and Context API for state management, while Vue uses the Composition API (ref, reactive, computed) and Pinia. React follows a more explicit, functional approach whereas Vue provides a more integrated reactive system.',
      },
      {
        role: 'user',
        content: 'Now briefly explain Docker vs Kubernetes.',
      },
    ],
    providerOptions: {
      anthropic: {
        contextManagement: {
          edits: [
            {
              type: 'compact_20260112',
              trigger: {
                type: 'input_tokens',
                value: 50000,
              },
              instructions:
                'Summarize the conversation concisely, preserving key topics discussed.',
            },
          ],
        },
      } satisfies AnthropicLanguageModelOptions,
    },
  });

  console.log('Text:', result.text);

  const metadata = result.finalStep.providerMetadata?.anthropic;
  if (metadata?.iterations) {
    console.log('\nIterations:');
    for (const iteration of metadata.iterations as Array<{
      type: string;
      inputTokens: number;
      outputTokens: number;
    }>) {
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
