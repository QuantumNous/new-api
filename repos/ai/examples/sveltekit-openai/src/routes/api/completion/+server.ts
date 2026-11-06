import { createOpenAI } from '@ai-sdk/openai';
import {
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from 'ai';
import { env } from '$env/dynamic/private';

const openai = createOpenAI({
  apiKey: env?.OPENAI_API_KEY,
});

const system = `
Generate a completion for the given prompt. Your completion should never start with the text of the prompt, but should continue the prompt in a natural way.
Your completion should provide a maximum of 100 additional words. Only provide completions you're highly confident are likely to be accurate.

Here are some examples:
- Prompt: "Hello,"
  Completion: "Hello, world!"
- Prompt: "The capital of France is"
  Completion: "The capital of France is Paris."
- Prompt: "We the people"
  Completion: "We the people of the United States, in order to form a more perfect union, establish justice, insure domestic tranquility, provide for the common defense, promote the general welfare, and secure the blessings of liberty to ourselves and our posterity, do ordain and establish this Constitution for the United States of America."

It is VERY IMPORTANT that your completion continues the prompt and does not repeat the prompt.
`;

export const POST = async ({ request }: { request: Request }) => {
  const { prompt } = await request.json();

  const result = streamText({
    model: openai('gpt-4o'),
    system,
    prompt,
    onError: error => {
      console.error(error);
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
};
