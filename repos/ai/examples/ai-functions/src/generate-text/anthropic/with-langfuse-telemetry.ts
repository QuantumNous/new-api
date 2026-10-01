import { anthropic } from '@ai-sdk/anthropic';
import { OpenTelemetry } from '@ai-sdk/otel';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { generateText, isStepCount, registerTelemetry } from 'ai';
import { run } from '../../lib/run';
import { z } from 'zod';

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();
registerTelemetry(new OpenTelemetry());

run(async () => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-5-20250929'),
    prompt: 'what is the weather in Tokyo?',
    tools: {
      getWeather: {
        description: 'Get the weather for a given city',
        inputSchema: z.object({
          city: z.string(),
        }),
        execute: async ({ city }) => {
          return {
            temperature: 50,
            condition: 'sunny',
          };
        },
      },
    },
    reasoning: 'medium',
    stopWhen: isStepCount(5),
    telemetry: {
      functionId: 'anthropic-tool-call-step-performance',
    },
  });

  console.log('Reasoning:');
  console.log(result.reasoning);
  console.log();
  console.log('Text:');
  console.log(result.text);
  console.log();
  console.log('Step performance:');
  console.log(result.steps.map(step => step.performance));

  await sdk.shutdown();
});
