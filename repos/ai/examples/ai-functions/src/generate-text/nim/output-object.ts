import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const nim = createOpenAICompatible({
    baseURL: 'https://integrate.api.nvidia.com/v1',
    name: 'nim',
    headers: {
      Authorization: `Bearer ${process.env.NIM_API_KEY}`,
    },
  });
  const model = nim.chatModel('meta/llama-3.3-70b-instruct');
  const result = await generateText({
    model,
    output: Output.object({
      schema: z.array(
        z.object({
          name: z.string(),
          breed: z.string(),
        }),
      ),
    }),
    prompt:
      'Generate 10 cat names and breeds for a fictional book about a world where cats rule shrimp.',
  });

  console.log(JSON.stringify(result.output, null, 2));
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
