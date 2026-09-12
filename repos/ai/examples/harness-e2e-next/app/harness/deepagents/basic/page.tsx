import ChatIdProvider from '@/components/chat-id-provider';
import DeepAgentsHarnessChat from '@/components/deepagents-harness-chat';

export const metadata = {
  title: 'Deep Agents — Basic',
};

const STORAGE_KEY = 'harness-deepagents-basic-chat-id';

export default function HarnessDeepAgentsPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <DeepAgentsHarnessChat
        apiRoute="/api/harness/deepagents/basic"
        exampleLabel="Basic"
      />
    </ChatIdProvider>
  );
}
