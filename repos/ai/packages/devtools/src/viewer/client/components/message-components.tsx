import React from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import type {
  ParsedInput,
  PromptMessage,
  ContentPart,
  ToolCallContentPart,
  ToolResultContentPart,
} from '../types';
import {
  safeParseJson,
  formatToolParamsInline,
  formatResultPreview,
} from '../utils';
import {
  CollapsibleToolCall,
  CollapsibleToolResult,
  ReasoningBlock,
  TextBlock,
} from './shared-components';

export function InputPanel({ input }: { input: ParsedInput | null }) {
  const messages: PromptMessage[] = input?.prompt ?? [];
  const messageCount = messages.length;

  const lastTwoMessages = messages.slice(-2);
  const previousMessageCount = Math.max(0, messageCount - 2);

  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <button className="w-full h-full text-left p-4 hover:bg-accent/30 transition-colors cursor-pointer flex flex-col justify-start">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Input
          </h3>

          <div className="space-y-3">
            {previousMessageCount > 0 && (
              <div className="text-[11px] text-muted-foreground/60 text-center py-1.5 rounded-md bg-muted/30">
                + {previousMessageCount} previous{' '}
                {previousMessageCount === 1 ? 'message' : 'messages'}
              </div>
            )}

            {lastTwoMessages.map((msg, i) => (
              <InputMessagePreview
                key={i}
                message={msg}
                index={previousMessageCount + i + 1}
              />
            ))}

            {messageCount === 0 && (
              <p className="text-sm text-muted-foreground">No messages</p>
            )}
          </div>
        </button>
      </DrawerTrigger>
      <DrawerContent className="h-full w-[800px] sm:max-w-[800px] overflow-hidden">
        <DrawerHeader className="border-b border-border shrink-0">
          <DrawerTitle>All Messages ({messageCount})</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} index={i + 1} />
            ))}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function getTextContent(content: string | ContentPart[]): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('');
  }
  return '';
}

function getToolCalls(content: string | ContentPart[]): ToolCallContentPart[] {
  if (Array.isArray(content)) {
    return content.filter(
      (p): p is ToolCallContentPart => p.type === 'tool-call',
    );
  }
  return [];
}

function getToolResults(
  content: string | ContentPart[],
): ToolResultContentPart[] {
  if (Array.isArray(content)) {
    return content.filter(
      (p): p is ToolResultContentPart => p.type === 'tool-result',
    );
  }
  return [];
}

function getReasoningContent(content: string | ContentPart[]): string {
  if (Array.isArray(content)) {
    return content
      .filter(
        (
          p,
        ): p is {
          type: 'thinking' | 'reasoning';
          text?: string;
          thinking?: string;
          reasoning?: string;
        } => p.type === 'thinking' || p.type === 'reasoning',
      )
      .map(p => p.thinking || p.text || p.reasoning || '')
      .join('');
  }
  return '';
}

function InputMessagePreview({
  message,
  index,
}: {
  message: PromptMessage;
  index?: number;
}) {
  const { role, content } = message;

  const roleLabels: Record<string, string> = {
    user: 'User',
    assistant: 'Assistant',
    system: 'System',
    tool: 'Tool',
  };

  const textContent = getTextContent(content);
  const toolCalls = getToolCalls(content);
  const toolResults = getToolResults(content);
  const reasoningContent = getReasoningContent(content);

  const partCount =
    (textContent ? 1 : 0) +
    (reasoningContent ? 1 : 0) +
    toolCalls.length +
    toolResults.length;

  return (
    <div className="rounded-md border border-border/50 bg-background/50 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        {index && (
          <span className="text-[10px] font-mono text-muted-foreground/50">
            {index}
          </span>
        )}
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {roleLabels[role] || role}
        </span>
        {partCount > 1 && (
          <span className="text-[10px] text-muted-foreground/60">
            {partCount} parts
          </span>
        )}
      </div>

      {reasoningContent && (
        <div className="text-xs text-amber-500/60">[thinking]</div>
      )}

      {textContent && (
        <div className="text-xs text-foreground/90 line-clamp-3">
          {textContent}
        </div>
      )}

      {toolCalls.length > 0 && (
        <div className="space-y-1">
          {toolCalls.slice(0, 3).map((call, i) => {
            const args = call.args ?? call.input;
            const parsedArgs =
              typeof args === 'string'
                ? (safeParseJson(args) as Record<string, unknown>)
                : ((args as Record<string, unknown>) ?? {});
            return (
              <div
                key={i}
                className="text-[11px] font-mono text-muted-foreground truncate"
              >
                {call.toolName}({formatToolParamsInline(parsedArgs)})
              </div>
            );
          })}
          {toolCalls.length > 3 && (
            <div className="text-[11px] text-muted-foreground/60">
              +{toolCalls.length - 3} more tool{' '}
              {toolCalls.length - 3 === 1 ? 'call' : 'calls'}
            </div>
          )}
        </div>
      )}

      {toolResults.length > 0 && (
        <div className="space-y-1">
          {toolResults.slice(0, 3).map((result, i) => {
            const resultContent = result.result ?? result.output ?? result;
            const resultPreview = formatResultPreview(resultContent);
            return (
              <div
                key={i}
                className="text-[11px] font-mono text-muted-foreground truncate"
              >
                {result.toolName || 'tool'}(…) =&gt; {resultPreview}
              </div>
            );
          })}
          {toolResults.length > 3 && (
            <div className="text-[11px] text-muted-foreground/60">
              +{toolResults.length - 3} more tool{' '}
              {toolResults.length - 3 === 1 ? 'result' : 'results'}
            </div>
          )}
        </div>
      )}

      {!textContent &&
        !reasoningContent &&
        toolCalls.length === 0 &&
        toolResults.length === 0 && (
          <div className="text-[11px] text-muted-foreground italic">
            Empty message
          </div>
        )}
    </div>
  );
}

export function MessageBubble({
  message,
  index,
}: {
  message: PromptMessage;
  index?: number;
}) {
  const { role, content } = message;

  const roleLabels: Record<string, string> = {
    user: 'User',
    assistant: 'Assistant',
    system: 'System',
    tool: 'Tool',
  };

  const textContent = getTextContent(content);
  const toolCalls = getToolCalls(content);
  const toolResults = getToolResults(content);
  const reasoningContent = getReasoningContent(content);

  const partCount =
    (textContent ? 1 : 0) +
    (reasoningContent ? 1 : 0) +
    toolCalls.length +
    toolResults.length;

  return (
    <div className="rounded-md border border-border/50 bg-background/50 p-3 space-y-2">
      <div className="flex items-center gap-2">
        {index && (
          <span className="text-[10px] font-mono text-muted-foreground/50">
            {index}
          </span>
        )}
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {roleLabels[role] || role}
        </span>
        {partCount > 1 && (
          <span className="text-[10px] text-muted-foreground/60">
            {partCount} parts
          </span>
        )}
      </div>

      {reasoningContent && <ReasoningBlock content={reasoningContent} />}

      {textContent && (
        <TextBlock
          content={textContent}
          defaultExpanded={
            !reasoningContent &&
            toolCalls.length === 0 &&
            toolResults.length === 0
          }
          isSystem={role === 'system'}
        />
      )}

      {toolCalls.length > 0 && (
        <div className="space-y-2">
          {toolCalls.map((call, i) => (
            <CollapsibleToolCall
              key={i}
              toolName={call.toolName}
              toolCallId={call.toolCallId}
              data={call.args ?? call.input}
            />
          ))}
        </div>
      )}

      {toolResults.length > 0 && (
        <div className="space-y-2">
          {toolResults.map((result, i) => (
            <CollapsibleToolResult
              key={i}
              toolName={result.toolName}
              toolCallId={result.toolCallId}
              data={result.result ?? result.output ?? result}
            />
          ))}
        </div>
      )}

      {!textContent &&
        !reasoningContent &&
        toolCalls.length === 0 &&
        toolResults.length === 0 && (
          <div className="text-[11px] text-muted-foreground italic">
            Empty message
          </div>
        )}
    </div>
  );
}
