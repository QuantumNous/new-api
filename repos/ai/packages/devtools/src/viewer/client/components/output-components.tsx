import React, { useState } from 'react';
import { ChevronRight, Wrench } from 'lucide-react';
import type {
  ParsedOutput,
  ContentPart,
  ToolCallContentPart,
  ToolResultContentPart,
  TextContentPart,
  ReasoningContentPart,
} from '../types';
import { safeParseJson, formatToolParams } from '../utils';
import { JsonBlock, ReasoningBlock, TextBlock } from './shared-components';

export function OutputDisplay({
  output,
  toolResults = [],
}: {
  output: ParsedOutput;
  toolResults?: ContentPart[];
}) {
  const getToolResult = (toolCallId: string) => {
    return toolResults.find(
      (r): r is ToolResultContentPart =>
        r.type === 'tool-result' &&
        'toolCallId' in r &&
        r.toolCallId === toolCallId,
    );
  };

  const toolCalls: ToolCallContentPart[] =
    output?.toolCalls ||
    (output?.content?.filter(
      (p): p is ToolCallContentPart => p.type === 'tool-call',
    ) ??
      []);

  const textParts: TextContentPart[] =
    output?.textParts ||
    (output?.content?.filter((p): p is TextContentPart => p.type === 'text') ??
      []);

  const reasoningParts: ReasoningContentPart[] =
    output?.reasoningParts ||
    (output?.content?.filter(
      (p): p is ReasoningContentPart =>
        p.type === 'thinking' || p.type === 'reasoning',
    ) ??
      []);

  const textContent = textParts.map(p => p.text).join('');
  const reasoningContent = reasoningParts
    .map(p => p.text || p.thinking || p.reasoning || '')
    .join('');

  const isTextOnly = textContent && !reasoningContent && toolCalls.length === 0;

  return (
    <div className="space-y-3">
      {reasoningContent && <ReasoningBlock content={reasoningContent} />}

      {textContent && (
        <TextBlock content={textContent} defaultExpanded={!!isTextOnly} />
      )}

      {toolCalls.map((call, i) => {
        const result = call.toolCallId
          ? getToolResult(call.toolCallId)
          : undefined;
        return (
          <ToolCallCard
            key={i}
            toolName={call.toolName}
            args={call.args ?? call.input}
            result={result?.output ?? result?.result}
          />
        );
      })}
    </div>
  );
}

function ToolCallCard({
  toolName,
  args,
  result,
}: {
  toolName: string;
  args: Record<string, unknown> | string | undefined;
  result?: unknown;
}) {
  const [expanded, setExpanded] = useState(false);
  const parsedArgs =
    typeof args === 'string'
      ? (safeParseJson(args) as Record<string, unknown>)
      : args;
  const parsedResult =
    typeof result === 'string' ? safeParseJson(result) : result;

  return (
    <div className="rounded-md border border-purple/30 overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 bg-purple/10 hover:bg-purple/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight
          className={`size-3 text-purple transition-transform shrink-0 ${
            expanded ? 'rotate-90' : ''
          }`}
        />
        <Wrench className="size-3 text-purple shrink-0" />
        <span className="text-xs font-mono font-medium text-purple">
          {toolName}
        </span>
        {!expanded &&
          parsedArgs &&
          typeof parsedArgs === 'object' &&
          !Array.isArray(parsedArgs) && (
            <span className="text-[11px] font-mono text-purple/70 truncate">
              {formatToolParams(parsedArgs)}
            </span>
          )}
      </button>

      {expanded && (
        <>
          <div className="p-3 bg-card/50 border-t border-purple/30">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Input
            </div>
            <JsonBlock data={parsedArgs} />
          </div>

          {parsedResult != null && (
            <div className="p-3 border-t border-border bg-success/5">
              <div className="text-[10px] font-medium uppercase tracking-wider text-success mb-2">
                Output
              </div>
              <JsonBlock data={parsedResult} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
