'use client';

import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  getStaticToolName,
  isStaticToolUIPart,
} from 'ai';
import { tools } from '@/app/api/chat/human-in-the-loop/tools';
import {
  APPROVAL,
  getToolsRequiringConfirmation,
} from '@/app/api/chat/human-in-the-loop/utils';
import { useState } from 'react';
import type {
  HumanInTheLoopUIMessage,
  MyTools,
} from '@/app/api/chat/human-in-the-loop/types';

export default function Chat() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, addToolOutput } =
    useChat<HumanInTheLoopUIMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat/human-in-the-loop',
      }),
    });

  const toolsRequiringConfirmation = getToolsRequiringConfirmation(tools);

  const pendingToolCallConfirmation = messages.some(m =>
    m.parts?.some(
      part =>
        isStaticToolUIPart(part) &&
        part.state === 'input-available' &&
        toolsRequiringConfirmation.includes(getStaticToolName(part)),
    ),
  );

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      {messages?.map(m => (
        <div key={m.id} className="whitespace-pre-wrap">
          <strong>{`${m.role}: `}</strong>
          {m.parts?.map((part, i) => {
            if (part.type === 'text') {
              return <div key={i}>{part.text}</div>;
            }
            if (isStaticToolUIPart<MyTools>(part)) {
              const toolInvocation = part;
              const toolName = getStaticToolName(toolInvocation);
              const toolCallId = toolInvocation.toolCallId;
              const dynamicInfoStyles = 'font-mono bg-zinc-100 p-1 text-sm';

              // render confirmation tool (client-side tool with user interaction)
              if (
                toolsRequiringConfirmation.includes(toolName) &&
                toolInvocation.state === 'input-available'
              ) {
                return (
                  <div key={toolCallId}>
                    Run <span className={dynamicInfoStyles}>{toolName}</span>{' '}
                    with args: <br />
                    <span className={dynamicInfoStyles}>
                      {JSON.stringify(toolInvocation.input, null, 2)}
                    </span>
                    <div className="flex gap-2 pt-2">
                      <button
                        className="px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700"
                        onClick={async () => {
                          await addToolOutput({
                            toolCallId,
                            tool: toolName,
                            output: APPROVAL.YES,
                          });
                          // trigger new message
                          // can also use sendAutomaticallyWhen on useChat
                          sendMessage();
                        }}
                      >
                        Yes
                      </button>
                      <button
                        className="px-4 py-2 font-bold text-white bg-red-500 rounded hover:bg-red-700"
                        onClick={async () => {
                          await addToolOutput({
                            toolCallId,
                            tool: toolName,
                            output: APPROVAL.NO,
                          });
                          // trigger new message
                          // can also use sendAutomaticallyWhen on useChat
                          sendMessage();
                        }}
                      >
                        No
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={toolCallId}>
                  <div className="font-mono text-sm bg-zinc-100 w-fit">
                    call
                    {toolInvocation.state === 'output-available'
                      ? 'ed'
                      : 'ing'}{' '}
                    {toolName}
                    {part.output && (
                      <div>{JSON.stringify(part.output, null, 2)}</div>
                    )}
                  </div>
                </div>
              );
            }
          })}
          <br />
        </div>
      ))}

      <form
        onSubmit={e => {
          e.preventDefault();
          sendMessage({ text: input });
          setInput('');
        }}
      >
        <input
          disabled={pendingToolCallConfirmation}
          className="fixed bottom-0 p-2 mb-8 w-full max-w-md rounded border shadow-xl border-zinc-300"
          value={input}
          placeholder="Say something..."
          onChange={e => setInput(e.target.value)}
        />
      </form>
    </div>
  );
}
