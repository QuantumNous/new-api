'use client';

import { useChat } from '@ai-sdk/react';
import { WorkflowChatTransport } from '@ai-sdk/workflow';
import { useMemo, useState } from 'react';

type SandboxToolPart = {
  type: `tool-${string}`;
  toolCallId?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
};

const expectedStdout = 'sandbox:stream:echo sandbox-e2e';

export default function SandboxPage() {
  const [workflowRunId, setWorkflowRunId] = useState<string>();

  const transport = useMemo(
    () =>
      new WorkflowChatTransport({
        api: '/api/sandbox-chat',
        maxConsecutiveErrors: 5,
        initialStartIndex: -50,
        onChatSendMessage: response => {
          setWorkflowRunId(
            response.headers.get('x-workflow-run-id') ?? undefined,
          );
        },
      }),
    [],
  );

  const { status, sendMessage, messages, setMessages } = useChat({
    transport,
  });

  const running = status === 'submitted' || status === 'streaming';
  const transcript = JSON.stringify(messages);
  const passed = transcript.includes(expectedStdout);

  const startRun = () => {
    setWorkflowRunId(undefined);
    setMessages([]);
    sendMessage({ text: 'Run the sandbox command.' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white p-4">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-xl font-semibold">WorkflowAgent Sandbox E2E</h1>
          <p className="mt-1 text-sm text-gray-600">
            Deterministic harness for `experimental_sandbox` tool execution.
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-4 p-4 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-lg border bg-white p-3">
            <button
              type="button"
              disabled={running}
              onClick={startRun}
              className="w-full rounded border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              Run sandbox command
            </button>
          </section>

          <section className="rounded-lg border bg-white p-3 text-xs">
            <h2 className="font-semibold text-sm">Run</h2>
            <dl className="mt-2 space-y-1 font-mono">
              <div>
                <dt className="text-gray-500">chat</dt>
                <dd>{status}</dd>
              </div>
              <div>
                <dt className="text-gray-500">workflowRunId</dt>
                <dd className="break-all">{workflowRunId ?? '-'}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border bg-white p-3 text-sm">
            <h2 className="font-semibold">Expected Result</h2>
            <div
              className={`mt-2 rounded border px-3 py-2 ${
                passed
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-gray-200 bg-gray-50 text-gray-500'
              }`}
            >
              {passed ? 'PASS' : 'TODO'} {expectedStdout}
            </div>
          </section>
        </aside>

        <section className="rounded-lg border bg-white">
          <div className="border-b p-3 font-semibold">Chat</div>
          <div className="max-h-[620px] overflow-y-auto p-3">
            {messages.length === 0 && (
              <p className="text-sm text-gray-500">No sandbox run yet.</p>
            )}
            {messages.map(message => (
              <div key={message.id} className="mb-3">
                <div className="mb-1 text-xs font-semibold uppercase text-gray-500">
                  {message.role}
                </div>
                <div className="rounded bg-gray-50 p-3 text-sm">
                  {message.parts.map((part, index) => {
                    if (part.type === 'text') {
                      return (
                        <div key={index} className="whitespace-pre-wrap">
                          {part.text}
                        </div>
                      );
                    }

                    if (part.type.startsWith('tool-')) {
                      const toolPart = part as SandboxToolPart;
                      return (
                        <pre
                          key={index}
                          className="mt-2 overflow-x-auto rounded border bg-white p-2 text-xs"
                        >
                          {JSON.stringify(toolPart, null, 2)}
                        </pre>
                      );
                    }

                    return null;
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
