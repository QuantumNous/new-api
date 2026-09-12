'use client';

import { useStreamableValue, type StreamableValue } from '@ai-sdk/rsc';
export function BotMessage({ textStream }: { textStream: StreamableValue }) {
  const [text] = useStreamableValue(textStream);
  return <Message role="assistant">{text}</Message>;
}

export function Message({
  role,
  children,
}: {
  role: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b p-2">
      <div className="flex flex-row justify-between">
        <div className="text-sm text-zinc-500">{role}</div>
      </div>
      {children}
    </div>
  );
}
