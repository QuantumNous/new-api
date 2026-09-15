// @ts-nocheck
import { convertToModelMessages, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { azure } from '@ai-sdk/azure';

// Case 1: Inline usage in streamText
export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}

// Case 2: Variable assignment
async function processMessages(uiMessages: any[]) {
  const modelMessages = convertToModelMessages(uiMessages);
  console.log(modelMessages);
  return modelMessages;
}

// Case 3: Inline with azure provider
async function handleAzure(uiMessages: any[]) {
  const result = streamText({
    model: azure('gpt-5-mini'),
    tools: {},
    messages: convertToModelMessages(uiMessages),
  });
  return result;
}

// Case 4: Used as prompt
async function useAsPrompt(messages: any[]) {
  const prompt = convertToModelMessages(messages);

  const result = streamText({
    model: openai('gpt-4o'),
    prompt,
    abortSignal: new AbortController().signal,
  });

  return result;
}

// Case 5: Already awaited - should not double-await
async function alreadyAwaited(messages: any[]) {
  const modelMessages = await convertToModelMessages(messages);
  return modelMessages;
}

