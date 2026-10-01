'use client';

import type { AnthropicProgrammaticToolCallingMessage } from '@/agent/anthropic/programmatic-tool-calling-agent';
import { Response } from '@/components/ai-elements/response';
import ChatInput from '@/components/chat-input';
import AnthropicCodeExecution20260120View from '@/components/tool/anthropic-code-execution-20260120-view';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function ChatAnthropicProgrammaticToolCalling() {
  const { error, status, sendMessage, messages, regenerate } =
    useChat<AnthropicProgrammaticToolCallingMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat/anthropic-programmatic-tool-calling',
      }),
    });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      <h1 className="mb-4 text-xl font-bold">
        Anthropic Programmatic Tool Calling
      </h1>
      <p className="mb-4 text-sm text-gray-600">
        This example demonstrates programmatic tool calling, where Claude can
        write code that calls tools programmatically within a code execution
        container.
      </p>
      <p className="mb-4 text-sm text-gray-500">
        Try: &quot;Two players are playing a dice game. Each round both players
        roll a die. The player with the higher roll wins the round. The first
        player to win 3 rounds wins the game.&quot;
      </p>

      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap">
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.parts.map((part, index) => {
            switch (part.type) {
              case 'text': {
                return <Response key={index}>{part.text}</Response>;
              }
              case 'tool-code_execution': {
                return (
                  <AnthropicCodeExecution20260120View
                    invocation={part}
                    key={index}
                  />
                );
              }
              case 'tool-rollDie': {
                return (
                  <div key={index} className="text-gray-500">
                    {part.state === 'output-available'
                      ? `🎲 ${part.input.player} rolled: ${part.output.roll}`
                      : `🎲 ${part.input?.player ?? 'Player'} rolling...`}
                  </div>
                );
              }
            }
          })}
        </div>
      ))}

      {error && (
        <div className="mt-4">
          <div className="text-red-500">An error occurred.</div>
          <button
            type="button"
            className="px-4 py-2 mt-4 text-blue-500 rounded-md border border-blue-500"
            onClick={() => regenerate()}
          >
            Retry
          </button>
        </div>
      )}

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
