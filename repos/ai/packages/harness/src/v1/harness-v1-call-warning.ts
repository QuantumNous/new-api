/**
 * Warning emitted by a harness adapter during a call.
 *
 * Surfaces non-fatal issues such as unsupported options or quirks of the
 * underlying agent runtime. Mirrors the shape of `SharedV4Warning` but lives
 * in the harness namespace.
 */
export type HarnessV1CallWarning =
  | {
      type: 'unsupported-setting';
      setting: string;
      details?: string;
    }
  | {
      type: 'unsupported-tool';
      tool: string;
      details?: string;
    }
  | {
      type: 'other';
      message: string;
    };
