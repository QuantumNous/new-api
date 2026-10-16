// @ts-nocheck
import { convertToModelMessages, streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages: convertToModelMessages(messages),
  });

  return result.toDataStreamResponse();
}

// Also test function call
const coreMessages = convertToModelMessages(uiMessages);
console.log(coreMessages); 