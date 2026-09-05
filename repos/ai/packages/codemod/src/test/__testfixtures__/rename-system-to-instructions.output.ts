import { generateText } from 'ai';

declare const model: any;

const options = {
  model,
  instructions: 'hello',
  prompt: 'Hello',
  onStart: ({ instructions: system }: any) => {
    console.log(system);
  },
};

await generateText(options);
