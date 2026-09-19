import type { BridgeEvent } from '@ai-sdk/harness/bridge';

type Emit = (msg: BridgeEvent) => void;

export type CodexStepTrackerItem = {
  type: string;
};

export type CodexStepTrackerEvent = {
  type: string;
  item?: CodexStepTrackerItem;
};

export type CodexStepTracker = {
  observeEvent(input: {
    event: CodexStepTrackerEvent;
    itemId: string | undefined;
  }): void;
  finishStep(): void;
};

export function createCodexStepTracker(input: {
  send: Emit;
}): CodexStepTracker {
  let stepOpen = false;
  const pendingToolItemIds = new Set<string>();

  const finishStep = (): void => {
    if (!stepOpen || pendingToolItemIds.size > 0) return;
    input.send({
      type: 'finish-step',
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: defaultUsage(),
      harnessMetadata: { codex: { inferredStep: true } },
    });
    stepOpen = false;
  };

  return {
    observeEvent({ event, itemId }) {
      const item = event.item;
      if (!item || !isStepItem(item)) return;

      stepOpen = true;

      if (isToolStepItem(item)) {
        if (event.type === 'item.started' && itemId) {
          pendingToolItemIds.add(itemId);
        } else if (event.type === 'item.completed') {
          if (itemId) pendingToolItemIds.delete(itemId);
          finishStep();
        }
        return;
      }
    },
    finishStep,
  };
}

function isStepItem(item: CodexStepTrackerItem): boolean {
  return isModelStepItem(item) || isToolStepItem(item);
}

function isModelStepItem(item: CodexStepTrackerItem): boolean {
  return item.type === 'reasoning' || item.type === 'agent_message';
}

function isToolStepItem(item: CodexStepTrackerItem): boolean {
  return (
    item.type === 'command_execution' ||
    item.type === 'mcp_tool_call' ||
    item.type === 'web_search' ||
    item.type === 'file_change' ||
    item.type === 'todo_list'
  );
}

export function defaultUsage(): Record<string, unknown> {
  return {
    inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 0, text: 0 },
  };
}
