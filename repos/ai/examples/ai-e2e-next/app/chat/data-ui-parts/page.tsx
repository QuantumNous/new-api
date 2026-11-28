'use client';

import ChatInput from '@/components/chat-input';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type FinishReason, type UIMessage } from 'ai';
import { useState } from 'react';

type MyMessage = UIMessage<
  never,
  {
    weather: {
      city: string;
      weather: string;
      status: 'loading' | 'success';
    };
  }
>;

export default function Chat() {
  const [lastFinishReason, setLastFinishReason] = useState<
    FinishReason | undefined
  >(undefined);
  const { error, status, sendMessage, messages, regenerate, stop } =
    useChat<MyMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat/data-ui-parts',
      }),
      onData: dataPart => {
        console.log('dataPart', JSON.stringify(dataPart, null, 2));
      },
      onFinish: ({ finishReason }) => {
        setLastFinishReason(finishReason);
      },
    });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap">
          {message.role === 'user' ? 'User: ' : 'AI: '}{' '}
          {message.parts
            .filter(part => part.type === 'data-weather')
            .map((part, index) => (
              <span
                key={index}
                style={{
                  border: '2px solid red',
                  padding: '2px',
                  borderRadius: '4px',
                  display: 'inline-block',
                  minWidth: '180px',
                }}
              >
                {part.data.status === 'loading' ? (
                  <>
                    Getting weather for <b>{part.data.city}</b>...
                  </>
                ) : part.data.status === 'success' ? (
                  <>
                    Weather in <b>{part.data.city}</b>:{' '}
                    <b>{part.data.weather}</b>
                  </>
                ) : (
                  <>Unknown weather state</>
                )}
              </span>
            ))}
          {message.parts
            .filter(part => part.type !== 'data-weather')
            .map((part, index) => {
              if (part.type === 'text') {
                return <div key={index}>{part.text}</div>;
              }
            })}
        </div>
      ))}

      {(status === 'submitted' || status === 'streaming') && (
        <div className="mt-4 text-gray-500">
          {status === 'submitted' && <div>Loading...</div>}
          <button
            type="button"
            className="px-4 py-2 mt-4 text-blue-500 rounded-md border border-blue-500"
            onClick={stop}
          >
            Stop
          </button>
        </div>
      )}

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

      {messages.length > 0 && (
        <div className="mt-4 text-gray-500">
          Finish reason: {String(lastFinishReason)}
        </div>
      )}

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
