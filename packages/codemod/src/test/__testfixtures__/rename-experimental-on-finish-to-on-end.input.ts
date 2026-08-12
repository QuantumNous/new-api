import { embed } from 'ai';

declare const model: any;
declare const value: string;

const options = {
  model,
  value,
  experimental_onFinish: () => {},
};

await embed(options);
