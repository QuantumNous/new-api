import ChatIdProvider from '@/components/chat-id-provider';
import OpenCodeHarnessChat from '@/components/opencode-harness-chat';

export const metadata = {
  title: 'OpenCode — Basic',
};

const STORAGE_KEY = 'harness-opencode-basic-chat-id';

export default function HarnessOpenCodePage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <OpenCodeHarnessChat
        apiRoute="/api/harness/opencode/basic"
        exampleLabel="Basic"
      />
    </ChatIdProvider>
  );
}
