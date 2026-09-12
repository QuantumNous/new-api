import { xai, type XaiLanguageModelChatOptions } from '@ai-sdk/xai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: xai('grok-4.5'),
    prompt: 'write one short sentence about san francisco',
    include: {
      rawChunks: true,
    },
    providerOptions: {
      xai: {
        logprobs: true,
        topLogprobs: 3,
      } satisfies XaiLanguageModelChatOptions,
    },
  });

  for await (const part of result.stream) {
    if (part.type === 'raw') {
      console.log('raw:', JSON.stringify(part.rawValue));
      continue;
    }

    if (part.type === 'text-delta') {
      console.log('text:', part.text);
      continue;
    }

    if (part.type === 'finish') {
      console.log('finish:', part.finishReason);
    }
  }

  console.log();
  console.log('warnings:', await result.warnings);
  console.log('usage:', await result.usage);
});
