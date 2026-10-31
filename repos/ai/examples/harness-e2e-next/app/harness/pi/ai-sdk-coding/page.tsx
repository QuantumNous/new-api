import ChatIdProvider from '@/components/chat-id-provider';
import PiHarnessChat from '@/components/pi-harness-chat';

export const metadata = {
  title: 'Pi — AI SDK Checkout',
};

const STORAGE_KEY = 'harness-pi-ai-sdk-coding-chat-id';

export default function HarnessPiAiSdkCodingPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <PiHarnessChat
        apiRoute="/api/harness/pi/ai-sdk-coding"
        exampleLabel="AI SDK Checkout"
      />
    </ChatIdProvider>
  );
}
