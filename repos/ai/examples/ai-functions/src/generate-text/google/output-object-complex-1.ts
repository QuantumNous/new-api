import { google } from '@ai-sdk/google';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const Person = z.object({ name: z.string() });
  const Team = z.object({
    developers: z.array(Person),
    designers: z.array(Person),
  });

  const result = await generateText({
    model: google('gemini-2.5-flash'),
    output: Output.object({ schema: Team }),
    prompt: 'Generate a fake team of developers and designers.',
  });

  console.log(JSON.stringify(result.output, null, 2));
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
