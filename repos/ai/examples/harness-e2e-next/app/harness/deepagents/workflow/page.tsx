import ChatIdProvider from '@/components/chat-id-provider';
import DeepAgentsHarnessChat from '@/components/deepagents-harness-chat';

export const metadata = {
  title: 'Deep Agents — Workflow',
};

const STORAGE_KEY = 'harness-deepagents-workflow-chat-id';

export default function HarnessDeepAgentsWorkflowPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <DeepAgentsHarnessChat
        apiRoute="/api/harness/deepagents/workflow"
        exampleLabel="Workflow"
      />
    </ChatIdProvider>
  );
}
