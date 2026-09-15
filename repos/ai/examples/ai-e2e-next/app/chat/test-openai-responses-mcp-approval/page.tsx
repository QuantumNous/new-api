'use client';

import ChatInput from '@/components/chat-input';
import DynamicToolView from '@/components/tool/dynamic-tool-view';
import OpenAIMCPApprovalView from '@/components/tool/openai-mcp-approval-view';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
import type { OpenAIResponsesMCPApprovalMessage } from '@/app/api/chat/openai-responses-mcp-approval/route';

export default function TestOpenAIResponsesMCPApproval() {
  const { status, sendMessage, messages, addToolApprovalResponse } =
    useChat<OpenAIResponsesMCPApprovalMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat/openai-responses-mcp-approval',
      }),
      sendAutomaticallyWhen:
        lastAssistantMessageIsCompleteWithApprovalResponses,
    });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      <h1 className="mb-4 text-xl font-bold">
        OpenAI Responses MCP Tool Approval Test
      </h1>
      <p className="mb-4 text-sm text-gray-600">
        Try asking: &quot;Shorten the link https://ai-sdk.dev/&quot;
      </p>

      {messages.map(message => (
        <div key={message.id} className="mb-4 whitespace-pre-wrap">
          <div className="mb-2 font-semibold">
            {message.role === 'user' ? 'User' : 'AI'}:
          </div>
          {message.parts.map((part, index) => {
            switch (part.type) {
              case 'text':
                return (
                  <div key={index} className="mb-2">
                    {part.text}
                  </div>
                );
              case 'dynamic-tool':
                // MCP tools from OpenAI are dynamic tools - check if it's an MCP tool
                // by looking at the toolName (starts with 'mcp.')
                if (
                  part.toolName.startsWith('mcp.') ||
                  part.toolName === 'mcp'
                ) {
                  return (
                    <div key={index} className="mb-4">
                      <OpenAIMCPApprovalView
                        invocation={part}
                        addToolApprovalResponse={addToolApprovalResponse}
                      />
                    </div>
                  );
                }
                return (
                  <div key={index} className="mb-4">
                    <DynamicToolView invocation={part} />
                  </div>
                );
              case 'step-start':
                return index > 0 ? (
                  <div key={index} className="my-2 border-t border-gray-300" />
                ) : null;
            }
          })}
        </div>
      ))}

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
