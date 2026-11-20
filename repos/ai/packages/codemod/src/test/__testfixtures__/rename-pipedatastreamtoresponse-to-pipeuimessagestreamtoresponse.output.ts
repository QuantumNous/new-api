// @ts-nocheck
import { streamText, pipeUIMessageStreamToResponse } from 'ai';

export async function handler(req: Request, res: Response) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
  });

  // Method call
  result.pipeUIMessageStreamToResponse(res);
  
  // Also test standalone function import
  pipeUIMessageStreamToResponse(result.toDataStream(), res);
} 