import { openai } from '@ai-sdk/openai';
import { createTextStreamResponse, Output, streamText, toTextStream } from 'ai';
import { expenseSchema } from './schema';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { expense }: { expense: string } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    instructions:
      'You categorize expenses into one of the following categories: ' +
      'TRAVEL, MEALS, ENTERTAINMENT, OFFICE SUPPLIES, OTHER.' +
      // provide date (including day of week) for reference:
      'The current date is: ' +
      new Date()
        .toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          weekday: 'short',
        })
        .replace(/(\w+), (\w+) (\d+), (\d+)/, '$4-$2-$3 ($1)') +
      '. When no date is supplied, use the current date.',
    prompt: `Please categorize the following expense: "${expense}"`,
    output: Output.object({ schema: expenseSchema }),
  });

  return createTextStreamResponse({
    stream: toTextStream({ stream: result.stream }),
  });
}
