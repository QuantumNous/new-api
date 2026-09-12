// @ts-nocheck
import { generateText } from 'ai';
import { createCohere } from '@ai-sdk/cohere';
import { nanoid } from 'ai';
import 'dotenv/config';

async function main() {
  const cohereProvider = createCohere({
    generateId: nanoid,
  });

  const { text } = await generateText({
    model: cohereProvider('command-r-plus'),
    prompt: 'Write a short story about red pandas.',
  });
  console.log(text);
}

main().catch(console.error);
