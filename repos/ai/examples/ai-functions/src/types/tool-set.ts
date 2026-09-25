import { openai } from '@ai-sdk/openai';
import {
  generateText,
  tool,
  type StaticToolCall,
  type StaticToolResult,
} from 'ai';
import { z } from 'zod';

const myToolSet = {
  firstTool: tool({
    description: 'Greets the user',
    inputSchema: z.object({ name: z.string() }),
    execute: async ({ name }) => `Hello, ${name}!`,
  }),
  secondTool: tool({
    description: 'Tells the user their age',
    inputSchema: z.object({ age: z.number() }),
    execute: async ({ age }) => `You are ${age} years old!`,
  }),
};

type MyToolCall = StaticToolCall<typeof myToolSet>;
type MyToolResult = StaticToolResult<typeof myToolSet>;

async function generateSomething(prompt: string): Promise<{
  text: string;
  staticToolCalls: Array<MyToolCall>;
  staticToolResults: Array<MyToolResult>;
}> {
  return generateText({
    model: openai('gpt-4o'),
    tools: myToolSet,
    prompt,
  });
}

const { text, staticToolCalls, staticToolResults } =
  await generateSomething('...');
