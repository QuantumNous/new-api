import { useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageItem } from '@/components/molecules/MessageItem';
import { TypingIndicator } from '@/components/molecules/TypingIndicator';
import { WelcomeScreen } from '@/components/molecules/WelcomeScreen';
import { Message, Model, Conversation } from '@/types/chat';

interface MessageListProps {
  currentConversation: Conversation | null;
  selectedModel: Model;
  messages: Message[];
  isTyping: boolean;
  copiedMessageId: string | null;
  onCopy: (content: string, messageId: string) => void;
  onSuggestionClick: (suggestion: string) => void;
}

export function MessageList({
  currentConversation,
  selectedModel,
  messages,
  isTyping,
  copiedMessageId,
  onCopy,
  onSuggestionClick,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  return (
    <ScrollArea className="flex-1">
      <div className="max-w-3xl mx-auto p-4 space-y-6 pb-4">
        {!currentConversation ? (
           <WelcomeScreen model={selectedModel} onSuggestionClick={onSuggestionClick} />
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">
            开始新的对话...
          </div>
        ) : (
          messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              copiedMessageId={copiedMessageId}
              onCopy={onCopy}
            />
          ))
        )}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} className="h-4" />
      </div>
    </ScrollArea>
  );
}
