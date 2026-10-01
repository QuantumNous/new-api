import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Wrench, MessageSquare, AlertCircle, Brain, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  RunDetail,
  Step,
  ChildRun,
  SpanKind,
  TraceSpan,
  ParseJson,
  ParsedOutput,
  ContentPart,
  ToolCallContentPart,
  ToolResultContentPart,
} from '../types';
import {
  buildTraceSpans,
  safeParseJson,
  SPAN_COLORS,
  SPAN_COLORS_MUTED,
} from '../utils';
import { JsonBlock } from './shared-components';
import { StepDetailContent } from './step-card';

export function TraceTimeline({
  runDetail,
  parseJson,
  formatDuration,
}: {
  runDetail: RunDetail;
  parseJson: ParseJson;
  formatDuration: (ms: number | null) => string;
}) {
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [labelWidth, setLabelWidth] = useState(280);
  const isResizingLabel = useRef(false);

  const spans = useMemo(
    () => buildTraceSpans(runDetail, parseJson),
    [runDetail, parseJson],
  );

  const allSteps = useMemo(() => {
    const steps: Step[] = [];
    function collectSteps(runSteps: Step[], children: ChildRun[]) {
      steps.push(...runSteps);
      for (const cr of children) {
        collectSteps(cr.steps, cr.childRuns ?? []);
      }
    }
    collectSteps(runDetail.steps, runDetail.childRuns ?? []);
    return steps;
  }, [runDetail]);

  const allChildRuns = useMemo(() => {
    const runs: ChildRun[] = [];
    function collectRuns(children: ChildRun[]) {
      for (const cr of children) {
        runs.push(cr);
        collectRuns(cr.childRuns ?? []);
      }
    }
    collectRuns(runDetail.childRuns ?? []);
    return runs;
  }, [runDetail]);

  const handleLabelResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isResizingLabel.current = true;
      const startX = e.clientX;
      const startWidth = labelWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizingLabel.current) return;
        const newWidth = Math.min(
          Math.max(startWidth + (moveEvent.clientX - startX), 120),
          600,
        );
        setLabelWidth(newWidth);
      };

      const onMouseUp = () => {
        isResizingLabel.current = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [labelWidth],
  );

  if (spans.length === 0) return null;

  const totalDurationMs = Math.max(
    ...spans.map(s => s.startMs + s.durationMs),
    1,
  );

  const tickCount = 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const ms = (totalDurationMs / tickCount) * i;
    return {
      ms,
      label: ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`,
    };
  });

  const ROW_HEIGHT = 28;

  const handleSpanClick = (spanId: string) => {
    setSelectedSpanId(prev => (prev === spanId ? null : spanId));
  };

  const selectedSpan = selectedSpanId
    ? spans.find(s => s.id === selectedSpanId)
    : null;

  const resolvedStepId = selectedSpan?.stepId ?? selectedSpanId;

  const selectedStep = resolvedStepId
    ? allSteps.find(s => s.id === resolvedStepId)
    : null;

  const selectedStepIndex = selectedStep
    ? (() => {
        if (runDetail.steps.find(s => s.id === selectedStep.id)) {
          return runDetail.steps.findIndex(s => s.id === selectedStep.id);
        }
        const cr = allChildRuns.find(cr =>
          cr.steps.some(s => s.id === selectedStep.id),
        );
        return cr?.steps.findIndex(s => s.id === selectedStep.id) ?? 0;
      })()
    : 0;

  const selectedStepSiblings = selectedStep
    ? (() => {
        if (runDetail.steps.find(s => s.id === selectedStep.id)) {
          return runDetail.steps;
        }
        const cr = allChildRuns.find(cr =>
          cr.steps.some(s => s.id === selectedStep.id),
        );
        return cr?.steps ?? runDetail.steps;
      })()
    : runDetail.steps;

  const selectedStepChildRuns = selectedStep
    ? allChildRuns.filter(cr => cr.run.parent_step_id === selectedStep.id)
    : [];

  const spanIcon = (kind: SpanKind) => {
    switch (kind) {
      case 'child-run':
        return <Brain className="size-3 text-cyan-400 shrink-0" />;
      case 'thinking':
        return <Brain className="size-3 text-amber-500 shrink-0" />;
      case 'tool-call':
        return <Wrench className="size-3 text-purple-400 shrink-0" />;
      case 'text':
        return <MessageSquare className="size-3 text-emerald-400 shrink-0" />;
      case 'error':
        return <AlertCircle className="size-3 text-red-400 shrink-0" />;
      default:
        return <Zap className="size-3 text-blue-400 shrink-0" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-2 border-b border-border bg-muted/20 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Trace Timeline
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">
            {formatDuration(totalDurationMs)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <div style={{ minWidth: labelWidth + 400 }}>
            {/* Time axis */}
            <div
              className="flex border-b border-border/50"
              style={{ height: 22 }}
            >
              <div
                style={{ width: labelWidth, minWidth: labelWidth }}
                className="shrink-0"
              />
              <div
                className="w-1 shrink-0 cursor-col-resize hover:bg-primary/30"
                onMouseDown={handleLabelResizeStart}
              />
              <div className="flex-1 relative">
                {ticks.map((tick, i) => (
                  <span
                    key={i}
                    className="absolute text-[9px] font-mono text-muted-foreground/60 -translate-x-1/2"
                    style={{
                      left: `${(tick.ms / totalDurationMs) * 100}%`,
                      top: 5,
                    }}
                  >
                    {tick.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Span rows */}
            {spans.map(span => {
              const leftPct = (span.startMs / totalDurationMs) * 100;
              const widthPct = Math.max(
                (span.durationMs / totalDurationMs) * 100,
                0.3,
              );
              const isSelected = selectedSpanId === span.id;

              return (
                <div
                  key={span.id}
                  className={`flex items-center border-b border-border/30 transition-colors cursor-pointer ${
                    isSelected ? 'bg-accent' : 'hover:bg-accent/30'
                  }`}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => handleSpanClick(span.id)}
                >
                  {/* Label column */}
                  <div
                    className="shrink-0 flex items-center gap-1.5 px-2 overflow-hidden"
                    style={{
                      width: labelWidth,
                      minWidth: labelWidth,
                      paddingLeft: 8 + span.depth * 16,
                    }}
                  >
                    {spanIcon(span.kind)}
                    <span className="text-[11px] font-mono text-foreground truncate">
                      {span.label}
                    </span>
                    {span.sublabel && (
                      <span className="text-[10px] text-muted-foreground truncate">
                        {span.sublabel}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] font-mono text-muted-foreground shrink-0 pl-1">
                      {formatDuration(span.durationMs || null)}
                    </span>
                    {span.tokens && (
                      <span className="text-[9px] font-mono text-muted-foreground/60 shrink-0">
                        {span.tokens.input}→{span.tokens.output}
                      </span>
                    )}
                  </div>

                  {/* Resize handle */}
                  <div
                    className="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 self-stretch"
                    onMouseDown={handleLabelResizeStart}
                  />

                  {/* Bar column */}
                  <div className="flex-1 relative h-full">
                    {ticks.map((tick, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-l border-border/20"
                        style={{
                          left: `${(tick.ms / totalDurationMs) * 100}%`,
                        }}
                      />
                    ))}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="absolute top-1 bottom-1 flex items-center cursor-pointer"
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            minWidth: 3,
                          }}
                        >
                          <div
                            className={`h-full w-full rounded-sm ${
                              isSelected
                                ? 'ring-2 ring-foreground/50 ring-offset-1 ring-offset-background'
                                : ''
                            } ${
                              span.isInProgress
                                ? `${SPAN_COLORS_MUTED[span.kind]} animate-pulse`
                                : SPAN_COLORS[span.kind]
                            }`}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="text-xs space-y-1">
                          <div className="font-medium">{span.label}</div>
                          {span.sublabel && (
                            <div className="text-muted-foreground">
                              {span.sublabel}
                            </div>
                          )}
                          {span.modelId && span.modelId !== span.label && (
                            <div className="text-muted-foreground font-mono">
                              {span.modelId}
                            </div>
                          )}
                          <div className="text-muted-foreground font-mono">
                            {formatDuration(span.durationMs || null)}
                            {span.tokens && (
                              <span className="ml-2">
                                {span.tokens.input} in → {span.tokens.output}{' '}
                                out
                              </span>
                            )}
                          </div>
                          <div className="text-muted-foreground/60 pt-0.5">
                            Click to {isSelected ? 'deselect' : 'view details'}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected span detail */}
      {selectedStep && selectedSpan && (
        <Card className="overflow-hidden py-0 gap-0">
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border-b border-border">
            <div className="flex items-center gap-2">
              {spanIcon(selectedSpan.kind)}
              <span className="text-xs text-muted-foreground font-mono">
                Step {selectedStepIndex + 1}
              </span>
              {selectedSpan.kind !== 'step' && (
                <Badge
                  variant="secondary"
                  className="text-[10px] h-5 capitalize"
                >
                  {selectedSpan.kind}
                </Badge>
              )}
              <span className="text-xs font-medium font-mono">
                {selectedSpan.label}
              </span>
              {selectedStep.provider && (
                <span className="px-1.5 py-0.5 rounded bg-sidebar-primary/10 text-sidebar-primary text-[10px] font-medium">
                  {selectedStep.provider}
                </span>
              )}
            </div>
            <button
              onClick={() => setSelectedSpanId(null)}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Deselect
            </button>
          </div>
          <SpanDetailPanel
            span={selectedSpan}
            step={selectedStep}
            stepIndex={selectedStepIndex}
            steps={selectedStepSiblings}
            runDetail={runDetail}
            parseJson={parseJson}
            formatDuration={formatDuration}
            childRuns={selectedStepChildRuns}
          />
        </Card>
      )}
    </div>
  );
}

function SpanDetailPanel({
  span,
  step,
  stepIndex,
  steps,
  runDetail,
  parseJson,
  formatDuration,
  childRuns,
}: {
  span: TraceSpan;
  step: Step;
  stepIndex: number;
  steps: Step[];
  runDetail: RunDetail;
  parseJson: ParseJson;
  formatDuration: (ms: number | null) => string;
  childRuns: ChildRun[];
}) {
  const output = parseJson(step.output) as ParsedOutput | null;
  const contentParts: ContentPart[] =
    (output?.content as ContentPart[] | undefined) ?? [];

  if (span.kind === 'tool-call' && span.toolCallId) {
    const toolCall = contentParts.find(
      (p): p is ToolCallContentPart =>
        p.type === 'tool-call' &&
        'toolCallId' in p &&
        p.toolCallId === span.toolCallId,
    );
    const toolResult = contentParts.find(
      (p): p is ToolResultContentPart =>
        p.type === 'tool-result' &&
        'toolCallId' in p &&
        p.toolCallId === span.toolCallId,
    );

    const args = toolCall?.input ?? toolCall?.args;
    const parsedArgs = typeof args === 'string' ? safeParseJson(args) : args;
    const resultData = toolResult?.output ?? toolResult?.result;
    const parsedResult =
      typeof resultData === 'string' ? safeParseJson(resultData) : resultData;

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Wrench className="size-4 text-purple-400" />
          <span className="text-sm font-mono font-medium text-purple-400">
            {span.label}
          </span>
        </div>
        {parsedArgs != null && (
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Input
            </h4>
            <JsonBlock data={parsedArgs} />
          </div>
        )}
        {parsedResult != null && (
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-success mb-2">
              Output
            </h4>
            <JsonBlock data={parsedResult} />
          </div>
        )}
        {!parsedArgs && !parsedResult && (
          <p className="text-sm text-muted-foreground">
            No data available for this tool call.
          </p>
        )}
      </div>
    );
  }

  if (span.kind === 'thinking' && span.thinkingText) {
    return (
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="size-4 text-amber-500" />
          <span className="text-sm font-medium text-amber-500">Thinking</span>
        </div>
        <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
          {span.thinkingText}
        </div>
      </div>
    );
  }

  if (span.kind === 'text' && span.textContent) {
    return (
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="size-4 text-emerald-400" />
          <span className="text-sm font-medium text-emerald-400">
            Text Response
          </span>
        </div>
        <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap rounded-md border border-border bg-background p-3">
          {span.textContent}
        </div>
      </div>
    );
  }

  if (span.kind === 'error') {
    return (
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <AlertCircle className="size-4 text-red-400" />
          <span className="text-sm font-medium text-red-400">Error</span>
        </div>
        <div className="text-sm text-destructive-foreground font-mono whitespace-pre-wrap rounded-md border border-destructive/30 bg-destructive/10 p-3">
          {step.error}
        </div>
      </div>
    );
  }

  return (
    <StepDetailContent
      step={step}
      index={stepIndex}
      steps={steps}
      isRunInProgress={runDetail.run.isInProgress ?? false}
      parseJson={parseJson}
      formatDuration={formatDuration}
      childRuns={childRuns}
      depth={0}
    />
  );
}
