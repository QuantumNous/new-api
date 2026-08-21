import { generateText } from 'ai';

declare const model: any;

const result = await generateText({
  model,
  prompt: 'Invent a new holiday and describe its traditions.',
});

console.log((result.usage as any).reasoningTokens);

export {};
