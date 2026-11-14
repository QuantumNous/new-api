import ChatIdProvider from '@/components/chat-id-provider';
import WeatherDeepAgentsHarnessChat from '@/components/weather-deepagents-harness-chat';

export const metadata = {
  title: 'Deep Agents — Weather',
};

const STORAGE_KEY = 'harness-deepagents-weather-chat-id';

export default function HarnessDeepAgentsWeatherPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <WeatherDeepAgentsHarnessChat
        apiRoute="/api/harness/deepagents/weather-only"
        exampleLabel="Weather"
      />
    </ChatIdProvider>
  );
}
