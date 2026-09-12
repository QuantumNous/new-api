import { generateText } from 'ai';

declare const model: any;
declare const weather: any;

const options = {
  model,
  tools: { weather },
  prompt: 'Hello',
  activeTools: ['weather'] as const,
  prepareStep: async ({ stepNumber }: any): Promise<any> => {
    if (stepNumber === 0) {
      return {
        activeTools: ['weather'] as const,
      };
    }
  },
};

await generateText(options);
