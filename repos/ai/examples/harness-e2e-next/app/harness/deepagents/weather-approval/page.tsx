import ChatIdProvider from '@/components/chat-id-provider';
import WeatherDeepAgentsHarnessChat from '@/components/weather-deepagents-harness-chat';

export const metadata = {
  title: 'Deep Agents — Weather Approval',
};

const STORAGE_KEY = 'harness-deepagents-weather-approval-chat-id';

export default function HarnessDeepAgentsWeatherApprovalPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <WeatherDeepAgentsHarnessChat
        apiRoute="/api/harness/deepagents/weather-approval"
        exampleLabel="Weather Approval"
      />
    </ChatIdProvider>
  );
}
