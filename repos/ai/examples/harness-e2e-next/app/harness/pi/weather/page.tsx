import ChatIdProvider from '@/components/chat-id-provider';
import WeatherPiHarnessChat from '@/components/weather-pi-harness-chat';

export const metadata = {
  title: 'Pi — Weather',
};

const STORAGE_KEY = 'harness-pi-weather-chat-id';

export default function HarnessPiWeatherPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <WeatherPiHarnessChat
        apiRoute="/api/harness/pi/weather"
        exampleLabel="Weather"
      />
    </ChatIdProvider>
  );
}
