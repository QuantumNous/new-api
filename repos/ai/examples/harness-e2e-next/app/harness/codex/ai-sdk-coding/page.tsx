import ChatIdProvider from '@/components/chat-id-provider';
import CodexHarnessChat from '@/components/codex-harness-chat';

export const metadata = {
  title: 'Codex — AI SDK Checkout',
};

const STORAGE_KEY = 'harness-codex-ai-sdk-coding-chat-id';

export default function HarnessCodexAiSdkCodingPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <CodexHarnessChat
        apiRoute="/api/harness/codex/ai-sdk-coding"
        exampleLabel="AI SDK Checkout"
      />
    </ChatIdProvider>
  );
}
