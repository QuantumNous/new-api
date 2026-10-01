'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ChatContainer } from '../../components/chat-container';
import type { CustomDataMessage } from '../types';

const transport = new DefaultChatTransport({
  api: '/api/custom-data',
});

export default function CustomDataPage() {
  const { messages, sendMessage, status, error } = useChat<CustomDataMessage>({
    transport,
  });

  return (
    <>
      <ChatContainer
        title="Custom Data Parts Demo"
        description={
          <>
            Demonstrates <strong>typed custom streaming events</strong> with
            LangGraph. Tools emit progress updates using{' '}
            <code>
              config.writer(&#123; type: &apos;progress&apos;, ... &#125;)
            </code>
            , which the adapter converts to typed data parts like{' '}
            <code>data-progress</code>. Watch the live panel on the right for
            real-time events!
          </>
        }
        messages={messages}
        onSend={text => sendMessage({ text })}
        status={status}
        error={error}
        placeholder="Try: 'Analyze sales data for trends' or 'Process report.pdf file'"
        suggestions={[
          'Analyze sales data for trends',
          'Run anomaly analysis on customer data',
          'Process quarterly-report.csv and validate it',
          'Analyze transactions for correlations',
        ]}
      />
    </>
  );
}
