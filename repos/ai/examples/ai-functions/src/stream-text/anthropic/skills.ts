import {
  anthropic,
  type AnthropicLanguageModelOptions,
  type AnthropicMessageMetadata,
} from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { print } from '../../lib/print';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    tools: {
      code_execution: anthropic.tools.codeExecution_20250825(),
    },
    prompt:
      'Create a presentation about renewable energy sources with 4 slides. ' +
      'Include: 1) Title slide, 2) Solar power, 3) Wind energy, 4) Conclusion.',
    providerOptions: {
      anthropic: {
        container: {
          skills: [{ type: 'anthropic', skillId: 'pptx' }],
        },
      } satisfies AnthropicLanguageModelOptions,
    },
  });

  await printFullStream({ result });

  const anthropicContainer = (
    (await result.finalStep).providerMetadata
      ?.anthropic as unknown as AnthropicMessageMetadata
  )?.container;

  print('container', anthropicContainer);
});
