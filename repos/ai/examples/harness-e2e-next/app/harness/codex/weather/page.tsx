import ChatIdProvider from '@/components/chat-id-provider';
import WeatherCodexHarnessChat from '@/components/weather-codex-harness-chat';

export const metadata = {
  title: 'Codex — Weather',
};

const STORAGE_KEY = 'harness-codex-weather-chat-id';

export default function HarnessCodexWeatherPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <WeatherCodexHarnessChat
        apiRoute="/api/harness/codex/weather"
        exampleLabel="Weather"
      />
    </ChatIdProvider>
  );
}
