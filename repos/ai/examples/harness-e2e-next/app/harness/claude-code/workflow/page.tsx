import ChatIdProvider from '@/components/chat-id-provider';
import ClaudeCodeHarnessChat from '@/components/claude-code-harness-chat';

export const metadata = {
  title: 'Claude Code — Workflow',
};

const STORAGE_KEY = 'harness-claude-code-workflow-chat-id';

export default function HarnessClaudeCodeWorkflowPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <ClaudeCodeHarnessChat
        apiRoute="/api/harness/claude-code/workflow"
        exampleLabel="Workflow"
      />
    </ChatIdProvider>
  );
}
