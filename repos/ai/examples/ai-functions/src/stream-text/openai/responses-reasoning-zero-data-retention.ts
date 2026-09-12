import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { APICallError, streamText, type UserModelMessage } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result1 = streamText({
    model: openai.responses('o3-mini'),
    prompt:
      'Analyze the following encrypted data: U2VjcmV0UGFzc3dvcmQxMjM=. What type of encryption is this and what secret does it contain?',
    reasoning: 'medium',
    providerOptions: {
      openai: {
        store: false, // No data retention - makes interaction stateless
        reasoningSummary: 'auto',
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  });

  await result1.consumeStream();

  console.log('=== First request ===');
  process.stdout.write('\x1b[34m');
  console.log(JSON.stringify(await result1.reasoning, null, 2));
  process.stdout.write('\x1b[0m');
  console.log(await result1.text);
  console.log();
  console.log(
    'Request body:',
    JSON.stringify((await result1.request).body, null, 2),
  );

  const result2 = streamText({
    model: openai.responses('o3-mini'),
    prompt: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze the following encrypted data: U2VjcmV0UGFzc3dvcmQxMjM=. What type of encryption is this and what secret does it contain?',
          },
        ],
      },
      ...(await result1.response).messages, // Need to pass all previous messages to the follow-up request
      {
        role: 'user',
        content:
          'Based on your previous analysis, what security recommendations would you make?',
      } satisfies UserModelMessage,
    ],
    reasoning: 'medium',
    providerOptions: {
      openai: {
        store: false, // No data retention - makes interaction stateless
        reasoningSummary: 'auto',
      } satisfies OpenAILanguageModelResponsesOptions,
    },
    onError: ({ error }) => {
      console.error(error);

      if (APICallError.isInstance(error)) {
        console.error(JSON.stringify(error.requestBodyValues, null, 2));
      }
    },
  });

  await result2.consumeStream();

  console.log('=== Second request ===');
  process.stdout.write('\x1b[34m');
  console.log(JSON.stringify(await result2.reasoning, null, 2));
  process.stdout.write('\x1b[0m');
  console.log(await result2.text);
  console.log();
  console.log(
    'Request body:',
    JSON.stringify((await result2.request).body, null, 2),
  );
});
