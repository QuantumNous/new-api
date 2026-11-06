import { generateText } from 'ai';

declare const model: any;

const options = {
  model,
  system: 'hello',
  prompt: 'Hello',
  onStart: ({ system }: any) => {
    console.log(system);
  },
};

await generateText(options);
