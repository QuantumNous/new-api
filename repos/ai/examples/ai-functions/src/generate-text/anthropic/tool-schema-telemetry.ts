import { anthropic } from '@ai-sdk/anthropic';
import { registerTelemetry, streamText } from 'ai';
import { z } from 'zod';
import { LegacyOpenTelemetry, OpenTelemetry } from '@ai-sdk/otel';
import { DevToolsTelemetry } from '@ai-sdk/devtools';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { run } from '../../lib/run';

registerTelemetry(new LegacyOpenTelemetry(), DevToolsTelemetry());

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();

run(async () => {
  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    prompt: 'Cook me a lasagna.',
    tools: {
      cookRecipe: {
        description: 'Cook a recipe',
        inputSchema: z.object({
          recipe: z.object({
            name: z.string(),
            ingredients: z.array(
              z.object({
                name: z.string(),
                amount: z.string(),
              }),
            ),
            steps: z.array(z.string()),
          }),
        }),
      },
    },
    telemetry: {
      functionId: `cook-recipe`,
    },
  });

  for await (const part of result.stream) {
    switch (part.type) {
      case 'tool-input-start':
        console.log(`\n[tool-input-start] ${part.toolName} (${part.id})`);
        break;
      case 'tool-input-delta':
        process.stdout.write(part.delta);
        break;
      case 'tool-input-end':
        console.log(`\n[tool-input-end] (${part.id})`);
        break;
      case 'tool-call':
        console.log(`\n[tool-call] ${part.toolName}:`, part.input);
        break;
      case 'text-delta':
        process.stdout.write(part.text);
        break;
      case 'finish':
        console.log('\nFinish reason:', part.finishReason);
        console.log('Usage:', part.totalUsage);
        break;
      case 'error':
        console.error('Error:', part.error);
        break;
    }
  }
  await sdk.shutdown();
});
