import ChatIdProvider from '@/components/chat-id-provider';
import ClaudeCodeHarnessChat from '@/components/claude-code-harness-chat';

export const metadata = {
  title: 'Claude Code — Basic (with stop)',
};

const STORAGE_KEY = 'harness-claude-code-basic-with-stop-chat-id';

export default function HarnessClaudeCodeBasicWithStopPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <ClaudeCodeHarnessChat
        apiRoute="/api/harness/claude-code/basic-with-stop"
        exampleLabel="Basic (with stop)"
      />
    </ChatIdProvider>
  );
}
