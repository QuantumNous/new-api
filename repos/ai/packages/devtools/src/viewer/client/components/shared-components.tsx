import React, { useState } from 'react';
import {
  ChevronRight,
  Copy,
  Check,
  Wrench,
  MessageSquare,
  Brain,
  Settings,
  BarChart3,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import type {
  InputTokenBreakdown,
  OutputTokenBreakdown,
  ParsedInput,
  ParsedUsage,
  ToolDefinition,
} from '../types';
import {
  safeParseJson,
  formatToolParams,
  getInputTokenBreakdown,
  getOutputTokenBreakdown,
} from '../utils';

export function JsonBlock({
  data,
  compact = false,
  size = 'sm',
}: {
  data: unknown;
  compact?: boolean;
  size?: 'sm' | 'base' | 'lg';
}) {
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(data, null, 2);
  const displayString =
    compact && jsonString.length > 200 ? JSON.stringify(data) : jsonString;

  const sizeClasses = {
    sm: 'text-xs',
    base: 'text-sm',
    lg: 'text-base',
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute top-1.5 right-1.5 p-1.5 rounded-md border border-border bg-background opacity-0 group-hover:opacity-100 transition-opacity z-10"
        title="Copy to clipboard"
      >
        {copied ? (
          <Check className="size-3 text-success" />
        ) : (
          <Copy className="size-3 text-muted-foreground" />
        )}
      </button>
      <pre
        className={`font-mono ${sizeClasses[size]} text-muted-foreground whitespace-pre-wrap wrap-break-words bg-background rounded p-2 ${
          compact ? 'overflow-hidden max-h-20' : ''
        }`}
      >
        {displayString}
      </pre>
    </div>
  );
}

export function RawDataSection({
  rawRequest,
  rawResponse,
  rawChunks,
  isStream,
}: {
  rawRequest: string | null;
  rawResponse: string | null;
  rawChunks: string | null;
  isStream: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [responseView, setResponseView] = useState<'parsed' | 'raw'>('parsed');

  if (!rawRequest && !rawResponse) return null;

  const hasRawChunks = isStream && rawChunks;

  return (
    <div className="border-t border-border">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight
          className={`size-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
        <span className="font-medium tracking-wider uppercase">
          Request / Response
        </span>
      </button>

      {expanded && (
        <div className="grid grid-cols-2 gap-4 px-4 pb-4">
          {rawRequest && (
            <div className="flex flex-col">
              <div className="flex items-end mb-2 h-7">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Request
                </span>
              </div>
              <div className="max-h-[400px] overflow-auto rounded-md border border-border">
                <JsonBlock data={safeParseJson(rawRequest)} />
              </div>
            </div>
          )}
          {(rawResponse || rawChunks) && (
            <div className="flex flex-col">
              <div className="flex justify-between items-end mb-2 h-7">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {isStream ? 'Stream' : 'Response'}
                </span>
                {hasRawChunks && (
                  <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
                    <button
                      onClick={() => setResponseView('parsed')}
                      className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                        responseView === 'parsed'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      AI SDK
                    </button>
                    <button
                      onClick={() => setResponseView('raw')}
                      className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                        responseView === 'raw'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Provider
                    </button>
                  </div>
                )}
              </div>
              <div className="max-h-[400px] overflow-auto rounded-md border border-border">
                <JsonBlock
                  data={safeParseJson(
                    hasRawChunks && responseView === 'raw'
                      ? rawChunks
                      : rawResponse,
                  )}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function UsageDetails({ usage }: { usage: ParsedUsage }) {
  const inputBreakdown = getInputTokenBreakdown(usage?.inputTokens);
  const outputBreakdown = getOutputTokenBreakdown(usage?.outputTokens);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="mb-2 text-xs font-medium tracking-wider uppercase text-muted-foreground">
            Input Tokens
          </div>
          <div className="text-2xl font-semibold">{inputBreakdown.total}</div>
          {(inputBreakdown.cacheRead !== undefined ||
            inputBreakdown.cacheWrite !== undefined) && (
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              {inputBreakdown.cacheRead !== undefined && (
                <div className="flex justify-between">
                  <span>Cache read</span>
                  <span className="font-mono">{inputBreakdown.cacheRead}</span>
                </div>
              )}
              {inputBreakdown.cacheWrite !== undefined && (
                <div className="flex justify-between">
                  <span>Cache write</span>
                  <span className="font-mono">{inputBreakdown.cacheWrite}</span>
                </div>
              )}
              {inputBreakdown.noCache !== undefined && (
                <div className="flex justify-between">
                  <span>No cache</span>
                  <span className="font-mono">{inputBreakdown.noCache}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="mb-2 text-xs font-medium tracking-wider uppercase text-muted-foreground">
            Output Tokens
          </div>
          <div className="text-2xl font-semibold">{outputBreakdown.total}</div>
          {(outputBreakdown.text !== undefined ||
            outputBreakdown.reasoning !== undefined) && (
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              {outputBreakdown.text !== undefined && (
                <div className="flex justify-between">
                  <span>Text</span>
                  <span className="font-mono">{outputBreakdown.text}</span>
                </div>
              )}
              {outputBreakdown.reasoning !== undefined && (
                <div className="flex justify-between">
                  <span>Reasoning</span>
                  <span className="font-mono">{outputBreakdown.reasoning}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {usage?.raw != null && (
        <div>
          <div className="mb-2 text-xs font-medium tracking-wider uppercase text-muted-foreground">
            Raw Provider Usage
          </div>
          <JsonBlock data={usage.raw} size="sm" />
        </div>
      )}

      <div>
        <div className="mb-2 text-xs font-medium tracking-wider uppercase text-muted-foreground">
          Full Usage Object
        </div>
        <JsonBlock data={usage} size="sm" />
      </div>
    </div>
  );
}

export function TokenBreakdownTooltip({
  input,
  output,
  raw,
}: {
  input: InputTokenBreakdown;
  output: OutputTokenBreakdown;
  raw?: unknown;
}) {
  const hasInputBreakdown =
    input.noCache !== undefined ||
    input.cacheRead !== undefined ||
    input.cacheWrite !== undefined;
  const hasOutputBreakdown =
    output.text !== undefined || output.reasoning !== undefined;
  const hasBreakdown = hasInputBreakdown || hasOutputBreakdown;

  if (!hasBreakdown) {
    return (
      <div className="text-xs">
        <div>Input: {input.total}</div>
        <div>Output: {output.total}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      <div>
        <div className="mb-1 font-medium">Input: {input.total}</div>
        {input.cacheRead !== undefined && (
          <div className="ml-2 text-muted-foreground">
            Cache read: {input.cacheRead}
          </div>
        )}
        {input.cacheWrite !== undefined && (
          <div className="ml-2 text-muted-foreground">
            Cache write: {input.cacheWrite}
          </div>
        )}
      </div>
      <div>
        <div className="mb-1 font-medium">Output: {output.total}</div>
        {output.text !== undefined && (
          <div className="ml-2 text-muted-foreground">Text: {output.text}</div>
        )}
        {output.reasoning !== undefined && (
          <div className="ml-2 text-muted-foreground">
            Reasoning: {output.reasoning}
          </div>
        )}
      </div>
      {raw !== undefined && (
        <div className="pt-1 mt-1 border-t border-border">
          <div className="text-muted-foreground/70 font-mono text-[10px] max-w-[200px] truncate">
            Raw: {JSON.stringify(raw)}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReasoningBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);

  const previewContent =
    content.length > 200 ? content.slice(0, 200) + '…' : content;

  return (
    <div className="overflow-hidden rounded-md border border-amber-500/30">
      <button
        className="flex gap-2 items-center px-3 py-2 w-full transition-colors bg-amber-500/10 hover:bg-amber-500/20"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight
          className={`size-3 text-amber-500 transition-transform shrink-0 ${
            expanded ? 'rotate-90' : ''
          }`}
        />
        <Brain className="text-amber-500 size-3 shrink-0" />
        <span className="text-xs font-medium text-amber-500">Thinking</span>
        {!expanded && (
          <span className="text-[11px] text-amber-500/70 truncate ml-1">
            {previewContent}
          </span>
        )}
      </button>

      {expanded && (
        <div className="p-3 border-t bg-card/50 border-amber-500/30">
          <div className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/80">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}

export function TextBlock({
  content,
  defaultExpanded = false,
  isSystem = false,
}: {
  content: string;
  defaultExpanded?: boolean;
  isSystem?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const previewContent =
    content.length > 200 ? content.slice(0, 200) + '…' : content;

  const borderColor = isSystem ? 'border-blue-500/30' : 'border-border';
  const bgColor = isSystem ? 'bg-blue-500/10' : 'bg-muted/30';
  const hoverBgColor = isSystem ? 'hover:bg-blue-500/20' : 'hover:bg-muted/50';
  const iconColor = isSystem ? 'text-blue-400' : 'text-muted-foreground';
  const labelColor = isSystem ? 'text-blue-400' : 'text-foreground';

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`overflow-hidden rounded-md border ${borderColor}`}>
      <button
        className={`flex gap-2 items-center px-3 py-2 w-full transition-colors ${bgColor} ${hoverBgColor}`}
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight
          className={`size-3 ${iconColor} transition-transform shrink-0 ${
            expanded ? 'rotate-90' : ''
          }`}
        />
        <MessageSquare className={`size-3 ${iconColor} shrink-0`} />
        <span className={`text-xs font-medium ${labelColor}`}>Text</span>
        {!expanded && (
          <span
            className={`text-[11px] ${isSystem ? 'text-blue-400/70' : 'text-muted-foreground'} truncate ml-1`}
          >
            {previewContent}
          </span>
        )}
      </button>

      {expanded && (
        <div
          className={`relative p-3 border-t bg-card/50 ${borderColor} group`}
        >
          <button
            onClick={handleCopy}
            className="absolute top-1.5 right-1.5 p-1.5 rounded-md border border-border bg-background opacity-0 group-hover:opacity-100 transition-opacity z-10"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="size-3 text-success" />
            ) : (
              <Copy className="size-3 text-muted-foreground" />
            )}
          </button>
          <div className="overflow-y-auto max-h-60 text-xs leading-relaxed whitespace-pre-wrap text-foreground">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}

export function ToolItem({ tool }: { tool: ToolDefinition }) {
  const [expanded, setExpanded] = useState(false);

  const hasExpandableContent = tool.parameters || tool.description;

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <button
        className="w-full flex items-center justify-between p-2.5 hover:bg-accent/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-mono text-sm text-purple">{tool.name}</span>
        {hasExpandableContent && (
          <ChevronRight
            className={`size-3 text-muted-foreground transition-transform ${
              expanded ? 'rotate-90' : ''
            }`}
          />
        )}
      </button>
      {!expanded && tool.description && (
        <div className="px-2.5 pb-2">
          <p className="text-[11px] text-muted-foreground truncate">
            {tool.description}
          </p>
        </div>
      )}
      {expanded && hasExpandableContent && (
        <div className="px-2.5 pb-2.5 border-t border-border">
          {tool.description && (
            <p
              className={`pt-2 text-xs text-muted-foreground ${tool.parameters ? 'mb-2' : ''}`}
            >
              {tool.description}
            </p>
          )}
          {tool.parameters && <JsonBlock data={tool.parameters} compact />}
        </div>
      )}
    </div>
  );
}

export function CollapsibleToolCall({
  toolName,
  toolCallId,
  data,
}: {
  toolName: string;
  toolCallId?: string;
  data: unknown;
}) {
  const [expanded, setExpanded] = useState(false);
  const parsedData = typeof data === 'string' ? safeParseJson(data) : data;

  return (
    <div className="overflow-hidden rounded-md border border-purple/30">
      <button
        className="flex gap-2 items-center px-3 py-2 w-full transition-colors bg-purple/10 hover:bg-purple/20"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight
          className={`size-3 text-purple transition-transform shrink-0 ${
            expanded ? 'rotate-90' : ''
          }`}
        />
        <Wrench className="size-3 text-purple shrink-0" />
        <span className="font-mono text-xs font-medium text-purple">
          {toolName}
        </span>
        {!expanded &&
          parsedData != null &&
          typeof parsedData === 'object' &&
          !Array.isArray(parsedData) && (
            <span className="text-[11px] font-mono text-purple/70 truncate">
              {formatToolParams(parsedData as Record<string, unknown>)}
            </span>
          )}
        {toolCallId && (
          <span className="text-[10px] font-mono text-muted-foreground/60 ml-auto shrink-0">
            {toolCallId}
          </span>
        )}
      </button>
      {expanded && (
        <div className="p-3 border-t bg-card/50 border-purple/30">
          <JsonBlock data={parsedData} />
        </div>
      )}
    </div>
  );
}

export function CollapsibleToolResult({
  toolName,
  toolCallId,
  data,
}: {
  toolName?: string;
  toolCallId?: string;
  data: unknown;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-md border border-success/30">
      <button
        className="flex gap-2 items-center px-3 py-2 w-full transition-colors bg-success/10 hover:bg-success/20"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight
          className={`size-3 text-success transition-transform shrink-0 ${
            expanded ? 'rotate-90' : ''
          }`}
        />
        <span className="text-xs font-medium text-success">Result</span>
        {toolName && (
          <span className="text-[11px] font-mono text-muted-foreground">
            {toolName}
          </span>
        )}
        {toolCallId && (
          <span className="text-[10px] font-mono text-muted-foreground/60 ml-auto shrink-0">
            {toolCallId}
          </span>
        )}
      </button>
      {expanded && (
        <div className="p-3 border-t bg-card/50 border-success/30">
          <JsonBlock data={data} />
        </div>
      )}
    </div>
  );
}

export function StepConfigBar({
  modelId,
  provider,
  input,
  providerOptions,
  usage,
}: {
  modelId?: string;
  provider?: string | null;
  input: ParsedInput | null;
  providerOptions?: Record<string, unknown> | null;
  usage?: ParsedUsage | null;
}) {
  const toolCount = input?.tools?.length ?? 0;

  const params: { label: string; value: string }[] = [];
  if (input?.temperature != null)
    params.push({ label: 'temp', value: String(input.temperature) });
  if (input?.maxOutputTokens != null)
    params.push({ label: 'max tokens', value: String(input.maxOutputTokens) });
  if (input?.topP != null)
    params.push({ label: 'topP', value: String(input.topP) });
  if (input?.topK != null)
    params.push({ label: 'topK', value: String(input.topK) });
  if (input?.toolChoice != null) {
    const choice =
      typeof input.toolChoice === 'string'
        ? input.toolChoice
        : input.toolChoice.type;
    params.push({ label: 'tool choice', value: choice });
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/20 border-b border-border text-[11px] text-muted-foreground">
      {provider && (
        <span className="px-1.5 py-0.5 rounded bg-sidebar-primary/10 text-sidebar-primary text-[10px] font-medium">
          {provider}
        </span>
      )}
      <span className="font-mono">{modelId}</span>

      {params.length > 0 && (
        <>
          <span className="text-muted-foreground/30">·</span>
          {params.map((p, i) => (
            <span key={i}>
              {p.label}: <span className="text-foreground">{p.value}</span>
              {i < params.length - 1 && (
                <span className="mx-1 text-muted-foreground/30">·</span>
              )}
            </span>
          ))}
        </>
      )}

      {toolCount > 0 && (
        <>
          <span className="text-muted-foreground/30">·</span>
          <Drawer direction="right">
            <DrawerTrigger asChild>
              <button className="inline-flex gap-1 items-center transition-colors cursor-pointer hover:text-foreground">
                <Wrench className="size-3" />
                {toolCount} available {toolCount === 1 ? 'tool' : 'tools'}
              </button>
            </DrawerTrigger>
            <DrawerContent className="h-full w-[800px] sm:max-w-[800px] overflow-hidden">
              <DrawerHeader className="border-b border-border shrink-0">
                <DrawerTitle>Available Tools ({toolCount})</DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto flex-1 p-4">
                <div className="space-y-3">
                  {input?.tools?.map((tool: ToolDefinition, i: number) => (
                    <ToolItem key={i} tool={tool} />
                  ))}
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        </>
      )}

      {providerOptions && Object.keys(providerOptions).length > 0 && (
        <>
          <span className="text-muted-foreground/30">·</span>
          <Drawer direction="right">
            <DrawerTrigger asChild>
              <button className="inline-flex gap-1 items-center transition-colors cursor-pointer hover:text-foreground">
                <Settings className="size-3" />
                Provider options
              </button>
            </DrawerTrigger>
            <DrawerContent className="h-full w-[800px] sm:max-w-[800px] overflow-hidden">
              <DrawerHeader className="border-b border-border shrink-0">
                <DrawerTitle>Provider Options</DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto flex-1 p-4">
                <JsonBlock data={providerOptions} size="lg" />
              </div>
            </DrawerContent>
          </Drawer>
        </>
      )}

      {usage && (
        <>
          <span className="text-muted-foreground/30">·</span>
          <Drawer direction="right">
            <DrawerTrigger asChild>
              <button className="inline-flex gap-1 items-center transition-colors cursor-pointer hover:text-foreground">
                <BarChart3 className="size-3" />
                Usage
              </button>
            </DrawerTrigger>
            <DrawerContent className="h-full w-[800px] sm:max-w-[800px] overflow-hidden">
              <DrawerHeader className="border-b border-border shrink-0">
                <DrawerTitle>Token Usage</DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto flex-1 p-4">
                <UsageDetails usage={usage} />
              </div>
            </DrawerContent>
          </Drawer>
        </>
      )}
    </div>
  );
}
