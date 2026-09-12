'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import ChatInput from '@/components/chat-input';
import type { OpenAIShellContainerSkillsMessage } from '@/agent/openai/shell-container-skills-agent';

export default function ChatOpenAIShellContainerSkills() {
  const { status, sendMessage, messages } =
    useChat<OpenAIShellContainerSkillsMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat/openai-shell-container-skills',
      }),
    });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-4xl stretch">
      <h1 className="mb-2 text-xl font-bold text-black">
        OpenAI Shell Tool (Container with Skills)
      </h1>
      <h2 className="pb-2 mb-4 border-b text-black">
        Commands are executed server-side by OpenAI in a hosted container. The
        container has an &quot;island-rescue&quot; skill installed. No approval
        is needed since commands run remotely on OpenAI infrastructure.
      </h2>

      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap mb-4">
          <div className="mb-2">
            <div className="text-sm font-semibold text-black mb-1">
              {message.role === 'user' ? 'User:' : 'Assistant:'}
            </div>
            <div className="space-y-4">
              {message.parts.map((part, index) => {
                switch (part.type) {
                  case 'text':
                    return (
                      <div key={index} className="text-black">
                        {part.text}
                      </div>
                    );
                  case 'tool-shell': {
                    const commands = part.input?.action?.commands || [];
                    const outputs =
                      part.state === 'output-available'
                        ? part.output?.output || []
                        : [];

                    return (
                      <div
                        key={index}
                        className="p-2 mb-2 bg-white rounded-xl border border-gray-300 shadow-lg"
                      >
                        <div className="px-6 py-3 bg-gray-100 rounded-t-xl border-b border-gray-300">
                          <div className="overflow-hidden tracking-wide text-black whitespace-nowrap text-xxs font-small text-ellipsis">
                            Shell Execution (Container)
                          </div>
                        </div>

                        <div className="p-6 space-y-4">
                          {commands.map((cmd, cmdIndex) => {
                            const output = outputs[cmdIndex];
                            const outcome = output?.outcome;

                            return (
                              <div key={cmdIndex} className="space-y-2">
                                <div>
                                  <div className="mb-2 text-sm font-medium text-black">
                                    Command {cmdIndex + 1}:
                                  </div>
                                  <pre className="overflow-x-auto p-4 text-sm text-black whitespace-pre-wrap bg-gray-100 rounded-lg border border-gray-300">
                                    {cmd}
                                  </pre>
                                </div>

                                {outcome && (
                                  <div className="space-y-2">
                                    <div className="p-3 bg-gray-100 border border-gray-300 rounded-lg">
                                      <div className="text-xs text-black mb-1">
                                        {outcome.type === 'timeout'
                                          ? 'Timeout'
                                          : `Exit Code: ${outcome.exitCode}`}
                                      </div>
                                    </div>

                                    {output.stdout && (
                                      <div>
                                        <div className="mb-2 text-sm font-medium text-black">
                                          Output:
                                        </div>
                                        <div className="p-3 bg-gray-100 rounded-lg border border-gray-300">
                                          <div className="font-mono text-sm text-black whitespace-pre-wrap">
                                            {output.stdout}
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {output.stderr && (
                                      <div>
                                        <div className="mb-2 text-sm font-medium text-black">
                                          Error:
                                        </div>
                                        <div className="p-3 bg-red-50 rounded-lg border border-red-300">
                                          <div className="font-mono text-sm text-red-600 whitespace-pre-wrap">
                                            {output.stderr}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  default:
                    return null;
                }
              })}
            </div>
          </div>
        </div>
      ))}

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
