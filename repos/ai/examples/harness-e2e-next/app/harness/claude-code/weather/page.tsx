import ChatIdProvider from '@/components/chat-id-provider';
import WeatherClaudeCodeHarnessChat from '@/components/weather-claude-code-harness-chat';

export const metadata = {
  title: 'Claude Code — Weather',
};

const STORAGE_KEY = 'harness-claude-code-weather-chat-id';

export default function HarnessClaudeCodeWeatherPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <WeatherClaudeCodeHarnessChat
        apiRoute="/api/harness/claude-code/weather"
        exampleLabel="Weather"
      />
    </ChatIdProvider>
  );
}
