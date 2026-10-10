import { openai } from '@ai-sdk/openai';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { generateText, Output, registerTelemetry } from 'ai';
import { LegacyOpenTelemetry } from '@ai-sdk/otel';
import { z } from 'zod';
import { run } from '../../lib/run';

const sdk = new NodeSDK({
  traceExporter: new ConsoleSpanExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
registerTelemetry(new LegacyOpenTelemetry());

run(async () => {
  await generateText({
    model: openai('gpt-4o-mini'),
    output: Output.object({
      schema: z.object({
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
    }),
    prompt: 'Generate a lasagna recipe.',
    telemetry: {
      functionId: 'my-awesome-function',
    },
  });

  await sdk.shutdown();
});
