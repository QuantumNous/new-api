import type { Telemetry } from 'ai';
import { fetch as workflowFetch } from 'workflow';

const ENDPOINT =
  process.env.NEXT_WORKFLOW_DEVTOOLS_BRIDGE_URL ??
  'http://localhost:3000/api/devtools-telemetry';

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, raw) => {
    if (typeof raw === 'function') {
      return undefined;
    }
    if (raw == null || typeof raw !== 'object') {
      return raw;
    }
    if (seen.has(raw)) {
      return '[Circular]';
    }
    seen.add(raw);
    if (raw instanceof Map) {
      return Object.fromEntries(raw);
    }
    if (raw instanceof Set) {
      return Array.from(raw);
    }
    if ('_def' in raw && '~standard' in raw) {
      return { _placeholder: 'ZodSchema' };
    }
    if (raw instanceof Error) {
      return { name: raw.name, message: raw.message, stack: raw.stack };
    }
    return raw;
  });
}

const dispatch = (name: keyof Telemetry) => async (event: unknown) => {
  try {
    await workflowFetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: safeStringify({ name, event }),
    });
  } catch (error) {
    console.error('[devtools-bridge] dispatch failed', error);
  }
};

export const devToolsTelemetry: Telemetry = {
  onStart: dispatch('onStart'),
  onStepStart: dispatch('onStepStart'),
  onLanguageModelCallStart: dispatch('onLanguageModelCallStart'),
  onLanguageModelCallEnd: dispatch('onLanguageModelCallEnd'),
  onStepFinish: dispatch('onStepFinish'),
  onObjectStepStart: dispatch('onObjectStepStart'),
  onObjectStepEnd: dispatch('onObjectStepEnd'),
  onEnd: dispatch('onEnd'),
  onError: dispatch('onError'),
};
