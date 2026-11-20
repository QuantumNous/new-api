import { streamText } from 'ai';

declare const model: any;

const result = streamText({
  model,
  prompt: 'Hello',
});

for await (const part of result.stream) {
  console.log(part);
}
