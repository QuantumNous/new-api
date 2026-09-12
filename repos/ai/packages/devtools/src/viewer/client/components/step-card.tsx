import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Wrench,
  MessageSquare,
  AlertCircle,
  Brain,
  Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  Step,
  ChildRun,
  ParseJson,
  ParsedInput,
  ParsedOutput,
  ParsedUsage,
  PromptMessage,
  ContentPart,
} from '../types';
import {
  getStepSummary,
  getStepInputSummary,
  getInputTokenBreakdown,
  getOutputTokenBreakdown,
  formatInputTokens,
  formatOutputTokens,
} from '../utils';
import {
  StepConfigBar,
  RawDataSection,
  TokenBreakdownTooltip,
} from './shared-components';
import { InputPanel } from './message-components';
import { OutputDisplay } from './output-components';

export function StepCard({
  step,
  index,
  steps,
  isRunInProgress,
  expandedSteps,
  toggleStep,
  parseJson,
  formatDuration,
  childRuns,
  depth,
}: {
  step: Step;
  index: number;
  steps: Step[];
  isRunInProgress: boolean;
  expandedSteps: Set<string>;
  toggleStep: (id: string) => void;
  parseJson: ParseJson;
  formatDuration: (ms: number | null) => string;
  childRuns: ChildRun[];
  depth: number;
}) {
  const isExpanded = expandedSteps.has(step.id);
  const isLastStep = index === steps.length - 1;
  const isActiveStep = isLastStep && isRunInProgress;
  const input = parseJson(step.input) as ParsedInput | null;
  const output = parseJson(step.output) as ParsedOutput | null;
  const usage = parseJson(step.usage) as ParsedUsage | null;

  const summary = getStepSummary(output, step.error);
  const isFirstStep = index === 0;
  const inputSummary = getStepInputSummary(input, isFirstStep);

  return (
    <Collapsible open={isExpanded} onOpenChange={() => toggleStep(step.id)}>
      <Card
        className={`overflow-hidden py-0 gap-0 ${isActiveStep ? 'ring-2 ring-blue-500/50 ring-offset-1 ring-offset-background' : ''}`}
      >
        <CollapsibleTrigger asChild>
          <button
            className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-accent/50 ${
              isExpanded ? 'border-b border-border' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-mono w-4">
                {step.step_number}
              </span>
              <div className="flex items-center gap-2">
                {inputSummary && (
                  <>
                    {inputSummary.type === 'user' ? (
                      <MessageSquare className="size-3.5 text-muted-foreground" />
                    ) : (
                      <Wrench className="size-3.5 text-muted-foreground" />
                    )}
                    {inputSummary.fullText || inputSummary.toolDetails ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={`text-sm text-muted-foreground ${inputSummary.type === 'tool' ? 'font-mono' : ''}`}
                          >
                            {inputSummary.label}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          className="max-w-sm max-h-40 overflow-hidden"
                        >
                          <span className="line-clamp-6">
                            {inputSummary.fullText || inputSummary.toolDetails}
                          </span>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span
                        className={`text-sm text-muted-foreground ${inputSummary.type === 'tool' ? 'font-mono' : ''}`}
                      >
                        {inputSummary.label}
                      </span>
                    )}
                    <span className="text-muted-foreground/50 mx-1">→</span>
                  </>
                )}

                {summary.icon === 'wrench' && (
                  <Wrench className="size-3.5 text-muted-foreground" />
                )}
                {summary.icon === 'message' && (
                  <MessageSquare className="size-3.5 text-muted-foreground" />
                )}
                {summary.icon === 'alert' && (
                  <AlertCircle className="size-3.5 text-destructive" />
                )}

                {summary.toolDetails ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm font-medium font-mono">
                        {summary.label}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{summary.toolDetails}</TooltipContent>
                  </Tooltip>
                ) : (
                  <span
                    className={`text-sm font-medium ${
                      summary.icon === 'wrench' ? 'font-mono' : ''
                    }`}
                  >
                    {summary.label}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {isActiveStep ? (
                <span className="text-[11px] text-blue-400 font-medium flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin" />
                  streaming
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground font-mono">
                  {formatDuration(step.duration_ms)}
                </span>
              )}
              {usage && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[11px] font-mono text-muted-foreground cursor-help">
                      {formatInputTokens(
                        getInputTokenBreakdown(usage.inputTokens),
                      )}{' '}
                      <span className="text-muted-foreground/50">→</span>{' '}
                      {formatOutputTokens(
                        getOutputTokenBreakdown(usage.outputTokens),
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <TokenBreakdownTooltip
                      input={getInputTokenBreakdown(usage.inputTokens)}
                      output={getOutputTokenBreakdown(usage.outputTokens)}
                      raw={usage.raw}
                    />
                  </TooltipContent>
                </Tooltip>
              )}
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <StepDetailContent
            step={step}
            index={index}
            steps={steps}
            isRunInProgress={isRunInProgress}
            parseJson={parseJson}
            formatDuration={formatDuration}
            childRuns={childRuns}
            expandedSteps={expandedSteps}
            toggleStep={toggleStep}
            depth={depth}
          />
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function StepDetailContent({
  step,
  index,
  steps,
  isRunInProgress,
  parseJson,
  formatDuration,
  childRuns,
  expandedSteps,
  toggleStep,
  depth,
}: {
  step: Step;
  index: number;
  steps: Step[];
  isRunInProgress: boolean;
  parseJson: ParseJson;
  formatDuration: (ms: number | null) => string;
  childRuns: ChildRun[];
  expandedSteps?: Set<string>;
  toggleStep?: (id: string) => void;
  depth: number;
}) {
  const isLastStep = index === steps.length - 1;
  const isActiveStep = isLastStep && isRunInProgress;
  const input = parseJson(step.input) as ParsedInput | null;
  const output = parseJson(step.output) as ParsedOutput | null;
  const usage = parseJson(step.usage) as ParsedUsage | null;

  const nextStep = steps[index + 1];
  const nextInput = nextStep
    ? (parseJson(nextStep.input) as ParsedInput | null)
    : null;
  const toolResults: ContentPart[] =
    nextInput?.prompt
      ?.filter((msg: PromptMessage) => msg.role === 'tool')
      ?.flatMap((msg: PromptMessage) =>
        Array.isArray(msg.content) ? msg.content : [],
      ) ?? [];

  return (
    <>
      <StepConfigBar
        modelId={step.model_id}
        provider={step.provider}
        input={input}
        providerOptions={
          parseJson(step.provider_options) as Record<string, unknown> | null
        }
        usage={usage}
      />

      <div className="grid grid-cols-2 divide-x divide-border">
        <div className="bg-card/50">
          <InputPanel input={input} />
        </div>

        <div className="p-4 bg-background min-h-full">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Output
          </h3>

          {step.error ? (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive-foreground font-mono">
              {step.error}
            </div>
          ) : output ? (
            <OutputDisplay output={output} toolResults={toolResults} />
          ) : isActiveStep ? (
            <div className="flex items-center gap-2 text-sm text-blue-400">
              <Loader2 className="size-4 animate-spin" />
              <span>Waiting for response...</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No output</p>
          )}
        </div>
      </div>

      {childRuns.length > 0 && expandedSteps && toggleStep && (
        <NestedChildRuns
          childRuns={childRuns}
          expandedSteps={expandedSteps}
          toggleStep={toggleStep}
          parseJson={parseJson}
          formatDuration={formatDuration}
          depth={depth}
        />
      )}

      <RawDataSection
        rawRequest={step.raw_request}
        rawResponse={step.raw_response}
        rawChunks={step.raw_chunks}
        isStream={step.type === 'stream'}
      />
    </>
  );
}

function NestedChildRuns({
  childRuns,
  expandedSteps,
  toggleStep,
  parseJson,
  formatDuration,
  depth,
}: {
  childRuns: ChildRun[];
  expandedSteps: Set<string>;
  toggleStep: (id: string) => void;
  parseJson: ParseJson;
  formatDuration: (ms: number | null) => string;
  depth: number;
}) {
  return (
    <div className="border-t border-border bg-muted/10">
      <div className="px-4 py-2 flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground shrink-0">
          Sub-agent {childRuns.length === 1 ? 'call' : 'calls'} (
          {childRuns.length})
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="px-4 pb-3 flex flex-col gap-2">
        {childRuns.map(childRun => (
          <NestedRunCard
            key={childRun.run.id}
            childRun={childRun}
            expandedSteps={expandedSteps}
            toggleStep={toggleStep}
            parseJson={parseJson}
            formatDuration={formatDuration}
            depth={depth + 1}
          />
        ))}
      </div>
    </div>
  );
}

function NestedRunCard({
  childRun,
  expandedSteps,
  toggleStep,
  parseJson,
  formatDuration,
  depth,
}: {
  childRun: ChildRun;
  expandedSteps: Set<string>;
  toggleStep: (id: string) => void;
  parseJson: ParseJson;
  formatDuration: (ms: number | null) => string;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const firstStep = childRun.steps[0];
  const firstInput = firstStep
    ? (parseJson(firstStep.input) as ParsedInput | null)
    : null;
  const promptMessages = firstInput?.prompt ?? [];
  const userMsg = [...promptMessages]
    .reverse()
    .find((m: PromptMessage) => m.role === 'user');
  let label = 'Sub-agent call';
  if (userMsg) {
    const content =
      typeof userMsg.content === 'string'
        ? userMsg.content
        : Array.isArray(userMsg.content)
          ? userMsg.content.find(
              (p): p is { type: 'text'; text: string } => p.type === 'text',
            )?.text || ''
          : '';
    label = content.length > 60 ? content.slice(0, 60) + '...' : content;
  }

  const totalDuration = childRun.steps.reduce(
    (acc, s) => acc + (s.duration_ms || 0),
    0,
  );
  const modelId = firstStep?.model_id;

  return (
    <div className="rounded-md border border-cyan-500/30 overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/15 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight
          className={`size-3 text-cyan-400 transition-transform shrink-0 ${
            expanded ? 'rotate-90' : ''
          }`}
        />
        <Brain className="size-3 text-cyan-400 shrink-0" />
        <span className="text-xs font-medium text-cyan-400 truncate">
          {label}
        </span>
        <span className="ml-auto flex items-center gap-3 shrink-0">
          {modelId && (
            <span className="text-[10px] font-mono text-muted-foreground">
              {modelId}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {childRun.steps.length}{' '}
            {childRun.steps.length === 1 ? 'step' : 'steps'}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">
            {formatDuration(totalDuration)}
          </span>
          {childRun.run.isInProgress && (
            <Loader2 className="size-3 text-blue-400 animate-spin" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-cyan-500/20 bg-background/50 p-3 flex flex-col gap-2">
          {childRun.steps.map((step, index) => {
            const nestedChildRuns = (childRun.childRuns ?? []).filter(
              cr => cr.run.parent_step_id === step.id,
            );
            return (
              <StepCard
                key={step.id}
                step={step}
                index={index}
                steps={childRun.steps}
                isRunInProgress={childRun.run.isInProgress ?? false}
                expandedSteps={expandedSteps}
                toggleStep={toggleStep}
                parseJson={parseJson}
                formatDuration={formatDuration}
                childRuns={nestedChildRuns}
                depth={depth}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
