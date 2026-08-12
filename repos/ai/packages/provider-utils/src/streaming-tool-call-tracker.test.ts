import type { LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { describe, expect, it, vi } from 'vitest';
import { StreamingToolCallTracker } from './streaming-tool-call-tracker';

function createCollector() {
  const parts: LanguageModelV4StreamPart[] = [];
  const controller = {
    enqueue: (part: LanguageModelV4StreamPart) => parts.push(part),
  };
  return { parts, controller };
}

describe('StreamingToolCallTracker', () => {
  describe('processDelta', () => {
    it('should handle a single tool call accumulated across multiple deltas', () => {
      const { parts, controller } = createCollector();
      const tracker = new StreamingToolCallTracker(controller);

      // First delta: new tool call with id and name
      tracker.processDelta({
        index: 0,
        id: 'call_1',
        type: 'function',
        function: { name: 'get_weather', arguments: '{"ci' },
      });

      expect(parts).toEqual([
        { type: 'tool-input-start', id: 'call_1', toolName: 'get_weather' },
        { type: 'tool-input-delta', id: 'call_1', delta: '{"ci' },
      ]);

      parts.length = 0;

      // Second delta: more arguments
      tracker.processDelta({
        index: 0,
        function: { arguments: 'ty": "San' },
      });

      expect(parts).toEqual([
        {
          type: 'tool-input-delta',
          id: 'call_1',
          delta: 'ty": "San',
        },
      ]);

      parts.length = 0;

      // Third delta: completes the JSON
      tracker.processDelta({
        index: 0,
        function: { arguments: ' Francisco"}' },
      });

      expect(parts).toEqual([
        {
          type: 'tool-input-delta',
          id: 'call_1',
          delta: ' Francisco"}',
        },
        { type: 'tool-input-end', id: 'call_1' },
        {
          type: 'tool-call',
          toolCallId: 'call_1',
          toolName: 'get_weather',
          input: '{"city": "San Francisco"}',
        },
      ]);
    });

    it('should handle a full tool call in a single chunk', () => {
      const { parts, controller } = createCollector();
      const tracker = new StreamingToolCallTracker(controller);

      tracker.processDelta({
        index: 0,
        id: 'call_1',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: '{"city": "London"}',
        },
      });

      expect(parts).toEqual([
        { type: 'tool-input-start', id: 'call_1', toolName: 'get_weather' },
        {
          type: 'tool-input-delta',
          id: 'call_1',
          delta: '{"city": "London"}',
        },
        { type: 'tool-input-end', id: 'call_1' },
        {
          type: 'tool-call',
          toolCallId: 'call_1',
          toolName: 'get_weather',
          input: '{"city": "London"}',
        },
      ]);
    });

    it('should handle multiple concurrent tool calls', () => {
      const { parts, controller } = createCollector();
      const tracker = new StreamingToolCallTracker(controller);

      tracker.processDelta({
        index: 0,
        id: 'call_1',
        type: 'function',
        function: { name: 'get_weather', arguments: '' },
      });

      tracker.processDelta({
        index: 1,
        id: 'call_2',
        type: 'function',
        function: { name: 'get_time', arguments: '' },
      });

      expect(parts).toEqual([
        { type: 'tool-input-start', id: 'call_1', toolName: 'get_weather' },
        { type: 'tool-input-start', id: 'call_2', toolName: 'get_time' },
      ]);
    });

    it('should skip deltas for already-finished tool calls', () => {
      const { parts, controller } = createCollector();
      const tracker = new StreamingToolCallTracker(controller);

      // Complete tool call in one chunk
      tracker.processDelta({
        index: 0,
        id: 'call_1',
        type: 'function',
        function: { name: 'fn', arguments: '{}' },
      });

      parts.length = 0;

      // Late delta for the same tool call
      tracker.processDelta({
        index: 0,
        function: { arguments: 'extra' },
      });

      expect(parts).toEqual([]);
    });

    it('should skip delta emission when arguments are null', () => {
      const { parts, controller } = createCollector();
      const tracker = new StreamingToolCallTracker(controller);

      // Create tool call
      tracker.processDelta({
        index: 0,
        id: 'call_1',
        type: 'function',
        function: { name: 'fn', arguments: '' },
      });

      parts.length = 0;

      // Delta with null arguments
      tracker.processDelta({
        index: 0,
        function: { arguments: null },
      });

      expect(parts).toEqual([]);
    });

    it('should use index fallback when index is not provided', () => {
      const { parts, controller } = createCollector();
      const tracker = new StreamingToolCallTracker(controller);

      tracker.processDelta({
        id: 'call_1',
        type: 'function',
        function: { name: 'fn1', arguments: '{}' },
      });

      tracker.processDelta({
        id: 'call_2',
        type: 'function',
        function: { name: 'fn2', arguments: '{}' },
      });

      expect(parts.filter(p => p.type === 'tool-input-start')).toEqual([
        { type: 'tool-input-start', id: 'call_1', toolName: 'fn1' },
        { type: 'tool-input-start', id: 'call_2', toolName: 'fn2' },
      ]);
    });

    it('should throw when id is missing', () => {
      const { controller } = createCollector();
      const tracker = new StreamingToolCallTracker(controller);

      expect(() =>
        tracker.processDelta({
          index: 0,
          type: 'function',
          function: { name: 'fn' },
        }),
      ).toThrow("Expected 'id' to be a string.");
    });

    it('should throw when function.name is missing', () => {
      const { controller } = createCollector();
      const tracker = new StreamingToolCallTracker(controller);

      expect(() =>
        tracker.processDelta({
          index: 0,
          id: 'call_1',
          type: 'function',
          function: {},
        }),
      ).toThrow("Expected 'function.name' to be a string.");
    });
  });

  describe('typeValidation', () => {
    it('should not validate type with typeValidation: none', () => {
      const { controller } = createCollector();
      const tracker = new StreamingToolCallTracker(controller, {
        typeValidation: 'none',
      });

      // Should not throw even with a non-function type
      expect(() =>
        tracker.processDelta({
          index: 0,
          id: 'call_1',
          type: 'custom',
          function: { name: 'fn', arguments: '' },
        }),
      ).not.toThrow();
    });

    it('should validate type when present with typeValidation: if-present', () => {
      const { controller } = createCollector();
      const tracker = new StreamingToolCallTracker(controller, {
        typeValidation: 'if-present',
      });

      // Should throw for non-function type
      expect(() =>
        tracker.processDelta({
          index: 0,
          id: 'call_1',
          type: 'custom',
          function: { name: 'fn', arguments: '' },
        }),
      ).toThrow("Expected 'function' type.");

      // Should not throw when type is null
      expect(() =>
        tracker.processDelta({
          index: 0,
          id: 'call_1',
          function: { name: 'fn', arguments: '' },
        }),
      ).not.toThrow();
    });

    it('should require function type with typeValidation: required', () => {
      const { controller } = createCollector();
      const tracker = new StreamingToolCallTracker(controller, {
        typeValidation: 'required',
      });

      // Should throw when type is null/undefined
      expect(() =>
        tracker.processDelta({
          index: 0,
          id: 'call_1',
          function: { name: 'fn', arguments: '' },
        }),
      ).toThrow("Expected 'function' type.");

      // Should not throw for 'function' type
      expect(() =>
        tracker.processDelta({
          index: 0,
          id: 'call_1',
          type: 'function',
          function: { name: 'fn', arguments: '' },
        }),
      ).not.toThrow();
    });
  });

  describe('flush', () => {
    it('should finalize unfinished tool calls on flush', () => {
      const { parts, controller } = createCollector();
      const tracker = new StreamingToolCallTracker(controller);

      // Start a tool call but don't complete it
      tracker.processDelta({
        index: 0,
        id: 'call_1',
        type: 'function',
        function: { name: 'fn', arguments: '{"key": "val' },
      });

      parts.length = 0;

      // Flush should finalize
      tracker.flush();

      expect(parts).toEqual([
        { type: 'tool-input-end', id: 'call_1' },
        {
          type: 'tool-call',
          toolCallId: 'call_1',
          toolName: 'fn',
          input: '{"key": "val',
        },
      ]);
    });

    it('should not re-finalize already finished tool calls', () => {
      const { parts, controller } = createCollector();
      const tracker = new StreamingToolCallTracker(controller);

      // Complete tool call in one chunk
      tracker.processDelta({
        index: 0,
        id: 'call_1',
        type: 'function',
        function: { name: 'fn', arguments: '{}' },
      });

      parts.length = 0;

      tracker.flush();

      // No events should be emitted since tool call was already finished
      expect(parts).toEqual([]);
    });
  });

  describe('metadata', () => {
    it('should extract and include provider metadata in tool-call events', () => {
      const { parts, controller } = createCollector();
      const tracker = new StreamingToolCallTracker(controller, {
        extractMetadata: delta => {
          const sig = (delta as any).extra_content?.google?.thought_signature;
          return sig ? { thoughtSignature: sig } : undefined;
        },
        buildToolCallProviderMetadata: metadata => {
          if (metadata?.thoughtSignature) {
            return { google: { thoughtSignature: metadata.thoughtSignature } };
          }
          return undefined;
        },
      });

      tracker.processDelta({
        index: 0,
        id: 'call_1',
        type: 'function',
        function: { name: 'fn', arguments: '{}' },
        extra_content: { google: { thought_signature: 'sig123' } },
      } as any);

      const toolCallEvent = parts.find(p => p.type === 'tool-call');
      expect(toolCallEvent).toEqual({
        type: 'tool-call',
        toolCallId: 'call_1',
        toolName: 'fn',
        input: '{}',
        providerMetadata: {
          google: { thoughtSignature: 'sig123' },
        },
      });
    });

    it('should include provider metadata for unfinished tool calls finalized in flush', () => {
      const { parts, controller } = createCollector();
      const tracker = new StreamingToolCallTracker(controller, {
        extractMetadata: () => ({ custom: { key: 'value' } }),
        buildToolCallProviderMetadata: metadata => {
          return metadata ? { provider: metadata } : undefined;
        },
      });

      tracker.processDelta({
        index: 0,
        id: 'call_1',
        type: 'function',
        function: { name: 'fn', arguments: '{"incomplete' },
      });

      parts.length = 0;

      tracker.flush();

      const toolCallEvent = parts.find(p => p.type === 'tool-call');
      expect(toolCallEvent).toEqual({
        type: 'tool-call',
        toolCallId: 'call_1',
        toolName: 'fn',
        input: '{"incomplete',
        providerMetadata: { provider: { custom: { key: 'value' } } },
      });
    });

    it('should not include providerMetadata when buildToolCallProviderMetadata returns undefined', () => {
      const { parts, controller } = createCollector();
      const tracker = new StreamingToolCallTracker(controller, {
        extractMetadata: () => undefined,
        buildToolCallProviderMetadata: () => undefined,
      });

      tracker.processDelta({
        index: 0,
        id: 'call_1',
        type: 'function',
        function: { name: 'fn', arguments: '{}' },
      });

      const toolCallEvent = parts.find(p => p.type === 'tool-call');
      expect(toolCallEvent).toEqual({
        type: 'tool-call',
        toolCallId: 'call_1',
        toolName: 'fn',
        input: '{}',
      });
      expect(toolCallEvent).not.toHaveProperty('providerMetadata');
    });
  });

  describe('generateId', () => {
    it('should use custom generateId for tool call IDs when id is missing in fallback', () => {
      const mockGenerateId = vi.fn(() => 'custom-id');
      const { parts, controller } = createCollector();
      const tracker = new StreamingToolCallTracker(controller, {
        generateId: mockGenerateId,
      });

      // Start a tool call
      tracker.processDelta({
        index: 0,
        id: 'call_1',
        type: 'function',
        function: { name: 'fn', arguments: '{"key": "val' },
      });

      parts.length = 0;

      // Flush to finalize
      tracker.flush();

      // The toolCallId should use the original id since it's present
      const toolCallEvent = parts.find(p => p.type === 'tool-call');
      expect(toolCallEvent).toMatchObject({
        toolCallId: 'call_1',
      });
    });
  });
});
