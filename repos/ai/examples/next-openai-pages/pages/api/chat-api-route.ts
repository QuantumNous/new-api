import { openai } from '@ai-sdk/openai';
import {
  pipeUIMessageStreamToResponse,
  streamText,
  toUIMessageStream,
} from 'ai';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  const { messages } = await request.body;

  const result = streamText({
    model: openai('gpt-5-mini'),
    messages,
  });

  // write the data stream to the response
  // Note: this is sent as a single response, not a stream
  pipeUIMessageStreamToResponse({
    response,
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
