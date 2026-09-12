import ChatIdProvider from '@/components/chat-id-provider';
import CodexHarnessChat from '@/components/codex-harness-chat';

export const metadata = {
  title: 'Codex — Workflow',
};

const STORAGE_KEY = 'harness-codex-workflow-chat-id';

export default function HarnessCodexWorkflowPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <CodexHarnessChat
        apiRoute="/api/harness/codex/workflow"
        exampleLabel="Workflow"
      />
    </ChatIdProvider>
  );
}
