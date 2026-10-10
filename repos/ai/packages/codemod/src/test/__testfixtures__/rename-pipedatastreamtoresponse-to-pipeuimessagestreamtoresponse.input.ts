// @ts-nocheck
import { streamText, pipeDataStreamToResponse } from 'ai';

export async function handler(req: Request, res: Response) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
  });

  // Method call
  result.pipeDataStreamToResponse(res);
  
  // Also test standalone function import
  pipeDataStreamToResponse(result.toDataStream(), res);
} 