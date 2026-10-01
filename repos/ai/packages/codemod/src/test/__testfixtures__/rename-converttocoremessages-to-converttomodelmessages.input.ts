// @ts-nocheck
import { convertToCoreMessages, streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages: convertToCoreMessages(messages),
  });

  return result.toDataStreamResponse();
}

// Also test function call
const coreMessages = convertToCoreMessages(uiMessages);
console.log(coreMessages); 