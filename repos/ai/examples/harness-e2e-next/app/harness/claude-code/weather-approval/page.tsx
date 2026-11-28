import ChatIdProvider from '@/components/chat-id-provider';
import WeatherClaudeCodeHarnessChat from '@/components/weather-claude-code-harness-chat';

export const metadata = {
  title: 'Claude Code — Weather Approval',
};

const STORAGE_KEY = 'harness-claude-code-weather-approval-chat-id';

export default function HarnessClaudeCodeWeatherApprovalPage() {
  return (
    <ChatIdProvider storageKey={STORAGE_KEY}>
      <WeatherClaudeCodeHarnessChat
        apiRoute="/api/harness/claude-code/weather-approval"
        exampleLabel="Weather Approval"
      />
    </ChatIdProvider>
  );
}
