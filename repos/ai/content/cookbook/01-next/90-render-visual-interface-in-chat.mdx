---
title: Render Visual Interface in Chat
description: Learn how to render visual interfaces in chat using the AI SDK and Next.js
tags: ['next', 'generative user interface']
---

# Render Visual Interface in Chat

An interesting consequence of language models that can call [tools](/docs/ai-sdk-core/tools-and-tool-calling) is that this ability can be used to render visual interfaces by streaming React components to the client.

<Browser>
  <ChatGeneration
    history={[
      { role: 'User', content: 'How is it going?' },
      { role: 'Assistant', content: 'All good, how may I help you?' },
    ]}
    inputMessage={{
      role: 'User',
      content: 'What is the weather in San Francisco?',
    }}
    outputMessage={{
      role: 'Assistant',
      content: 'The weather is 24°C and sunny in San Francisco.',
      display: (
        <div className="py-4">
          <WeatherCard
            content={{
              weather: {
                temperature: 24,
                condition: 'Sunny',
              },
            }}
          />
        </div>
      ),
    }}
  />
</Browser>

## Client

Let's build an assistant that gets the weather for any city by calling the `getWeatherInformation` tool. Instead of returning text during the tool call, you will render a React component that displays the weather information on the client.

```tsx filename='app/page.tsx'
'use client';

import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';
import { useState } from 'react';
import { ChatMessage } from './api/chat/route';

export default function Chat() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, addToolOutput } = useChat<ChatMessage>({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),

    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,

    // run client-side tools that are automatically executed:
    async onToolCall({ toolCall }) {
      if (toolCall.toolName === 'getLocation') {
        const cities = ['New York', 'Los Angeles', 'Chicago', 'San Francisco'];

        // No await - avoids potential deadlocks
        addToolOutput({
          tool: 'getLocation',
          toolCallId: toolCall.toolCallId,
          output: cities[Math.floor(Math.random() * cities.length)],
        });
      }
    },
  });

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch gap-4">
      {messages?.map(m => (
        <div key={m.id} className="whitespace-pre-wrap flex flex-col gap-1">
          <strong>{`${m.role}: `}</strong>
          {m.parts?.map((part, i) => {
            switch (part.type) {
              case 'text':
                return <div key={m.id + i}>{part.text}</div>;
              // render confirmation tool (client-side tool with user interaction)
              case 'tool-askForConfirmation':
                return (
                  <div
                    key={part.toolCallId}
                    className="text-gray-500 flex flex-col gap-2"
                  >
                    <div className="flex gap-2">
                      {part.state === 'output-available' ? (
                        <b>{part.output}</b>
                      ) : (
                        <>
                          <button
                            className="px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700"
                            onClick={() =>
                              addToolOutput({
                                tool: 'askForConfirmation',
                                toolCallId: part.toolCallId,
                                output: 'Yes, confirmed.',
                              })
                            }
                          >
                            Yes
                          </button>
                          <button
                            className="px-4 py-2 font-bold text-white bg-red-500 rounded hover:bg-red-700"
                            onClick={() =>
                              addToolOutput({
                                tool: 'askForConfirmation',
                                toolCallId: part.toolCallId,
                                output: 'No, denied',
                              })
                            }
                          >
                            No
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );

              // other tools:
              case 'tool-getWeatherInformation':
                if (part.state === 'output-available') {
                  return (
                    <div
                      key={part.toolCallId}
                      className="flex flex-col gap-2 p-4 bg-blue-400 rounded-lg"
                    >
                      <div className="flex flex-row justify-between items-center">
                        <div className="text-4xl text-blue-50 font-medium">
                          {part.output.value}°
                          {part.output.unit === 'celsius' ? 'C' : 'F'}
                        </div>

                        <div className="h-9 w-9 bg-amber-400 rounded-full flex-shrink-0" />
                      </div>
                      <div className="flex flex-row gap-2 text-blue-50 justify-between">
                        {part.output.weeklyForecast.map(forecast => (
                          <div
                            key={forecast.day}
                            className="flex flex-col items-center"
                          >
                            <div className="text-xs">{forecast.day}</div>
                            <div>{forecast.value}°</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                break;
              case 'tool-getLocation':
                if (part.state === 'output-available') {
                  return (
                    <div
                      key={part.toolCallId}
                      className="text-gray-500 bg-gray-100 rounded-lg p-4"
                    >
                      User is in {part.output}.
                    </div>
                  );
                } else {
                  return (
                    <div key={part.toolCallId} className="text-gray-500">
                      Calling getLocation...
                    </div>
                  );
                }

              default:
                break;
            }
          })}
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
          className="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl"
          value={input}
          placeholder="Say something..."
          onChange={e => setInput(e.currentTarget.value)}
        />
      </form>
    </div>
  );
}
```

## Server

```tsx filename='api/chat.ts'
import {
  type InferUITools,
  type ToolSet,
  type UIDataTypes,
  type UIMessage,
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  tool,
} from 'ai';
import { z } from 'zod';

const tools = {
  getWeatherInformation: tool({
    description: 'show the weather in a given city to the user',
    inputSchema: z.object({ city: z.string() }),
    execute: async ({ city }: { city: string }) => {
      return {
        city,
        value: 24,
        unit: 'celsius',
        weeklyForecast: [
          { day: 'Monday', value: 24 },
          { day: 'Tuesday', value: 25 },
          { day: 'Wednesday', value: 26 },
          { day: 'Thursday', value: 27 },
          { day: 'Friday', value: 28 },
          { day: 'Saturday', value: 29 },
          { day: 'Sunday', value: 30 },
        ],
      };
    },
  }),
  // client-side tool that starts user interaction:
  askForConfirmation: tool({
    description: 'Ask the user for confirmation.',
    inputSchema: z.object({
      message: z.string().describe('The message to ask for confirmation.'),
    }),
  }),
  // client-side tool that is automatically executed on the client:
  getLocation: tool({
    description:
      'Get the user location. Always ask for confirmation before using this tool.',
    inputSchema: z.object({}),
  }),
} satisfies ToolSet;

export type ChatTools = InferUITools<typeof tools>;

export type ChatMessage = UIMessage<never, UIDataTypes, ChatTools>;

export async function POST(request: Request) {
  const { messages }: { messages: ChatMessage[] } = await request.json();

  const result = streamText({
    model: 'openai/gpt-4.1',
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: isStepCount(5),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```
