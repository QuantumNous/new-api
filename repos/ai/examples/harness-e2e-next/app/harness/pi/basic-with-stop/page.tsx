import ChatIdProvider from '@/components/chat-id-provider';
import PiHarnessChat from '@/components/pi-harness-chat';

export const metadata = {
  title: 'Pi — Basic (with stop)',
};

const STORAGE_KEY = 'harness-pi-basic-with-stop-chat-id';

export default function HarnessPiBasicWithStopPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <PiHarnessChat
        apiRoute="/api/harness/pi/basic-with-stop"
        exampleLabel="Basic (with stop)"
      />
    </ChatIdProvider>
  );
}
