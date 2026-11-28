import { generateText } from 'ai';

declare const model: any;

await generateText({
  model,
  prompt: 'Hello',
  include: {
    requestBody: true,
  },
});
