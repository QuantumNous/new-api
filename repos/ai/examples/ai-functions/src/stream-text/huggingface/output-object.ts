import { huggingFace } from '@ai-sdk/huggingface';
import { Output, streamText } from 'ai';
import { z } from 'zod/v4';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: huggingFace.responses('moonshotai/Kimi-K2-Instruct'),
    output: Output.object({
      schema: z.object({
        cities: z.array(
          z.object({
            name: z.string(),
            country: z.string(),
            population: z.number(),
          }),
        ),
      }),
    }),
    prompt:
      'Generate a list of 3 major cities with their populations. IN JSON FORMAT',
  });

  for await (const partialOutput of result.partialOutputStream) {
    console.log('Partial output:', partialOutput);
  }

  const finalOutput = await result.output;
  const usage = await result.usage;

  console.log('\nFinal output:', finalOutput);
  console.log('\nToken usage:', usage);
  console.log('Finish reason:', await result.finishReason);
});
