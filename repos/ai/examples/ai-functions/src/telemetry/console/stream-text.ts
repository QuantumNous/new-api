import { openai } from '@ai-sdk/openai';
import { streamText, registerTelemetry } from 'ai';
import { run } from '../../lib/run';
import { consoleTelemetry } from './console-telemetry';

registerTelemetry(consoleTelemetry);

run(async () => {
  const result = streamText({
    model: openai('gpt-5-mini'),
    prompt: 'Invent a new holiday and describe its traditions.',
    runtimeContext: {
      something: 'custom',
      someOtherThing: 'other-value',
      secretApiKey: 'sk-secret',
    },
    telemetry: {
      functionId: 'my-awesome-function',
      includeRuntimeContext: {
        something: true,
        someOtherThing: true,
      },
    },
  });

  await result.consumeStream();
});
