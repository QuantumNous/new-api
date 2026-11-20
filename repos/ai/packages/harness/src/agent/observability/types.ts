/*
 * Host/consumer-facing observability types.
 *
 * These are deliberately NOT part of the versioned adapter spec: no harness
 * adapter implements or consumes them. Adapters only deal with bridge wire
 * frames and the observability handle the framework hands to `doStart`. The
 * framework normalizes those frames into the `HarnessDiagnostic` shape below
 * for consumers (`HarnessAgentSettings.onLog`) and reporters.
 */

/** Severity of a diagnostic. */
export type HarnessDebugLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * Consumer-facing diagnostics configuration. Set on `HarnessAgentSettings` to
 * enable bridge log forwarding and the `HARNESS_DEBUG` stderr default in code.
 * `HARNESS_DEBUG` / `HARNESS_DEBUG_LEVEL` / `HARNESS_DEBUG_SUBSYSTEMS` env vars
 * fill any unset field — a convenience default, never the only path.
 */
export type HarnessDebugConfig = {
  /** Master switch. Nothing is captured or forwarded when false/unset. */
  readonly enabled?: boolean;
  /** Threshold; events at or above this severity are emitted. Default `debug`. */
  readonly level?: HarnessDebugLevel;
  /** Dotted-prefix subsystem filter for structured events. */
  readonly subsystems?: ReadonlyArray<string>;
};

/**
 * A forwarded bridge diagnostic, normalized for host consumers.
 *
 * The bridge emits two raw frame kinds — captured console lines (`sandbox-log`)
 * and structured events (`debug-event`). The framework normalizes both into
 * this single shape before handing them to a consumer's `onLog` callback, the
 * `HARNESS_DEBUG` stderr default, and observability reporters. Diagnostics are
 * kept first-class and per-line — they are never folded into telemetry spans.
 */
export type HarnessDiagnostic = {
  /**
   * Severity. Structured events carry their own level; captured console lines
   * map `stderr` → `'warn'` and `stdout` → `'info'`.
   */
  readonly level: HarnessDebugLevel;

  /** Human-readable line (console capture) or message (structured event). */
  readonly message: string;

  /**
   * Dotted subsystem. For captured console output this is
   * `sandbox.log.<source>`; for structured events it is the adapter-supplied
   * subsystem (e.g. `bridge.turn`).
   */
  readonly subsystem: string;

  /** `'log'` = captured console line; `'event'` = structured `bridgeLog`. */
  readonly kind: 'log' | 'event';

  /** Originating sandbox source label (console capture). */
  readonly source?: string;

  /** Which standard stream the line came from (console capture). */
  readonly stream?: 'stdout' | 'stderr';

  /** Structured attributes (structured events only). */
  readonly attrs?: Record<string, unknown>;

  /** Error payload (structured events only). */
  readonly error?: { name?: string; message: string; stack?: string };

  /** The harness session this diagnostic originated from. */
  readonly sessionId?: string;

  /** Host receipt time (epoch ms). */
  readonly timestamp: number;
};

/**
 * A telemetry integration that also wants the per-line diagnostics stream. The
 * framework calls `ingestDiagnostic` for every forwarded bridge diagnostic in
 * addition to driving the standard `Telemetry` span lifecycle, so a single
 * reporter object (e.g. `createFileReporter`) registered in
 * `telemetry.integrations` receives both spans and logs.
 */
export interface HarnessDiagnosticConsumer {
  ingestDiagnostic?(diagnostic: HarnessDiagnostic): void;
}
