import ChatIdProvider from '@/components/chat-id-provider';
import CodexHarnessChat from '@/components/codex-harness-chat';

export const metadata = {
  title: 'Codex — Basic (with stop)',
};

const STORAGE_KEY = 'harness-codex-basic-with-stop-chat-id';

export default function HarnessCodexBasicWithStopPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <CodexHarnessChat
        apiRoute="/api/harness/codex/basic-with-stop"
        exampleLabel="Basic (with stop)"
      />
    </ChatIdProvider>
  );
}
