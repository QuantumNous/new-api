import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Trash2,
  Zap,
  MessageSquare,
  AlertCircle,
  Loader2,
  GanttChart,
} from 'lucide-react';
import { AISDKLogo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  Run,
  RunDetail,
  Step,
  ParsedInput,
  ParsedUsage,
  PromptMessage,
  InputTokenBreakdown,
  OutputTokenBreakdown,
} from './types';
import {
  getInputTokenBreakdown,
  getOutputTokenBreakdown,
  formatInputTokens,
  formatOutputTokens,
} from './utils';
import { TokenBreakdownTooltip } from './components/shared-components';
import { StepCard } from './components/step-card';
import { TraceTimeline } from './components/trace-timeline';

function App() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showTimeline, setShowTimeline] = useState(false);

  const fetchRuns = async () => {
    try {
      const res = await fetch('/api/runs');
      const data = await res.json();
      setRuns(data);
    } catch (error) {
      console.error('Failed to fetch runs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    await fetch('/api/clear', { method: 'POST' });
    setRuns([]);
    setSelectedRun(null);
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      eventSource = new EventSource('/api/events');

      eventSource.addEventListener('connected', () => {
        console.log('[DevTools] Connected to real-time updates');
      });

      eventSource.addEventListener('update', () => {
        fetchRuns();
        if (selectedRun) {
          fetch(`/api/runs/${selectedRun.run.id}`)
            .then(res => res.json())
            .then(data => {
              if (data && !data.error) {
                setSelectedRun(data);
              }
            })
            .catch(() => {});
        }
      });

      eventSource.addEventListener('heartbeat', () => {});

      eventSource.onerror = () => {
        console.log('[DevTools] SSE connection lost, reconnecting...');
        eventSource?.close();
        reconnectTimeout = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      eventSource?.close();
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [selectedRun?.run.id]);

  const selectRun = async (runId: string) => {
    const res = await fetch(`/api/runs/${runId}`);
    const data = await res.json();
    setSelectedRun(data);
    setExpandedSteps(new Set());
  };

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const parseJson = (str: string | null): unknown => {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  };

  const getFirstUserMessage = (steps: Step[]): string => {
    const firstStep = steps[0];
    if (!firstStep) return 'Empty run';
    const input = parseJson(firstStep.input) as ParsedInput | null;
    const userMsg = input?.prompt?.find(
      (m: PromptMessage) => m.role === 'user',
    );
    if (userMsg) {
      const content =
        typeof userMsg.content === 'string'
          ? userMsg.content
          : Array.isArray(userMsg.content)
            ? userMsg.content.find(
                (p): p is { type: 'text'; text: string } => p.type === 'text',
              )?.text || ''
            : '';
      return content.slice(0, 50) + (content.length > 50 ? '...' : '');
    }
    return 'No user message';
  };

  const hasRunError = (steps: Step[]): boolean => {
    return steps.some(s => s.error);
  };

  const getTotalDuration = (steps: Step[]): number => {
    return steps.reduce((acc, s) => acc + (s.duration_ms || 0), 0);
  };

  const getTotalTokens = (
    steps: Step[],
  ): { input: InputTokenBreakdown; output: OutputTokenBreakdown } => {
    return steps.reduce(
      (acc, s) => {
        const usage = parseJson(s.usage) as ParsedUsage | null;
        const inputBreakdown = getInputTokenBreakdown(usage?.inputTokens);
        const outputBreakdown = getOutputTokenBreakdown(usage?.outputTokens);

        const input: InputTokenBreakdown = {
          total: acc.input.total + inputBreakdown.total,
        };

        if (
          acc.input.noCache !== undefined ||
          inputBreakdown.noCache !== undefined
        ) {
          input.noCache =
            (acc.input.noCache ?? 0) + (inputBreakdown.noCache ?? 0);
        }
        if (
          acc.input.cacheRead !== undefined ||
          inputBreakdown.cacheRead !== undefined
        ) {
          input.cacheRead =
            (acc.input.cacheRead ?? 0) + (inputBreakdown.cacheRead ?? 0);
        }
        if (
          acc.input.cacheWrite !== undefined ||
          inputBreakdown.cacheWrite !== undefined
        ) {
          input.cacheWrite =
            (acc.input.cacheWrite ?? 0) + (inputBreakdown.cacheWrite ?? 0);
        }

        const output: OutputTokenBreakdown = {
          total: acc.output.total + outputBreakdown.total,
        };

        if (
          acc.output.text !== undefined ||
          outputBreakdown.text !== undefined
        ) {
          output.text = (acc.output.text ?? 0) + (outputBreakdown.text ?? 0);
        }
        if (
          acc.output.reasoning !== undefined ||
          outputBreakdown.reasoning !== undefined
        ) {
          output.reasoning =
            (acc.output.reasoning ?? 0) + (outputBreakdown.reasoning ?? 0);
        }

        return { input, output };
      },
      {
        input: { total: 0 },
        output: { total: 0 },
      } as { input: InputTokenBreakdown; output: OutputTokenBreakdown },
    );
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex justify-between items-center px-5 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <AISDKLogo />
          <span className="text-base font-medium text-muted-foreground">
            DevTools
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchRuns}
            className="h-8 px-3 text-xs"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-8 px-3 text-xs text-destructive-foreground hover:bg-destructive/20"
          >
            <Trash2 className="size-3.5" />
            Clear
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[300px] border-r border-border bg-sidebar flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Runs
            </span>
          </div>
          <ScrollArea className="flex-1 overflow-hidden">
            {loading ? (
              <p className="p-4 text-muted-foreground text-sm">Loading...</p>
            ) : runs.length === 0 ? (
              <p className="p-4 text-muted-foreground text-sm">No runs yet</p>
            ) : (
              <div>
                {runs.map(run => {
                  const isSelected = selectedRun?.run.id === run.id;
                  return (
                    <button
                      key={run.id}
                      className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors ${
                        isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                      }`}
                      onClick={() => selectRun(run.id)}
                    >
                      <div className="flex items-start gap-2 mb-1.5 min-w-0">
                        {run.isInProgress ? (
                          <Loader2 className="size-3.5 text-blue-400 mt-0.5 shrink-0 animate-spin" />
                        ) : run.hasError ? (
                          <AlertCircle className="size-3.5 text-destructive-foreground mt-0.5 shrink-0" />
                        ) : (
                          <MessageSquare className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        )}
                        <div className="min-w-0">
                          {run.function_id && (
                            <span className="text-[11px] font-mono text-sidebar-primary block truncate">
                              {run.function_id}
                            </span>
                          )}
                          <span className="text-[13px] text-foreground leading-tight line-clamp-1 break-all">
                            {run.firstMessage || 'Loading...'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-5.5 text-[11px] text-muted-foreground">
                        {run.type && (
                          <span
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              run.type === 'stream'
                                ? 'bg-blue-500/15 text-blue-400'
                                : 'bg-emerald-500/15 text-emerald-400'
                            }`}
                          >
                            {run.type === 'stream' && (
                              <Zap className="size-2.5" />
                            )}
                            {run.type}
                          </span>
                        )}
                        <span>
                          {run.stepCount}{' '}
                          {run.stepCount === 1 ? 'step' : 'steps'}
                        </span>
                        <span>·</span>
                        <span className="font-mono">
                          {new Date(run.started_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {!selectedRun ? (
              <div className="flex items-center justify-center min-h-[calc(100vh-57px)] text-muted-foreground">
                <p className="text-sm">Select a run to view details</p>
              </div>
            ) : (
              <div className="p-5">
                {/* Run Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-medium text-foreground">
                      {getFirstUserMessage(selectedRun.steps)}
                    </h2>
                    {selectedRun.run.isInProgress && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-5 gap-1.5 bg-blue-500/15 text-blue-400 border-blue-500/30"
                      >
                        <Loader2 className="size-3 animate-spin" />
                        In Progress
                      </Badge>
                    )}
                    {hasRunError(selectedRun.steps) && (
                      <Badge variant="destructive" className="text-[10px] h-5">
                        Error
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <span>{selectedRun.steps.length} steps</span>
                    <span className="px-3 text-muted-foreground/30">·</span>
                    <span className="font-mono">
                      {formatDuration(getTotalDuration(selectedRun.steps))}
                    </span>
                    <span className="px-3 text-muted-foreground/30">·</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="font-mono cursor-help">
                          input:{' '}
                          {formatInputTokens(
                            getTotalTokens(selectedRun.steps).input,
                          )}{' '}
                          <span className="text-muted-foreground/50">→</span>{' '}
                          output:{' '}
                          {formatOutputTokens(
                            getTotalTokens(selectedRun.steps).output,
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <TokenBreakdownTooltip
                          input={getTotalTokens(selectedRun.steps).input}
                          output={getTotalTokens(selectedRun.steps).output}
                        />
                      </TooltipContent>
                    </Tooltip>
                    <span className="px-3 text-muted-foreground/30">·</span>
                    <span>
                      {new Date(selectedRun.run.started_at).toLocaleString()}
                    </span>
                    <span className="px-3 text-muted-foreground/30">·</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setShowTimeline(prev => !prev)}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                            showTimeline
                              ? 'bg-accent text-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                          }`}
                        >
                          <GanttChart className="size-3.5" />
                          Timeline
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {showTimeline
                          ? 'Switch to steps view'
                          : 'Switch to timeline view'}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {showTimeline ? (
                  <TraceTimeline
                    runDetail={selectedRun}
                    parseJson={parseJson}
                    formatDuration={formatDuration}
                  />
                ) : (
                  <div className="flex flex-col gap-3">
                    {selectedRun.steps.map((step, index) => {
                      const childRunsForStep = (
                        selectedRun.childRuns ?? []
                      ).filter(cr => cr.run.parent_step_id === step.id);

                      return (
                        <StepCard
                          key={step.id}
                          step={step}
                          index={index}
                          steps={selectedRun.steps}
                          isRunInProgress={
                            selectedRun.run.isInProgress ?? false
                          }
                          expandedSteps={expandedSteps}
                          toggleStep={toggleStep}
                          parseJson={parseJson}
                          formatDuration={formatDuration}
                          childRuns={childRunsForStep}
                          depth={0}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}

export default App;
