---
title: Share useChat State Across Components
description: Learn how to share a chat instance across multiple components with useChat and easily reset the chat.
tags: ['next', 'useChat', 'context']
---

# Share useChat State Across Components

When building chat applications, you may want to access the same chat instance across multiple components. This allows you to display messages in one component, handle input in another, and control the chat state from anywhere in your application.

## Create a Chat Context

First, create a context that will hold your chat instance and provide methods to interact with it.

```tsx filename='app/chat-context.tsx'
'use client';

import React, { createContext, useContext, ReactNode, useState } from 'react';
import { Chat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';

interface ChatContextValue {
  // replace with your custom message type
  chat: Chat<UIMessage>;
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

function createChat() {
  return new Chat<UIMessage>({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chat, setChat] = useState(() => createChat());

  const clearChat = () => {
    setChat(createChat());
  };

  return (
    <ChatContext.Provider
      value={{
        chat,
        clearChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useSharedChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useSharedChatContext must be used within a ChatProvider');
  }
  return context;
}
```

## Wrap Your App with the Provider

Add the ChatProvider to your layout to make the chat context available to all child components.

```tsx filename='app/layout.tsx'
import { ChatProvider } from './chat-context';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ChatProvider>{children}</ChatProvider>;
}
```

## Display Messages and Clear Chat

Create a component that displays messages and provides a button to clear the chat.

```tsx filename='app/page.tsx'
'use client';

import { useChat } from '@ai-sdk/react';
import { useSharedChatContext } from './chat-context';
import ChatInput from './chat-input';

export default function Chat() {
  const { chat, clearChat } = useSharedChatContext();
  const { messages } = useChat({
    chat,
  });

  return (
    <div>
      <button onClick={clearChat} disabled={messages.length === 0}>
        Clear Chat
      </button>

      {messages?.map(message => (
        <div key={message.id}>
          <strong>{`${message.role}: `}</strong>
          {message.parts.map((part, index) => {
            if (part.type === 'text') {
              return <div key={index}>{part.text}</div>;
            }
          })}
        </div>
      ))}

      <ChatInput />
    </div>
  );
}
```

## Handle Input in a Separate Component

Create an input component that uses the shared chat context to send messages.

```tsx filename='app/chat-input.tsx'
import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import { useSharedChatContext } from './chat-context';

export default function ChatInput() {
  const { chat } = useSharedChatContext();
  const [text, setText] = useState('');
  const { status, stop, sendMessage } = useChat({ chat });

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        if (text.trim() === '') return;
        sendMessage({ text });
        setText('');
      }}
    >
      <input
        placeholder="Say something..."
        disabled={status !== 'ready'}
        value={text}
        onChange={e => setText(e.target.value)}
      />
      {stop && (status === 'streaming' || status === 'submitted') && (
        <button type="submit" onClick={stop}>
          Stop
        </button>
      )}
    </form>
  );
}
```

## Server

Create an API route to handle the chat messages using the AI SDK.

```tsx filename='app/api/chat/route.ts'
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  UIMessage,
} from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: 'openai/gpt-4o-mini',
    messages: await convertToModelMessages(messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

<GithubLink link="https://github.com/vercel/ai/tree/main/examples/ai-e2e-next/app/chat/shared-context" />
