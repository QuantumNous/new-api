import {
  openai,
  type OpenAILanguageModelResponsesOptions,
  type OpenaiResponsesProviderMetadata,
} from '@ai-sdk/openai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const firstResult = await generateText({
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

  const firstMetadata = firstResult.finalStep.providerMetadata as
    | OpenaiResponsesProviderMetadata
    | undefined;
  const previousResponseId = firstMetadata?.openai.responseId;

  if (!previousResponseId) {
    throw new Error('OpenAI did not return a response ID.');
  }

  console.log('First response:');
  console.log(firstResult.text);
  console.log(
    'Effective reasoning context:',
    firstMetadata.openai.reasoningContext,
  );
  console.log();

  const secondResult = await generateText({
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

  const secondMetadata = secondResult.finalStep.providerMetadata as
    | OpenaiResponsesProviderMetadata
    | undefined;

  console.log('Second response:');
  console.log(secondResult.text);
  console.log(
    'Effective reasoning context:',
    secondMetadata?.openai.reasoningContext,
  );
});
