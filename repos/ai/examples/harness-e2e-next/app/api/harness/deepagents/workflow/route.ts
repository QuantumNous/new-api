import { latestUserMessage } from '@/util/latest-user-message';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';
import { start } from 'workflow/api';
import { deepAgentsCodingWorkflow } from './workflow';

// Durable multi-turn DeepAgents chat via the Workflow DevKit; the `'use workflow'` orchestration lives in `./workflow` (kept `ai`-free) and this is the plain POST handler.
export async function POST(request: Request) {
  const body: {
    id?: string;
    messages: UIMessage[];
  } = await request.json();

  if (!body.id) {
    return new Response('Missing chat id', { status: 400 });
  }
  const prompt = latestUserMessage(await convertToModelMessages(body.messages));
  if (!prompt) {
    return new Response('No user message to run', { status: 400 });
  }

  // The chat id is the stable harness session id; the session owns history, so we send only the newest user message.
  const run = await start(deepAgentsCodingWorkflow, [
    { prompt, sessionId: body.id },
  ]);

  return createUIMessageStreamResponse({
    stream: run.readable as ReadableStream<UIMessageChunk>,
  });
}
