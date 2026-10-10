'use server';

import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { createStreamableValue } from '@ai-sdk/rsc';

export async function generateCompletion(prompt: string) {
  const result = streamText({
    model: openai('gpt-5-mini'),
    maxOutputTokens: 2000,
    prompt,
  });

  return createStreamableValue(result.textStream).value;
}
