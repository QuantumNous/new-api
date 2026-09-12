import { generateText } from 'ai';

declare const model: any;

const result: any = await generateText({
  model,
  prompt: 'Hello!',
});

console.log(result.usage.cachedInputTokens);

export {};
