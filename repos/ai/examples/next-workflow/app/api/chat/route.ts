import { createModelCallToUIChunkTransform } from '@ai-sdk/workflow';
import { createUIMessageStreamResponse, type UIMessage } from 'ai';
import { start } from 'workflow/api';
import { chat, type ChatRequestContext } from '@/workflow/agent-chat';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Resolve per-request context here (auth, headers, settings) and hand it
  // to the workflow. Inside the workflow this is split into:
  //   - `runtimeContext`  — shared agent state (tenant, request, plan)
  //   - `toolsContext`    — per-tool state (weather unit, file root dir)
  const requestContext: ChatRequestContext = {
    tenantId: req.headers.get('x-tenant-id') ?? 'tenant_demo',
    requestId: req.headers.get('x-request-id') ?? crypto.randomUUID(),
    userPlan:
      req.headers.get('x-user-plan') === 'enterprise' ? 'enterprise' : 'free',
    preferredUnit:
      req.headers.get('x-unit') === 'fahrenheit' ? 'fahrenheit' : 'celsius',
    fileRootDir: '/tmp/workflow-sandbox',
  };

  const run = await start(chat, [messages, requestContext]);

  return createUIMessageStreamResponse({
    stream: run.readable.pipeThrough(createModelCallToUIChunkTransform()),
    headers: {
      'x-workflow-run-id': run.runId,
      'x-request-id': requestContext.requestId,
    },
  });
}
