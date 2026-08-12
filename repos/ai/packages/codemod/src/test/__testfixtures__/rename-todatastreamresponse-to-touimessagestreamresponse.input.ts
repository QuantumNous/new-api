// @ts-nocheck
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
  });

  return result.toDataStreamResponse();
}

// Another example
const stream = streamText({ model, prompt });
const response = stream.toDataStreamResponse({ 
  status: 200,
  headers: { 'custom': 'header' }
});

const result1 = result.toDataStreamResponse({
  getErrorMessage: error => {
    return {
      errorCode: 'STREAM_ERROR',
      message: 'An error occurred while processing your request',
    };
  },
});

// Variable object with getErrorMessage
const opts = {
  getErrorMessage: error => {
    return {
      errorCode: 'STREAM_ERROR',
      message: 'An error occurred while processing your request',
    };
  },
};
const result2 = result.toDataStreamResponse(opts);
