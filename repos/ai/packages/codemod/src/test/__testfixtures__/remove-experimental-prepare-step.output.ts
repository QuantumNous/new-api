import { generateText } from 'ai';

declare const model: any;
declare const weather: any;

const options = {
  model,
  tools: { weather },
  prompt: 'Hello',
  prepareStep: () => ({
    activeTools: ['weather'] as const,
  }),
};

await generateText(options);
