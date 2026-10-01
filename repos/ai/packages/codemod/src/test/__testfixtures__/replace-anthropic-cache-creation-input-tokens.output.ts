import { generateText } from 'ai';

declare const model: any;

const result: any = await generateText({
  model,
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(result.usage.inputTokenDetails.cacheWriteTokens);

export {};
