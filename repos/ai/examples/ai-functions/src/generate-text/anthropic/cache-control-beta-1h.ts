import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

const errorMessage = fs.readFileSync('data/error-message.txt', 'utf8');

const cachedMessage = `The time is ${new Date().toISOString()}. Error message: ${errorMessage}`;

run(async () => {
  const result = await generateText({
    model: anthropic('claude-haiku-4-5'),
    headers: {
      'anthropic-beta': 'extended-cache-ttl-2025-04-11',
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'You are a JavaScript expert.',
          },
          {
            type: 'text',
            text: cachedMessage,
            providerOptions: {
              anthropic: {
                cacheControl: { type: 'ephemeral', ttl: '1h' },
              } satisfies AnthropicLanguageModelOptions,
            },
          },
          {
            type: 'text',
            text: 'Explain the error message.',
          },
        ],
      },
    ],
  });

  console.log(
    'Usage information:',
    result.finalStep.providerMetadata?.anthropic?.usage,
  );

  // e.g.
  // Usage information: {
  //   input_tokens: 10,
  //   cache_creation_input_tokens: 2177,
  //   cache_read_input_tokens: 0,
  //   cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 2177 },
  //   output_tokens: 285,
  //   service_tier: 'standard'
  // }

  const cachedResult = await generateText({
    model: anthropic('claude-haiku-4-5'),
    headers: {
      'anthropic-beta': 'extended-cache-ttl-2025-04-11',
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'You are a JavaScript expert.',
          },
          {
            type: 'text',
            text: cachedMessage,
            providerOptions: {
              anthropic: {
                cacheControl: { type: 'ephemeral', ttl: '1h' },
              },
            },
          },
          {
            type: 'text',
            text: 'What is this?.',
          },
        ],
      },
    ],
  });

  console.log(
    'Usage information:',
    cachedResult.finalStep.providerMetadata?.anthropic?.usage,
  );

  // e.g.
  // Usage information: {
  //   input_tokens: 8,
  //   cache_creation_input_tokens: 0,
  //   cache_read_input_tokens: 2177,
  //   cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
  //   output_tokens: 317,
  //   service_tier: 'standard'
  // }
});
