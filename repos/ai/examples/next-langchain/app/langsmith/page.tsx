'use client';

import { useChat } from '@ai-sdk/react';
import { LangSmithDeploymentTransport } from '@ai-sdk/langchain';
import { useState, useMemo } from 'react';
import { ChatContainer } from '../../components/chat-container';
import { LangsmithConfigPanel } from '../../components/langsmith-config-panel';
import type { CustomDataMessage } from '../types';

const LOCAL_DEV_URL = 'http://localhost:2024';

export default function LangSmithPage() {
  const [customUrl, setCustomUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  const deploymentUrl = customUrl || LOCAL_DEV_URL;

  const transport = useMemo(
    () =>
      new LangSmithDeploymentTransport({
        url: deploymentUrl,
        apiKey: apiKey || undefined,
      }),
    [deploymentUrl, apiKey],
  );

  const { messages, sendMessage, status, error } = useChat<CustomDataMessage>({
    transport,
  });

  return (
    <ChatContainer
      title="LangSmith Deployment"
      description={
        <>
          Uses <code>LangSmithDeploymentTransport</code> to communicate directly
          from the browser to a LangGraph deployment, bypassing the Next.js API
          route.
        </>
      }
      messages={messages}
      onSend={text => sendMessage({ text })}
      status={status}
      error={error}
      placeholder="Send a message..."
      suggestions={[
        "What's the weather in Paris?",
        'Calculate 25 * 4 + 10',
        'Tell me a fun fact',
      ]}
      configPanel={
        <LangsmithConfigPanel
          deploymentUrl={deploymentUrl}
          customUrl={customUrl}
          setCustomUrl={setCustomUrl}
          apiKey={apiKey}
          setApiKey={setApiKey}
          localDevUrl={LOCAL_DEV_URL}
        />
      }
    />
  );
}
