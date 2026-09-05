import { z } from 'zod/v4';

/*
 * Diagnostics EMISSION contract — part of the `HarnessV1` spec.
 *
 * These are the types a harness adapter produces and receives: an adapter
 * reports a `HarnessV1Diagnostic` to the framework (a bridge adapter normalizes
 * its wire frames into one; a non-bridge adapter constructs one directly), and
 * receives a `HarnessV1DebugConfig` to gate what it emits. They are distinct
 * from the unaffixed host-facing `HarnessDiagnostic` / `HarnessDebugConfig`
 * (the external/telemetry surface) — the framework maps between the two at the
 * boundary, so the emission and consumption surfaces can evolve independently.
 */

/** Severity of a diagnostic, ordered most → least severe. */
export const harnessV1DebugLevelSchema = z.enum([
  'error',
  'warn',
  'info',
  'debug',
  'trace',
]);

export type HarnessV1DebugLevel = z.infer<typeof harnessV1DebugLevelSchema>;

/**
 * Per-session diagnostics configuration the framework hands an adapter (and the
 * host sends on `start.debug`). When absent or `enabled` is false the adapter
 * captures and emits nothing. `subsystems` filters structured events by dotted
 * prefix; console capture is independent of the subsystem filter.
 */
export const harnessV1DebugConfigSchema = z.object({
  enabled: z.boolean().optional(),
  level: harnessV1DebugLevelSchema.optional(),
  subsystems: z.array(z.string()).optional(),
});

export type HarnessV1DebugConfig = z.infer<typeof harnessV1DebugConfigSchema>;

/**
 * A diagnostic as emitted by a harness adapter. Structurally identical to the
 * host-facing `HarnessDiagnostic` today, but kept separate: this is the spec's
 * emission shape, that is the external consumption shape.
 */
export type HarnessV1Diagnostic = {
  /** Severity. */
  readonly level: HarnessV1DebugLevel;
  /** Human-readable line (console capture) or message (structured event). */
  readonly message: string;
  /** Dotted subsystem (`sandbox.log.<source>` for console capture). */
  readonly subsystem: string;
  /** `'log'` = captured console line; `'event'` = structured emission. */
  readonly kind: 'log' | 'event';
  /** Originating source label (console capture). */
  readonly source?: string;
  /** Which standard stream the line came from (console capture). */
  readonly stream?: 'stdout' | 'stderr';
  /** Structured attributes (structured events only). */
  readonly attrs?: Record<string, unknown>;
  /** Error payload (structured events only). */
  readonly error?: { name?: string; message: string; stack?: string };
  /** The harness session this diagnostic originated from. */
  readonly sessionId?: string;
  /** Emission time (epoch ms). */
  readonly timestamp: number;
};
