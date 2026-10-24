import type {
  HarnessV1DebugConfig,
  HarnessV1Diagnostic,
} from './harness-v1-diagnostic';

/**
 * Diagnostics wiring the framework hands to an adapter's `doStart`. `report` is
 * the general emission sink: a bridge adapter normalizes each wire frame into a
 * `HarnessV1Diagnostic` (via `harnessV1DiagnosticFromBridgeFrame`) and calls it;
 * a non-bridge adapter constructs a `HarnessV1Diagnostic` from its host-side
 * logs/errors and calls it directly. `debug` gates what the adapter emits.
 * Absent when the consumer has not enabled diagnostics.
 */
export type HarnessV1Observability = {
  /** Per-session debug config gating what the adapter captures/emits. */
  readonly debug?: HarnessV1DebugConfig;

  /** General emission sink — any adapter reports a `HarnessV1Diagnostic` here. */
  readonly report?: (diagnostic: HarnessV1Diagnostic) => void;
};
