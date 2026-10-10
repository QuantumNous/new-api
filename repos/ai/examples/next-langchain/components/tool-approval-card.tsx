'use client';

import { useState } from 'react';
import { Shield, Check, X } from 'lucide-react';
import type { UIMessage } from 'ai';

/**
 * Tool Approval Card Component
 *
 * Note: The AI SDK's addToolApprovalResponse doesn't currently support
 * passing edited input values. The edit functionality would require
 * extending the API to support edited input in the approval response.
 */
export function ToolApprovalCard({
  toolName,
  input,
  approvalId,
  onApprove,
  onReject,
}: {
  toolName: string;
  input: unknown;
  approvalId: string;
  onApprove: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
}) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  return (
    <div className="border border-amber-500/30 bg-amber-500/10 rounded-xl p-4 space-y-4 mt-4">
      <div className="flex items-center gap-2 text-amber-400">
        <Shield className="w-5 h-5" />
        <span className="font-medium">Action Requires Approval</span>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-[var(--foreground-secondary)]">
          Tool:{' '}
          <code className="bg-[var(--background-tertiary)] px-2 py-0.5 rounded">
            {toolName}
          </code>
        </div>

        <pre className="bg-[var(--background-tertiary)] border border-[var(--border)] rounded-lg p-3 text-sm overflow-x-auto">
          {JSON.stringify(input, null, 2)}
        </pre>
      </div>

      {showRejectInput && (
        <div className="space-y-2">
          <label className="text-sm text-[var(--foreground-secondary)]">
            Rejection reason (optional):
          </label>
          <input
            type="text"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Enter reason for rejection..."
            className="w-full bg-[var(--background-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)]"
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onApprove(approvalId)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
        >
          <Check className="w-4 h-4" />
          Approve
        </button>
        {showRejectInput ? (
          <button
            onClick={() => {
              onReject(approvalId, rejectReason || 'User rejected the action');
              setShowRejectInput(false);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Confirm Reject
          </button>
        ) : (
          <button
            onClick={() => setShowRejectInput(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Reject
          </button>
        )}
        {showRejectInput && (
          <button
            onClick={() => setShowRejectInput(false)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--background-tertiary)] hover:bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--foreground)] rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Extract pending approvals from messages
 */
export function getPendingApprovals(messages: UIMessage[]) {
  const approvals: Array<{
    toolName: string;
    toolCallId: string;
    input: unknown;
    approvalId: string;
  }> = [];

  for (const message of messages) {
    if (message.role !== 'assistant') continue;

    for (const part of message.parts) {
      // Check for dynamic-tool parts with approval-requested state
      if (part.type === 'dynamic-tool' && part.state === 'approval-requested') {
        approvals.push({
          toolName: part.toolName,
          toolCallId: part.toolCallId,
          input: part.input,
          approvalId: part.approval.id,
        });
      }
    }
  }

  return approvals;
}
