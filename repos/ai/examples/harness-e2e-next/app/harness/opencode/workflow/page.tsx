import ChatIdProvider from '@/components/chat-id-provider';
import OpenCodeHarnessChat from '@/components/opencode-harness-chat';

export const metadata = {
  title: 'OpenCode — Workflow',
};

const STORAGE_KEY = 'harness-opencode-workflow-chat-id';

export default function HarnessOpenCodeWorkflowPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <OpenCodeHarnessChat
        apiRoute="/api/harness/opencode/workflow"
        exampleLabel="Workflow"
      />
    </ChatIdProvider>
  );
}
