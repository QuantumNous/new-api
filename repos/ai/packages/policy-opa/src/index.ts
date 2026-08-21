// Engine-neutral core.
export type { PolicyClient } from './policy-client';
export type { PolicyDecision } from './policy-decision';
export { shadow, type PolicyDecisionEvent } from './shadow';
export { wrapMcpTools, type WrappedMcpTools } from './wrap-mcp-tools';

// OPA backend and adapters.
export { httpPolicyClient } from './opa/http-policy-client';
export { normalizeOpaDecision } from './opa/normalize-opa-decision';
export {
  type DefaultOpaCapabilityInput,
  opaCapabilityMiddleware,
} from './opa/opa-capability-middleware';
export {
  type DefaultOpaInput,
  opaPolicy,
  optionalOpaPolicy,
} from './opa/opa-policy';
export { wasmPolicyClient } from './opa/wasm-policy-client';
