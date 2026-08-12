/**
 * Narrowed object form of the SDK's `ToolApprovalStatus`.
 *
 * The public `ToolApprovalStatus` from `ai` allows both bare strings
 * (`'approved'`) and the matching object form (`{ type: 'approved' }`). This
 * package normalizes everything to the object form internally so callers like
 * `shadow` can rely on a single discriminant.
 */
export type PolicyDecision =
  | { type: 'approved'; reason?: string }
  | { type: 'denied'; reason?: string }
  | { type: 'user-approval' }
  | { type: 'not-applicable' };
