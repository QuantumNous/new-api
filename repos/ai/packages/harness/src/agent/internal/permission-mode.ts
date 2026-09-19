import type { ToolApprovalStatus } from 'ai';
import type { HarnessV1PermissionMode } from '../../v1';
import type { HarnessAgentToolApprovalConfiguration } from '../harness-agent-settings';

export const DEFAULT_PERMISSION_MODE: HarnessV1PermissionMode =
  'allow-all' as const;

export function resolvePermissionMode(input: {
  permissionMode: HarnessV1PermissionMode | undefined;
}): HarnessV1PermissionMode {
  return input.permissionMode ?? DEFAULT_PERMISSION_MODE;
}

export function permissionModeNeedsBuiltinSupport(input: {
  permissionMode: HarnessV1PermissionMode;
}): boolean {
  return input.permissionMode !== 'allow-all';
}

export type CustomToolApprovalDecision =
  | { readonly type: 'allow'; readonly reason?: string }
  | { readonly type: 'deny'; readonly reason?: string }
  | { readonly type: 'request' };

export function resolveCustomToolApproval(input: {
  toolName: string;
  toolApproval: HarnessAgentToolApprovalConfiguration | undefined;
}): CustomToolApprovalDecision {
  const status = normalizeToolApprovalStatus({
    status: input.toolApproval?.[input.toolName],
  });

  switch (status.type) {
    case 'not-applicable':
    case 'approved':
      return { type: 'allow', reason: status.reason };
    case 'denied':
      return { type: 'deny', reason: status.reason };
    case 'user-approval':
      return { type: 'request' };
  }
}

function normalizeToolApprovalStatus(input: {
  status: ToolApprovalStatus | undefined;
}): Exclude<ToolApprovalStatus, string | undefined> {
  if (input.status === undefined) return { type: 'not-applicable' };
  if (typeof input.status === 'string') return { type: input.status };
  return input.status;
}
