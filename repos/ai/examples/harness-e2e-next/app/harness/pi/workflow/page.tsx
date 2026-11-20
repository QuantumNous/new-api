import ChatIdProvider from '@/components/chat-id-provider';
import PiHarnessChat from '@/components/pi-harness-chat';

export const metadata = {
  title: 'Pi — Workflow',
};

const STORAGE_KEY = 'harness-pi-workflow-chat-id';

export default function HarnessPiWorkflowPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <PiHarnessChat
        apiRoute="/api/harness/pi/workflow"
        exampleLabel="Workflow"
      />
    </ChatIdProvider>
  );
}
