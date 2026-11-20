// @ts-nocheck
import { generateText, streamText, generateObject, streamObject } from 'ai';

async function main() {
  const result = await generateText({
    model: provider('model-name'),
    prompt: 'Hello',
  });

  const stream = await streamText({
    model: provider('model-name'),
    prompt: 'Hello',
  });

  const obj = await generateObject({
    model: provider('model-name'),
    prompt: 'Hello',
  });

  const objStream = await streamObject({
    model: provider('model-name'),
    prompt: 'Hello',
  });
}