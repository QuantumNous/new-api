import type { ElicitationResponse } from '../types';
import { resolvePendingElicitation } from '../elicitation-store';

export async function POST(req: Request) {
  try {
    const response: ElicitationResponse = await req.json();

    console.log('[respond] ========================================');
    console.log('[respond] RESPONSE RECEIVED FROM FRONTEND');
    console.log('[respond] ID:', response.id);
    console.log('[respond] Action:', response.action);
    if (response.action === 'accept') {
      console.log(
        '[respond] Content:',
        JSON.stringify(response.content, null, 2),
      );
    }
    console.log('[respond] ========================================');

    // Resolve the pending elicitation with the user's response
    const resolved = resolvePendingElicitation(response);

    if (!resolved) {
      console.warn('[respond] ========================================');
      console.warn(
        '[respond] ELICITATION NOT FOUND (already resolved or expired)',
      );
      console.warn('[respond] ID:', response.id);
      console.warn('[respond] ========================================');
      return Response.json(
        { error: 'Elicitation request not found or already resolved' },
        { status: 404 },
      );
    }

    console.log('[respond] ========================================');
    console.log('[respond] SUCCESS - Elicitation resolved');
    console.log('[respond] ID:', response.id);
    console.log('[respond] ========================================');
    return Response.json({ success: true });
  } catch (error) {
    console.error('[respond] ========================================');
    console.error('[respond] ERROR processing response');
    console.error('[respond] Error:', error);
    console.error('[respond] ========================================');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
