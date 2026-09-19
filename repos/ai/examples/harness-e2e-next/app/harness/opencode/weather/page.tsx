import ChatIdProvider from '@/components/chat-id-provider';
import WeatherOpenCodeHarnessChat from '@/components/weather-opencode-harness-chat';

export const metadata = {
  title: 'OpenCode — Weather',
};

const STORAGE_KEY = 'harness-opencode-weather-chat-id';

export default function HarnessOpenCodeWeatherPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <WeatherOpenCodeHarnessChat
        apiRoute="/api/harness/opencode/weather"
        exampleLabel="Weather"
      />
    </ChatIdProvider>
  );
}
