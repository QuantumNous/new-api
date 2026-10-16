'use client';

import { useChat } from '@ai-sdk/react';
import { WorkflowChatTransport } from '@ai-sdk/workflow';
import { lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  TelemetryEventRecord,
  TelemetryScenario,
} from '@/lib/telemetry-store';

type TelemetryStatus = {
  telemetryRunId: string;
  scenario: TelemetryScenario;
  events: TelemetryEventRecord[];
  expectations: Array<{ name: string; met: boolean }>;
  contextFiltering: {
    includesAllowedRuntimeContext: boolean;
    excludesRuntimeSecret: boolean;
    excludesToolSecret: boolean;
  };
};

type TelemetryToolPart = {
  type: `tool-${string}`;
  toolCallId?: string;
  state?: string;
  approval?: {
    id: string;
    approved?: boolean;
  };
  input?: unknown;
  output?: unknown;
};

const scenarios: Array<{
  id: TelemetryScenario;
  title: string;
  prompt: string;
  description: string;
}> = [
  {
    id: 'happy-path',
    title: 'Happy path',
    prompt: 'Run the weather and calculator tools.',
    description: 'Multi-step model calls, chunks, two tool executions, finish.',
  },
  {
    id: 'context-filtering',
    title: 'Context filtering',
    prompt: 'Run the context-filtering tools.',
    description: 'Runtime/tools context inclusion without secret leakage.',
  },
  {
    id: 'approval',
    title: 'Approval',
    prompt: 'Delete the sandboxed report file.',
    description: 'Tool approval request, approval response, and follow-up run.',
  },
  {
    id: 'tool-error',
    title: 'Tool error',
    prompt: 'Run the failing tool.',
    description: 'Tool execution failure and error telemetry.',
  },
  {
    id: 'model-error',
    title: 'Model error',
    prompt: 'Trigger a model error.',
    description: 'Unrecoverable model failure and onError telemetry.',
  },
  {
    id: 'reconnect',
    title: 'Reconnect',
    prompt: 'Run the reconnect scenario.',
    description: 'Interrupted POST stream followed by transport reconnect.',
  },
];

export default function TelemetryPage() {
  const [scenario, setScenario] = useState<TelemetryScenario>();
  const [telemetryRunId, setTelemetryRunId] = useState<string>();
  const [workflowRunId, setWorkflowRunId] = useState<string>();
  const [status, setStatus] = useState<TelemetryStatus>();
  const [transportLog, setTransportLog] = useState<string[]>([]);

  const scenarioRef = useRef<TelemetryScenario>('happy-path');
  const telemetryRunIdRef = useRef<string>();

  const addTransportLog = (message: string) => {
    const time = new Date().toISOString().split('T')[1].split('.')[0];
    setTransportLog(log => [...log, `[${time}] ${message}`]);
  };

  const transport = useMemo(
    () =>
      new WorkflowChatTransport({
        api: '/api/telemetry-chat',
        maxConsecutiveErrors: 5,
        initialStartIndex: -50,
        prepareSendMessagesRequest: options => {
          const body = (options.body ?? {}) as Record<string, unknown>;
          return {
            body: {
              messages: options.messages,
              ...body,
              scenario: body.scenario ?? scenarioRef.current,
              telemetryRunId: body.telemetryRunId ?? telemetryRunIdRef.current,
              resetTelemetry:
                body.resetTelemetry ??
                (options.trigger === 'submit-message' &&
                  options.messages.length <= 1),
            },
          };
        },
        onChatSendMessage: response => {
          const nextWorkflowRunId = response.headers.get('x-workflow-run-id');
          const nextTelemetryRunId = response.headers.get('x-telemetry-run-id');
          setWorkflowRunId(nextWorkflowRunId ?? undefined);
          addTransportLog(
            `POST response: workflowRunId=${nextWorkflowRunId}, telemetryRunId=${nextTelemetryRunId}`,
          );
        },
        onChatEnd: ({ chatId, chunkIndex }) => {
          addTransportLog(`Chat ended: chatId=${chatId}, chunks=${chunkIndex}`);
        },
      }),
    [],
  );

  const {
    status: chatStatus,
    sendMessage,
    messages,
    addToolApprovalResponse,
    setMessages,
  } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });

  useEffect(() => {
    if (telemetryRunId == null) return;

    const poll = async () => {
      const response = await fetch(
        `/api/telemetry-events/${telemetryRunId}?scenario=${scenarioRef.current}`,
      );
      setStatus(await response.json());
    };

    void poll();
    const interval = setInterval(() => void poll(), 1000);
    return () => clearInterval(interval);
  }, [telemetryRunId]);

  const startScenario = (nextScenario: TelemetryScenario) => {
    const nextTelemetryRunId = crypto.randomUUID();
    scenarioRef.current = nextScenario;
    telemetryRunIdRef.current = nextTelemetryRunId;
    setScenario(nextScenario);
    setTelemetryRunId(nextTelemetryRunId);
    setWorkflowRunId(undefined);
    setStatus(undefined);
    setTransportLog([]);
    setMessages([]);

    const selectedScenario = scenarios.find(item => item.id === nextScenario);
    sendMessage(
      { text: selectedScenario?.prompt ?? 'Run telemetry e2e.' },
      {
        body: {
          scenario: nextScenario,
          telemetryRunId: nextTelemetryRunId,
          resetTelemetry: true,
        },
      },
    );
  };

  const running = chatStatus === 'submitted' || chatStatus === 'streaming';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white p-4">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-xl font-semibold">WorkflowAgent Telemetry E2E</h1>
          <p className="mt-1 text-sm text-gray-600">
            Deterministic harness for the stable telemetry API work tracked in
            #15074.
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-lg border bg-white p-3">
            <h2 className="font-semibold">Scenarios</h2>
            <div className="mt-3 space-y-2">
              {scenarios.map(item => (
                <button
                  key={item.id}
                  type="button"
                  disabled={running}
                  onClick={() => startScenario(item.id)}
                  className={`w-full rounded border p-3 text-left transition ${
                    scenario === item.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  } disabled:opacity-50`}
                >
                  <div className="font-medium">{item.title}</div>
                  <div className="mt-1 text-xs text-gray-600">
                    {item.description}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border bg-white p-3 text-xs">
            <h2 className="font-semibold text-sm">Run</h2>
            <dl className="mt-2 space-y-1 font-mono">
              <div>
                <dt className="text-gray-500">chat</dt>
                <dd>{chatStatus}</dd>
              </div>
              <div>
                <dt className="text-gray-500">telemetryRunId</dt>
                <dd className="break-all">{telemetryRunId ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">workflowRunId</dt>
                <dd className="break-all">{workflowRunId ?? '-'}</dd>
              </div>
            </dl>
          </section>
        </aside>

        <div className="grid gap-4">
          <section className="rounded-lg border bg-white">
            <div className="border-b p-3">
              <h2 className="font-semibold">Expected Telemetry</h2>
              <p className="text-xs text-gray-600">
                These checks intentionally track stable telemetry integration
                events. Before #15074 is implemented, the agent callback and
                workflow rows can appear while telemetry rows remain missing.
              </p>
            </div>
            <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {status?.expectations.map(expectation => (
                <div
                  key={expectation.name}
                  className={`rounded border px-3 py-2 text-sm ${
                    expectation.met
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : 'border-gray-200 bg-gray-50 text-gray-500'
                  }`}
                >
                  {expectation.met ? 'PASS' : 'TODO'} {expectation.name}
                </div>
              )) ?? <div className="text-sm text-gray-500">No run yet.</div>}
            </div>
            {status != null && (
              <div className="border-t p-3 text-sm">
                <h3 className="font-medium">Context Filtering</h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {[
                    [
                      'Allowed runtime context observed',
                      status.contextFiltering.includesAllowedRuntimeContext,
                    ],
                    [
                      'Runtime secret excluded',
                      status.contextFiltering.excludesRuntimeSecret,
                    ],
                    [
                      'Tool secrets excluded',
                      status.contextFiltering.excludesToolSecret,
                    ],
                  ].map(([label, met]) => (
                    <div
                      key={String(label)}
                      className={`rounded border px-3 py-2 ${
                        met
                          ? 'border-green-200 bg-green-50 text-green-800'
                          : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      {met ? 'PASS' : 'CHECK'} {label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border bg-white">
              <div className="border-b p-3 font-semibold">Chat</div>
              <div className="max-h-[460px] overflow-y-auto p-3">
                {messages.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Choose a scenario to start.
                  </p>
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
                          const p = part as TelemetryToolPart;
                          const toolName = p.type.replace('tool-', '');
                          if (
                            p.state === 'approval-requested' &&
                            p.approval?.id
                          ) {
                            const approvalId = p.approval.id;
                            return (
                              <div
                                key={index}
                                className="rounded border border-amber-200 bg-amber-50 p-3"
                              >
                                <div className="font-medium text-amber-900">
                                  Approval required for {toolName}
                                </div>
                                <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-xs">
                                  {JSON.stringify(p.input, null, 2)}
                                </pre>
                                <div className="mt-2 flex gap-2">
                                  <button
                                    type="button"
                                    className="rounded bg-green-600 px-3 py-1 text-xs text-white"
                                    onClick={() =>
                                      addToolApprovalResponse({
                                        id: approvalId,
                                        approved: true,
                                      })
                                    }
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded bg-red-600 px-3 py-1 text-xs text-white"
                                    onClick={() =>
                                      addToolApprovalResponse({
                                        id: approvalId,
                                        approved: false,
                                        reason: 'Denied by telemetry e2e page.',
                                      })
                                    }
                                  >
                                    Deny
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <pre
                              key={index}
                              className="mt-2 overflow-x-auto rounded border bg-white p-2 text-xs"
                            >
                              {JSON.stringify(p, null, 2)}
                            </pre>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-white">
              <div className="border-b p-3 font-semibold">
                Telemetry Timeline
              </div>
              <div className="max-h-[460px] overflow-y-auto p-3 font-mono text-xs">
                {status?.events.length ? (
                  status.events.map(event => (
                    <div
                      key={event.id}
                      className="mb-2 rounded border bg-gray-50 p-2"
                    >
                      <div>
                        <span className="text-gray-500">#{event.id}</span>{' '}
                        <span className="font-semibold">{event.source}</span>/
                        {event.name}
                      </div>
                      {event.summary != null && (
                        <pre className="mt-1 overflow-x-auto text-[11px] text-gray-600">
                          {JSON.stringify(event.summary, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No events yet.</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-white">
            <div className="border-b p-3 font-semibold">Transport Log</div>
            <div className="max-h-40 overflow-y-auto p-3 font-mono text-xs">
              {transportLog.length ? (
                transportLog.map((entry, index) => (
                  <div key={index}>{entry}</div>
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  No transport events yet.
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
