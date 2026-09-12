---
title: Restore Messages From Database
description: Learn how to restore messages from an external database using the AI SDK and React Server Components
tags: ['rsc', 'tool use']
---

# Restore Messages from Database

When building AI applications, you might want to restore previous conversations from a database to allow users to continue their conversations or review past interactions. The AI SDK provides mechanisms to restore conversation state through `initialAIState` and `onGetUIState`.

## Client

```tsx filename='app/layout.tsx'
import { ServerMessage } from './actions';
import { AI } from './ai';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch stored messages from your database
  const savedMessages: ServerMessage[] = getSavedMessages();

  return (
    <html lang="en">
      <body>
        <AI initialAIState={savedMessages} initialUIState={[]}>
          {children}
        </AI>
      </body>
    </html>
  );
}
```

```tsx filename='app/page.tsx'
'use client';

import { useState, useEffect } from 'react';
import { ClientMessage } from './actions';
import { useActions, useUIState } from '@ai-sdk/rsc';
import { generateId } from 'ai';

export default function Home() {
  const [conversation, setConversation] = useUIState();
  const [input, setInput] = useState<string>('');
  const { continueConversation } = useActions();

  return (
    <div>
      <div className="conversation-history">
        {conversation.map((message: ClientMessage) => (
          <div key={message.id} className={`message ${message.role}`}>
            {message.role}: {message.display}
          </div>
        ))}
      </div>

      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your message..."
        />
        <button
          onClick={async () => {
            // Add user message to UI
            setConversation((currentConversation: ClientMessage[]) => [
              ...currentConversation,
              { id: generateId(), role: 'user', display: input },
            ]);

            // Get AI response
            const message = await continueConversation(input);

            // Add AI response to UI
            setConversation((currentConversation: ClientMessage[]) => [
              ...currentConversation,
              message,
            ]);

            setInput('');
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

## Server

The server-side implementation handles the restoration of messages and their transformation into the appropriate format for display.

```tsx filename='app/ai.ts'
import { createAI } from '@ai-sdk/rsc';
import { ServerMessage, ClientMessage, continueConversation } from './actions';
import { Stock } from '@ai-studio/components/stock';
import { generateId } from 'ai';

export const AI = createAI<ServerMessage[], ClientMessage[]>({
  actions: {
    continueConversation,
  },
  onGetUIState: async () => {
    'use server';

    // Get the current AI state (stored messages)
    const history: ServerMessage[] = getAIState();

    // Transform server messages into client messages
    return history.map(({ role, content }) => ({
      id: generateId(),
      role,
      display:
        role === 'function' ? <Stock {...JSON.parse(content)} /> : content,
    }));
  },
});
```

```tsx filename='app/actions.tsx'
'use server';

import { getAIState } from '@ai-sdk/rsc';
import type { ReactNode } from 'react';

export interface ServerMessage {
  role: 'user' | 'assistant' | 'function';
  content: string;
}

export interface ClientMessage {
  id: string;
  role: 'user' | 'assistant' | 'function';
  display: ReactNode;
}

// Function to get saved messages from database
export async function getSavedMessages(): Promise<ServerMessage[]> {
  'use server';

  // Implement your database fetching logic here
  return await fetchMessagesFromDatabase();
}
```
