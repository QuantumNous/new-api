import type { ElicitationResponse } from './types';

// Use globalThis to ensure the Map is shared across all Next.js API routes
// This prevents issues with module reloading in development
declare global {
  var pendingElicitations:
    | Map<
        string,
        {
          resolve: (response: ElicitationResponse) => void;
          reject: (error: Error) => void;
          createdAt: number;
          timeoutId: NodeJS.Timeout;
        }
      >
    | undefined;
}

// Store pending elicitation requests with their resolvers
const pendingElicitations =
  globalThis.pendingElicitations ??
  new Map<
    string,
    {
      resolve: (response: ElicitationResponse) => void;
      reject: (error: Error) => void;
      createdAt: number;
      timeoutId: NodeJS.Timeout;
    }
  >();

// Persist to globalThis
globalThis.pendingElicitations = pendingElicitations;

// Cleanup old/stale elicitations periodically
function cleanupStaleElicitations() {
  const now = Date.now();
  const staleThreshold = 10 * 60 * 1000; // 10 minutes

  const entries = Array.from(pendingElicitations.entries());
  for (const [id, data] of entries) {
    if (now - data.createdAt > staleThreshold) {
      console.log('[store] Cleaning up stale elicitation:', id);
      clearTimeout(data.timeoutId);
      pendingElicitations.delete(id);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupStaleElicitations, 60 * 1000);

export function createPendingElicitation(
  id: string,
): Promise<ElicitationResponse> {
  console.log('[store] Creating pending elicitation:', id);
  console.log(
    '[store] Current pending IDs:',
    Array.from(pendingElicitations.keys()),
  );
  console.log('[store] Current pending count:', pendingElicitations.size);

  // Check if this ID already exists (shouldn't happen, but handle it)
  if (pendingElicitations.has(id)) {
    console.warn('[store] WARNING: Elicitation ID already exists:', id);
    const existing = pendingElicitations.get(id);
    if (existing) {
      clearTimeout(existing.timeoutId);
      pendingElicitations.delete(id);
    }
  }

  return new Promise<ElicitationResponse>((resolve, reject) => {
    // Set a timeout to prevent hanging indefinitely (60 seconds to match MCP timeout)
    const timeoutId = setTimeout(() => {
      if (pendingElicitations.has(id)) {
        console.log('[store] Timeout for elicitation:', id);
        pendingElicitations.delete(id);
        reject(new Error('Request timed out'));
      }
    }, 60 * 1000);

    pendingElicitations.set(id, {
      resolve,
      reject,
      createdAt: Date.now(),
      timeoutId,
    });
    console.log('[store] Added to map. New count:', pendingElicitations.size);
  });
}

export function resolvePendingElicitation(
  response: ElicitationResponse,
): boolean {
  console.log('[store] Attempting to resolve:', response.id);
  console.log(
    '[store] Current pending IDs:',
    Array.from(pendingElicitations.keys()),
  );

  const pending = pendingElicitations.get(response.id);

  if (!pending) {
    console.log('[store] Not found in map!');
    return false;
  }

  console.log('[store] Found! Resolving...');
  clearTimeout(pending.timeoutId);
  pending.resolve(response);
  pendingElicitations.delete(response.id);
  console.log(
    '[store] Resolved and removed. Remaining count:',
    pendingElicitations.size,
  );
  return true;
}

export function rejectPendingElicitation(id: string, error: Error): boolean {
  console.log('[store] Attempting to reject:', id);
  const pending = pendingElicitations.get(id);

  if (!pending) {
    console.log('[store] Not found in map for rejection!');
    return false;
  }

  console.log('[store] Found! Rejecting...');
  clearTimeout(pending.timeoutId);
  pending.reject(error);
  pendingElicitations.delete(id);
  console.log(
    '[store] Rejected and removed. Remaining count:',
    pendingElicitations.size,
  );
  return true;
}
