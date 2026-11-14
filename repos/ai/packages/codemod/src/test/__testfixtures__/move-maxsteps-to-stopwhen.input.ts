// @ts-nocheck
import { generateText } from 'ai';
import { useChat } from '@ai-sdk/react';

async function foo() {
  const result = await generateText({
    model: 'gpt-4',
    messages: [],
    maxSteps: 5,
  });

  const maxSteps = 5;

  await generateText({
    model: 'gpt-4',
    messages: [],
    maxSteps,
  });

  await generateText({
    model: 'gpt-4',
    messages: [],
    maxSteps: 5 + 5,
  });

  await generateText({
    model: 'gpt-4',
    messages: [],
    maxSteps: maxSteps + 5,
  });

  const obj = {
    model: 'gpt-4',
    messages: [],
    maxSteps: maxSteps + 5,
  }

  await generateText(obj);

  const obj2 = {
    model: 'gpt-4',
    messages: [],
    maxSteps: maxSteps + 5,
  }

  return result;
}

export function ChatComponent() {
  useChat({
    model: 'gpt-4',
    maxSteps: 7,
  });
}

const config = {
  maxSteps: 10,
  foo: 'bar',
};
