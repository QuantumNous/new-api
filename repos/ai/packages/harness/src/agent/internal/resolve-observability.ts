import { asArray } from '@ai-sdk/provider-utils';
import type { Telemetry } from 'ai';
import type { HarnessV1Diagnostic, HarnessV1Observability } from '../../v1';
import type {
  HarnessDebugConfig,
  HarnessDebugLevel,
  HarnessDiagnostic,
  HarnessDiagnosticConsumer,
} from '../observability/types';
import type { HarnessAgentSettings } from '../harness-agent-settings';

const ENV_TRUTHY = new Set(['1', 'true', 'yes', 'on']);

function parseList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const items = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

/**
 * Resolve the effective debug config from explicit settings with env-var
 * fallbacks. `HARNESS_DEBUG*` only fill fields the consumer left unset — code is
 * always authoritative.
 */
export function resolveDebugConfig(
  debug: HarnessDebugConfig | undefined,
  env: Record<string, string | undefined> = process.env,
): {
  enabled: boolean;
  level: HarnessDebugLevel;
  subsystems: string[] | undefined;
} {
  const enabled =
    debug?.enabled ?? ENV_TRUTHY.has((env.HARNESS_DEBUG ?? '').toLowerCase());
  const level =
    debug?.level ??
    (env.HARNESS_DEBUG_LEVEL as HarnessDebugLevel | undefined) ??
    'debug';
  const subsystems = debug?.subsystems
    ? [...debug.subsystems]
    : parseList(env.HARNESS_DEBUG_SUBSYSTEMS);
  return { enabled, level, subsystems };
}

/**
 * Map an adapter-emitted `HarnessV1Diagnostic` to the host-facing
 * `HarnessDiagnostic` (the external/telemetry surface). Identity-shaped today,
 * but an explicit boundary so the emission and consumption types can diverge.
 */
function toHarnessDiagnostic(d: HarnessV1Diagnostic): HarnessDiagnostic {
  return {
    level: d.level,
    message: d.message,
    subsystem: d.subsystem,
    kind: d.kind,
    source: d.source,
    stream: d.stream,
    attrs: d.attrs,
    error: d.error,
    sessionId: d.sessionId,
    timestamp: d.timestamp,
  };
}

function formatForStderr(d: HarnessDiagnostic): string {
  const parts = [`[harness:${d.level}]`, d.subsystem, d.message].filter(
    Boolean,
  );
  let line = parts.join(' ');
  if (d.error) {
    line += ` (${d.error.name ?? 'Error'}: ${d.error.message})`;
  }
  return `${line}\n`;
}

/**
 * Build the per-session observability handle the framework hands to `doStart`.
 * Returns `undefined` when diagnostics are disabled. When enabled, the `report`
 * sink maps each adapter-emitted `HarnessV1Diagnostic` to the host
 * `HarnessDiagnostic` and fans it out, non-lossy, to: the `HARNESS_DEBUG` stderr
 * default, the consumer's `onLog`, and any telemetry integration that
 * implements `ingestDiagnostic`. Adapters normalize their own source (bridge
 * wire frames, host logs) into `HarnessV1Diagnostic` before calling `report`.
 */
export function buildObservability(options: {
  settings: Pick<
    HarnessAgentSettings<any, any>,
    'debug' | 'onLog' | 'telemetry'
  >;
}): HarnessV1Observability | undefined {
  const resolved = resolveDebugConfig(options.settings.debug);
  if (!resolved.enabled) return undefined;

  const onLog = options.settings.onLog;
  const integrations = options.settings.telemetry?.integrations
    ? asArray(options.settings.telemetry.integrations)
    : [];
  const diagnosticConsumers = integrations.filter(
    (integration): integration is Telemetry & HarnessDiagnosticConsumer =>
      typeof (integration as HarnessDiagnosticConsumer).ingestDiagnostic ===
      'function',
  );

  const report = (emitted: HarnessV1Diagnostic): void => {
    const diagnostic = toHarnessDiagnostic(emitted);
    try {
      process.stderr.write(formatForStderr(diagnostic));
    } catch {
      // Never let the stderr default break the turn.
    }
    onLog?.(diagnostic);
    for (const consumer of diagnosticConsumers) {
      consumer.ingestDiagnostic?.(diagnostic);
    }
  };

  return {
    debug: {
      enabled: true,
      level: resolved.level,
      ...(resolved.subsystems ? { subsystems: resolved.subsystems } : {}),
    },
    report,
  };
}
