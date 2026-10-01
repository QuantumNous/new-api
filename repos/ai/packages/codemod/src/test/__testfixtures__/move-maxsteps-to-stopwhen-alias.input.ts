// @ts-nocheck
import { generateText as GT } from 'ai';
import { useChat as UC } from '@ai-sdk/react';

async function foo() {
  const result = await GT({
    model: 'gpt-4',
    messages: [],
    maxSteps: 5,
  });

  const maxSteps = 5;

  await GT({
    model: 'gpt-4',
    messages: [],
    maxSteps,
  });

  await GT({
    model: 'gpt-4',
    messages: [],
    maxSteps: 5 + 5,
  });

  await GT({
    model: 'gpt-4',
    messages: [],
    maxSteps: maxSteps + 5,
  });

  const obj = {
    model: 'gpt-4',
    messages: [],
    maxSteps: maxSteps + 5,
  }

  await GT(obj);

  const obj2 = {
    model: 'gpt-4',
    messages: [],
    maxSteps: maxSteps + 5,
  }

  return result;
}

export function ChatComponent() {
  UC({
    model: 'gpt-4',
    maxSteps: 7,
  });
}

const config = {
  maxSteps: 10,
  foo: 'bar',
};
