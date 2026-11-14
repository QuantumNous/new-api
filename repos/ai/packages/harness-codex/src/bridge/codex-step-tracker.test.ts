import type { BridgeEvent } from '@ai-sdk/harness/bridge';
import { describe, expect, it } from 'vitest';
import { createCodexStepTracker } from './codex-step-tracker';

function createTracker() {
  const events: BridgeEvent[] = [];
  return {
    events,
    tracker: createCodexStepTracker({
      send: event => events.push(event),
    }),
  };
}

describe('createCodexStepTracker', () => {
  it('keeps a model text step open until turn end', () => {
    const { events, tracker } = createTracker();

    tracker.observeEvent({
      event: {
        type: 'item.completed',
        item: { type: 'agent_message' },
      },
      itemId: 'item_0',
    });

    expect(events).toEqual([]);

    tracker.finishStep();

    expect(events.map(event => event.type)).toEqual(['finish-step']);
  });

  it('closes a step after a tool call/result item completes', () => {
    const { events, tracker } = createTracker();

    tracker.observeEvent({
      event: {
        type: 'item.started',
        item: { type: 'command_execution' },
      },
      itemId: 'item_1',
    });
    tracker.observeEvent({
      event: {
        type: 'item.completed',
        item: { type: 'command_execution' },
      },
      itemId: 'item_1',
    });

    expect(events.map(event => event.type)).toEqual(['finish-step']);
  });

  it('does not close a step while a tool item is still pending', () => {
    const { events, tracker } = createTracker();

    tracker.observeEvent({
      event: {
        type: 'item.started',
        item: { type: 'command_execution' },
      },
      itemId: 'item_2',
    });
    tracker.observeEvent({
      event: {
        type: 'item.completed',
        item: { type: 'agent_message' },
      },
      itemId: 'item_3',
    });

    expect(events).toEqual([]);

    tracker.observeEvent({
      event: {
        type: 'item.completed',
        item: { type: 'command_execution' },
      },
      itemId: 'item_2',
    });

    expect(events.map(event => event.type)).toEqual(['finish-step']);
  });

  it('closes a final model text step at turn end after a tool step', () => {
    const { events, tracker } = createTracker();

    tracker.observeEvent({
      event: {
        type: 'item.started',
        item: { type: 'command_execution' },
      },
      itemId: 'item_1',
    });
    tracker.observeEvent({
      event: {
        type: 'item.completed',
        item: { type: 'command_execution' },
      },
      itemId: 'item_1',
    });
    tracker.observeEvent({
      event: {
        type: 'item.completed',
        item: { type: 'agent_message' },
      },
      itemId: 'item_2',
    });

    expect(events.map(event => event.type)).toEqual(['finish-step']);

    tracker.finishStep();

    expect(events.map(event => event.type)).toEqual([
      'finish-step',
      'finish-step',
    ]);
  });
});
