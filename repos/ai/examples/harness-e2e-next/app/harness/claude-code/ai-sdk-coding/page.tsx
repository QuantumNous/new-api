import ChatIdProvider from '@/components/chat-id-provider';
import ClaudeCodeHarnessChat from '@/components/claude-code-harness-chat';

export const metadata = {
  title: 'Claude Code — AI SDK Checkout',
};

const STORAGE_KEY = 'harness-claude-code-ai-sdk-coding-chat-id';

export default function HarnessClaudeCodeAiSdkCodingPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <ClaudeCodeHarnessChat
        apiRoute="/api/harness/claude-code/ai-sdk-coding"
        exampleLabel="AI SDK Checkout"
      />
    </ChatIdProvider>
  );
}
