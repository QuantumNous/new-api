import ChatIdProvider from '@/components/chat-id-provider';
import OpenCodeHarnessChat from '@/components/opencode-harness-chat';

export const metadata = {
  title: 'OpenCode — AI SDK Checkout',
};

const STORAGE_KEY = 'harness-opencode-ai-sdk-coding-chat-id';

export default function HarnessOpenCodeAiSdkCodingPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <OpenCodeHarnessChat
        apiRoute="/api/harness/opencode/ai-sdk-coding"
        exampleLabel="AI SDK Checkout"
      />
    </ChatIdProvider>
  );
}
