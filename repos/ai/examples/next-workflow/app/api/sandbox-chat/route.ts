import { createUIMessageStreamResponse, type UIMessage } from 'ai';
import { start } from 'workflow/api';
import { sandboxChat, toUIMessageStream } from '@/workflow/sandbox-agent';

interface SandboxChatRequest {
  messages: UIMessage[];
}

export async function POST(req: Request) {
  const body = (await req.json()) as SandboxChatRequest;
  const run = await start(sandboxChat, [
    body.messages,
    {
      requestId: crypto.randomUUID(),
      tenantId: 'tenant_sandbox_e2e',
      scenario: 'sandbox',
    },
  ]);

  return createUIMessageStreamResponse({
    stream: toUIMessageStream(run.readable),
    headers: {
      'x-workflow-run-id': run.runId,
    },
  });
}
