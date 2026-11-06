'use client';

import { invalidateRouterCache } from '@/app/actions';
import type { MyUIMessage } from '@/util/chat-schema';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useRef } from 'react';
import ChatInput from './chat-input';
import Message from './message';

export default function ChatComponent({
  chatData,
  isNewChat = false,
  resume = false,
}: {
  chatData: { id: string; messages: MyUIMessage[] };
  isNewChat?: boolean;
  resume?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const { status, sendMessage, messages, regenerate, stop } = useChat({
    id: chatData.id,
    messages: chatData.messages,
    resume,
    transport: new DefaultChatTransport({
      prepareSendMessagesRequest: ({ id, messages, trigger, messageId }) => {
        switch (trigger) {
          case 'regenerate-message':
            // omit messages data transfer, only send the messageId:
            return {
              body: {
                trigger: 'regenerate-message',
                id,
                messageId,
              },
            };

          case 'submit-message':
            // only send the last message to the server to limit the request size:
            return {
              body: {
                trigger: 'submit-message',
                id,
                message: messages[messages.length - 1],
                messageId,
              },
            };
        }
      },
    }),
    onFinish(options) {
      console.log('onFinish', options);

      // for new chats, the router cache needs to be invalidated so
      // navigation to the previous page triggers SSR correctly
      if (isNewChat) {
        invalidateRouterCache();
      }

      // focus the input field again after the response is finished
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    },
  });

  // activate the input field
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      {messages.map(message => (
        <Message
          key={message.id}
          message={message}
          regenerate={regenerate}
          sendMessage={sendMessage}
          status={status}
        />
      ))}
      <ChatInput
        status={status}
        stop={() => {
          // send stop with chat id to the new api route
          fetch(`/api/chat/${chatData.id}/stream`, {
            method: 'DELETE',
          });
        }}
        onSubmit={text => {
          sendMessage({ text, metadata: { createdAt: Date.now() } });

          if (isNewChat) {
            window.history.pushState(null, '', `/chat/${chatData.id}`);
          }
        }}
        inputRef={inputRef}
      />
    </div>
  );
}
