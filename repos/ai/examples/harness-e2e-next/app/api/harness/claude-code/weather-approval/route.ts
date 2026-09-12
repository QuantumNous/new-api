import { weatherApprovalClaudeCodeHarnessAgent } from '@/agent/harness/claude-code/weather-approval-agent';
import {
  detachAndPersist,
  resumeOrCreateSession,
} from '@/util/harness-resume-store';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from 'ai';

export async function POST(request: Request) {
  const body: {
    id?: string;
    messages: UIMessage[];
  } = await request.json();

  if (!body.id) {
    return new Response('Missing chat id', { status: 400 });
  }
  const chatId = body.id;
  const messages = await convertToModelMessages(body.messages);

  const session = await resumeOrCreateSession(
    weatherApprovalClaudeCodeHarnessAgent,
    chatId,
  );

  const result = await weatherApprovalClaudeCodeHarnessAgent.stream({
    session,
    messages,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: body.messages,
      onFinish: () => detachAndPersist(chatId, session),
    }),
  });
}
