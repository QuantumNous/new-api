import ChatIdProvider from '@/components/chat-id-provider';
import WeatherPiHarnessChat from '@/components/weather-pi-harness-chat';

export const metadata = {
  title: 'Pi — Weather Approval',
};

const STORAGE_KEY = 'harness-pi-weather-approval-chat-id';

export default function HarnessPiWeatherApprovalPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <WeatherPiHarnessChat
        apiRoute="/api/harness/pi/weather-approval"
        exampleLabel="Weather Approval"
      />
    </ChatIdProvider>
  );
}
