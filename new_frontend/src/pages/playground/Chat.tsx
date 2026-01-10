import { useState, useEffect } from 'react';
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConversationSidebar } from '@/components/organisms/ConversationSidebar';
import { ChatHeader } from '@/components/organisms/ChatHeader';
import { MessageList } from '@/components/organisms/MessageList';
import { ChatInput } from '@/components/molecules/ChatInput';
import { ChatSettings } from '@/components/molecules/ChatSettings';
import { Message, Conversation } from '@/types/chat';
import { MODELS } from '@/constants/chat';

export default function Chat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [showSettings, setShowSettings] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [isTyping, setIsTyping] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const currentConversation: Conversation | null = conversations.find(c => c.id === currentConversationId) || null;
  const messages = currentConversation?.messages || [];

  useEffect(() => {
    const scrollToBottom = () => {
      const messagesEnd = document.querySelector('[data-messages-end]');
      messagesEnd?.scrollIntoView({ behavior: 'smooth' });
    };
    scrollToBottom();
  }, [messages, currentConversationId]);

  const createNewConversation = () => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: '新对话',
      model: selectedModel,
      messages: [],
      updatedAt: new Date(),
    };
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newConversation.id);
  };

  const deleteConversation = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConversationId === id) {
      setCurrentConversationId(null);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    let conversation = currentConversation;
    
    if (!conversation) {
      const newConversation: Conversation = {
        id: Date.now().toString(),
        title: input.slice(0, 20) + (input.length > 20 ? '...' : ''),
        model: selectedModel,
        messages: [],
        updatedAt: new Date(),
      };
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversationId(newConversation.id);
      conversation = newConversation;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setConversations(prev => 
      prev.map(c => 
        c.id === conversation!.id 
          ? { ...c, messages: [...c.messages, userMessage], updatedAt: new Date() }
          : c
      )
    );
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `这是来自 **${selectedModel.name}** 的模拟响应。\n\n你发送了：\n> ${userMessage.content}\n\n这是一个 Markdown 示例列表：\n- 第一点\n- 第二点\n\n\`\`\`javascript\nconsole.log("Hello World");\n\`\`\``,
        timestamp: new Date(),
      };
      
      setConversations(prev => 
        prev.map(c => 
          c.id === conversation!.id 
            ? { ...c, messages: [...c.messages, assistantMessage], updatedAt: new Date() }
            : c
        )
      );
      setIsTyping(false);
    }, 1500);
  };

  const copyMessage = (content: string, messageId: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  return (
    <TooltipProvider>
      <div className="h-[calc(100vh-4rem)] bg-background overflow-hidden flex">
        <ConversationSidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onNewConversation={createNewConversation}
          onSelectConversation={setCurrentConversationId}
          onDeleteConversation={deleteConversation}
        />

        <div className="flex-1 flex flex-col bg-background relative">
          <ChatHeader
            currentTitle={currentConversation?.title || '新对话'}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            models={MODELS}
            onToggleSettings={() => setShowSettings(!showSettings)}
          />

          <MessageList
            currentConversation={currentConversation || null}
            selectedModel={selectedModel}
            messages={messages}
            isTyping={isTyping}
            copiedMessageId={copiedMessageId}
            onCopy={copyMessage}
            onSuggestionClick={setInput}
          />

          <ChatInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            disabled={isTyping}
          />
        </div>

        <ChatSettings
          open={showSettings}
          onClose={() => setShowSettings(false)}
          temperature={temperature}
          onTemperatureChange={setTemperature}
          maxTokens={maxTokens}
          onMaxTokensChange={setMaxTokens}
        />
      </div>
    </TooltipProvider>
  );
}
