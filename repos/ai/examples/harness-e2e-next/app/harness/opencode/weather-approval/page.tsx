import ChatIdProvider from '@/components/chat-id-provider';
import WeatherOpenCodeHarnessChat from '@/components/weather-opencode-harness-chat';

export const metadata = {
  title: 'OpenCode — Weather Approval',
};

const STORAGE_KEY = 'harness-opencode-weather-approval-chat-id';

export default function HarnessOpenCodeWeatherApprovalPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <WeatherOpenCodeHarnessChat
        apiRoute="/api/harness/opencode/weather-approval"
        exampleLabel="Weather Approval"
      />
    </ChatIdProvider>
  );
}
