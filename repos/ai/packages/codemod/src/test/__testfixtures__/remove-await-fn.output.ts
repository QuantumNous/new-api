// @ts-nocheck
import { streamText } from 'ai';

async function main() {
  const result = streamText({
    model: 'gpt-3.5-turbo',
    prompt: 'Hello, world!',
  });
  console.log(result);
}

main();
