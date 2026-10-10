import ChatIdProvider from '@/components/chat-id-provider';
import WeatherCodexHarnessChat from '@/components/weather-codex-harness-chat';

export const metadata = {
  title: 'Codex — Weather Approval',
};

const STORAGE_KEY = 'harness-codex-weather-approval-chat-id';

export default function HarnessCodexWeatherApprovalPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <WeatherCodexHarnessChat
        apiRoute="/api/harness/codex/weather-approval"
        exampleLabel="Weather Approval"
      />
    </ChatIdProvider>
  );
}
