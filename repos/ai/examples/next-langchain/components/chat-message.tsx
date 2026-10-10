'use client';

import {
  isDataUIPart,
  isTextUIPart,
  isReasoningUIPart,
  isFileUIPart,
  isToolUIPart,
} from 'ai';
import { Reasoning, Text, File, ToolInvocation } from './message-parts';
import { DataProgress, DataStatus, DataFileStatus } from './data-parts';
import type { CustomDataMessage } from '../app/types';

interface ChatMessageProps {
  message: CustomDataMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          isUser
            ? 'bg-gradient-to-br from-amber-500 to-orange-400 text-white'
            : 'bg-gradient-to-br from-amber-700 to-yellow-600 text-white'
        }`}
      >
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Message content */}
      <div
        className={`flex-1 max-w-[85%] ${isUser ? 'flex flex-col items-end' : ''}`}
      >
        <div
          className={`px-4 py-3 rounded-2xl flex flex-col gap-3 ${
            isUser
              ? 'bg-[var(--accent)] text-white rounded-tr-md'
              : 'bg-[var(--background-tertiary)] border border-[var(--border)] rounded-tl-md'
          }`}
        >
          {message.parts.map((part, i) => {
            // Handle reasoning parts (extended thinking)
            if (isReasoningUIPart(part)) {
              return (
                <Reasoning
                  key={i}
                  text={part.text}
                  state={part.state || 'done'}
                />
              );
            }

            // Handle text parts
            if (isTextUIPart(part)) {
              return <Text key={i} text={part.text} />;
            }

            // Handle file parts (including generated images)
            if (isFileUIPart(part)) {
              return <File key={i} url={part.url} mediaType={part.mediaType} />;
            }

            // Handle tool parts
            if (isToolUIPart(part)) {
              const toolName =
                'toolName' in part
                  ? part.toolName
                  : part.type.replace('tool-', '');
              const input = 'input' in part ? part.input : undefined;
              const output = 'output' in part ? part.output : undefined;

              return (
                <ToolInvocation
                  key={i}
                  toolName={toolName}
                  input={input}
                  output={output}
                />
              );
            }
            // Handle custom data parts (data-progress, data-status, data-file-status, etc.)
            if (isDataUIPart(part)) {
              if (part.type === 'data-progress') {
                return (
                  <DataProgress
                    key={i}
                    step={part.data.step}
                    message={part.data.message}
                    progress={part.data.progress}
                    currentStep={part.data.currentStep}
                    totalSteps={part.data.totalSteps}
                  />
                );
              }

              if (part.type === 'data-status') {
                return (
                  <DataStatus
                    key={i}
                    status={part.data.status}
                    message={part.data.message}
                  />
                );
              }

              if (part.type === 'data-file-status') {
                return (
                  <DataFileStatus
                    key={i}
                    filename={part.data.filename}
                    operation={part.data.operation}
                    status={part.data.status}
                    size={part.data.size}
                  />
                );
              }

              return null;
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}
