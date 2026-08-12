import { generateText } from 'ai';

declare const model: any;
declare const Output: any;
declare const schema: any;

const options = {
  model,
  experimental_output: Output.object({
    schema,
  }),
  prompt: 'Generate a recipe.',
};

const result = await generateText(options);

console.log((result as any).experimental_output);
