import ChatIdProvider from '@/components/chat-id-provider';
import OpenCodeHarnessChat from '@/components/opencode-harness-chat';

export const metadata = {
  title: 'OpenCode — Basic (with stop)',
};

const STORAGE_KEY = 'harness-opencode-basic-with-stop-chat-id';

export default function HarnessOpenCodeBasicWithStopPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <OpenCodeHarnessChat
        apiRoute="/api/harness/opencode/basic-with-stop"
        exampleLabel="Basic (with stop)"
      />
    </ChatIdProvider>
  );
}
