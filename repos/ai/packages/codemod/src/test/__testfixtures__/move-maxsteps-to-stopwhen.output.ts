// @ts-nocheck
import { generateText, stepCountIs } from 'ai';
import { useChat } from '@ai-sdk/react';

async function foo() {
  const result = await generateText({
    model: 'gpt-4',
    messages: [],
    stopWhen: stepCountIs(5)
  });

  const maxSteps = 5;

  await generateText({
    model: 'gpt-4',
    messages: [],
    stopWhen: stepCountIs(maxSteps)
  });

  await generateText({
    model: 'gpt-4',
    messages: [],
    stopWhen: stepCountIs(5 + 5)
  });

  await generateText({
    model: 'gpt-4',
    messages: [],
    stopWhen: stepCountIs(maxSteps + 5)
  });

  const obj = {
    model: 'gpt-4',
    messages: [],
    stopWhen: stepCountIs(maxSteps + 5)
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
    /* FIXME(@ai-sdk-upgrade-v5): The maxSteps parameter has been removed from useChat. You should now use server-side `stopWhen` conditions for multi-step tool execution control. https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#maxsteps-removal */
    maxSteps: 7,
  });
}

const config = {
  maxSteps: 10,
  foo: 'bar',
};
