import ChatIdProvider from '@/components/chat-id-provider';
import CodexHarnessChat from '@/components/codex-harness-chat';

export const metadata = {
  title: 'Codex — Basic',
};

const STORAGE_KEY = 'harness-codex-basic-chat-id';

export default function HarnessCodexPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <CodexHarnessChat
        apiRoute="/api/harness/codex/basic"
        exampleLabel="Basic"
      />
    </ChatIdProvider>
  );
}
