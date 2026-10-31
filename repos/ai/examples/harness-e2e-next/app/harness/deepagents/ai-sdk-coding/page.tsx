import ChatIdProvider from '@/components/chat-id-provider';
import DeepAgentsHarnessChat from '@/components/deepagents-harness-chat';

export const metadata = {
  title: 'Deep Agents — AI SDK Coding',
};

const STORAGE_KEY = 'harness-deepagents-ai-sdk-coding-chat-id';

export default function HarnessDeepAgentsAiSdkCodingPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <DeepAgentsHarnessChat
        apiRoute="/api/harness/deepagents/ai-sdk-coding"
        exampleLabel="AI SDK Coding"
      />
    </ChatIdProvider>
  );
}
