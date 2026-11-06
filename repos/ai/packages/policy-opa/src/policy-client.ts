/**
 * A generic client for evaluating a policy decision against some external
 * engine (OPA, Cedar, OpenFGA, a remote HTTP rule service, etc.).
 *
 * Each adapter in this package wraps a backend behind this interface so that
 * the rest of the package (and user code) can switch engines without changing
 * call sites.
 */
export interface PolicyClient {
  /**
   * Evaluate the given input against the policy identified by `path` and
   * return the decision payload the engine emitted. Adapters are responsible
   * for interpreting that payload. For OPA, `opaPolicy` normalizes it into
   * the SDK's `ToolApprovalStatus` shape.
   */
  evaluate<TInput = unknown, TResult = unknown>(
    path: string,
    input: TInput,
  ): Promise<TResult>;
}
