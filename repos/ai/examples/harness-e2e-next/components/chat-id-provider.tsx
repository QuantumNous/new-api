'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

type ChatIdContextValue = {
  chatId: string;
  resetChatId: () => void;
};

const ChatIdContext = createContext<ChatIdContextValue | null>(null);

export function useChatId(): ChatIdContextValue {
  const value = useContext(ChatIdContext);
  if (!value) {
    throw new Error('useChatId must be used within a ChatIdProvider');
  }
  return value;
}

export default function ChatIdProvider({
  storageKey,
  children,
}: {
  storageKey: string;
  children: ReactNode;
}) {
  const [chatId, setChatId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) {
      setChatId(existing);
      return;
    }
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(storageKey, fresh);
    setChatId(fresh);
  }, [storageKey]);

  if (chatId === undefined) {
    return null;
  }

  return (
    <ChatIdContext.Provider
      value={{
        chatId,
        resetChatId: () => {
          window.localStorage.removeItem(storageKey);
          window.location.reload();
        },
      }}
    >
      {children}
    </ChatIdContext.Provider>
  );
}
