// @ts-nocheck
import { streamText } from 'other-module';

async function main() {
  const result = await streamText({
    model: 'gpt-3.5-turbo',
    prompt: 'Hello, world!',
  });
  console.log(result);
}

main();
