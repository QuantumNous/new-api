import { latestUserMessage } from '@/util/latest-user-message';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';
import { start } from 'workflow/api';
import { codexCodingWorkflow } from './workflow';

/*
 * Durable, multi-turn Codex chat via the Vercel Workflow DevKit. The
 * `'use workflow'` orchestration lives in `./workflow` (kept `ai`-free so the
 * DevKit's generated step/flow routes don't pull in `@ai-sdk/gateway`); this
 * file is the plain POST handler.
 */
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

  const run = await start(codexCodingWorkflow, [
    { prompt, sessionId: body.id },
  ]);

  return createUIMessageStreamResponse({
    stream: run.readable as ReadableStream<UIMessageChunk>,
  });
}
