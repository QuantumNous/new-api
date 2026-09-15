import {
  openai,
  type OpenAILanguageModelResponsesOptions,
  type OpenaiResponsesProviderMetadata,
} from '@ai-sdk/openai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const firstResult = streamText({
    model: openai.responses('gpt-5.6'),
    reasoning: 'low',
    prompt: `Create a three-step launch plan for a new API.
The launch must remain reversible and cannot interrupt existing clients.`,
    providerOptions: {
      openai: {
        reasoningContext: 'all_turns',
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  });

  console.log('First response:');
  for await (const textDelta of firstResult.textStream) {
    process.stdout.write(textDelta);
  }
  console.log();

  const firstMetadata = (await firstResult.finalStep).providerMetadata as
    | OpenaiResponsesProviderMetadata
    | undefined;
  const previousResponseId = firstMetadata?.openai.responseId;

  if (!previousResponseId) {
    throw new Error('OpenAI did not return a response ID.');
  }

  console.log(
    'Effective reasoning context:',
    firstMetadata.openai.reasoningContext,
  );
  console.log();

  const secondResult = streamText({
    model: openai.responses('gpt-5.6'),
    reasoning: 'low',
    prompt:
      'Revise step two so it includes a measurable rollback trigger, without changing the other steps.',
    providerOptions: {
      openai: {
        previousResponseId,
        reasoningContext: 'all_turns',
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  });

  console.log('Second response:');
  for await (const textDelta of secondResult.textStream) {
    process.stdout.write(textDelta);
  }
  console.log();

  const secondMetadata = (await secondResult.finalStep).providerMetadata as
    | OpenaiResponsesProviderMetadata
    | undefined;

  console.log(
    'Effective reasoning context:',
    secondMetadata?.openai.reasoningContext,
  );
});
