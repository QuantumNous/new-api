import type { Telemetry } from 'ai';

/**
 * A harness observability reporter that renders an ASCII trace tree of a
 * turn's span lifecycle (turn → steps → tools) to a stream at turn end. It is a
 * `Telemetry` integration — register it in `telemetry.integrations`. Useful for
 * zero-setup local debugging when no OTel collector is wired up; a real OTel
 * backend (via `@ai-sdk/otel`) is a strict superset.
 */
export interface TraceTreeReporterOptions {
  /** Where to write the rendered tree. Default `process.stderr.write`. */
  write?: (chunk: string) => void;
}

type Node = {
  label: string;
  startMs: number;
  endMs?: number;
  children: Node[];
};

export function createTraceTreeReporter(
  options: TraceTreeReporterOptions = {},
): Telemetry {
  const write =
    options.write ?? ((chunk: string) => void process.stderr.write(chunk));

  type TurnState = {
    root: Node;
    step?: Node;
    tools: Map<string, Node>;
  };
  const turns = new Map<string, TurnState>();

  const render = (node: Node, depth: number): string => {
    const indent = '  '.repeat(depth);
    const dur =
      node.endMs != null
        ? `${Math.max(0, Math.round(node.endMs - node.startMs))}ms`
        : '(open)';
    let out = `${indent}- ${node.label} ${dur}\n`;
    for (const child of node.children) out += render(child, depth + 1);
    return out;
  };

  return {
    onStart(event) {
      const e = event as {
        callId: string;
        operationId?: string;
        modelId?: string;
      };
      turns.set(e.callId, {
        root: {
          label: `${e.operationId ?? 'turn'}${e.modelId ? ` ${e.modelId}` : ''}`,
          startMs: Date.now(),
          children: [],
        },
        tools: new Map(),
      });
    },
    onStepStart(event) {
      const e = event as { callId: string; stepNumber?: number };
      const turn = turns.get(e.callId);
      if (!turn) return;
      const step: Node = {
        label: `step ${(e.stepNumber ?? turn.root.children.length) + 1}`,
        startMs: Date.now(),
        children: [],
      };
      turn.step = step;
      turn.root.children.push(step);
    },
    onToolExecutionStart(event) {
      const e = event as {
        callId: string;
        toolCall: { toolName: string; toolCallId: string };
      };
      const turn = turns.get(e.callId);
      const parent = turn?.step ?? turn?.root;
      if (!turn || !parent) return;
      const node: Node = {
        label: `tool ${e.toolCall.toolName}`,
        startMs: Date.now(),
        children: [],
      };
      turn.tools.set(e.toolCall.toolCallId, node);
      parent.children.push(node);
    },
    onToolExecutionEnd(event) {
      const e = event as {
        callId: string;
        toolCall: { toolCallId: string };
        toolOutput: { type: string };
      };
      const node = turns.get(e.callId)?.tools.get(e.toolCall.toolCallId);
      if (!node) return;
      node.endMs = Date.now();
      if (e.toolOutput.type === 'error') node.label += ' [error]';
    },
    onStepFinish(event) {
      const e = event as { callId: string };
      const turn = turns.get(e.callId);
      if (turn?.step) {
        turn.step.endMs = Date.now();
        turn.step = undefined;
      }
    },
    onEnd(event) {
      const e = event as { callId: string };
      const turn = turns.get(e.callId);
      if (!turn) return;
      turn.root.endMs = Date.now();
      turns.delete(e.callId);
      try {
        write(`\n${render(turn.root, 0)}`);
      } catch {
        // Never let rendering break the turn.
      }
    },
  };
}
