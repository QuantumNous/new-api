import { describe, expect, it } from 'vitest';
import {
  signToolApproval,
  verifyToolApprovalSignature,
} from './tool-approval-signature';

const secret = 'test-secret-key-for-hmac-signing';

describe('signToolApproval + verifyToolApprovalSignature', () => {
  const baseParams = {
    approvalId: 'approval-1',
    toolCallId: 'call-1',
    toolName: 'deleteFile',
    input: { path: '/tmp/cache' },
  };

  it('should produce a valid signature that verifies', async () => {
    const signature = await signToolApproval({ secret, ...baseParams });
    expect(typeof signature).toBe('string');
    expect(signature.length).toBeGreaterThan(0);

    const valid = await verifyToolApprovalSignature({
      secret,
      signature,
      ...baseParams,
    });
    expect(valid).toBe(true);
  });

  it('should reject when the approvalId is tampered', async () => {
    const signature = await signToolApproval({ secret, ...baseParams });
    const valid = await verifyToolApprovalSignature({
      secret,
      signature,
      ...baseParams,
      approvalId: 'tampered-id',
    });
    expect(valid).toBe(false);
  });

  it('should reject when the toolCallId is tampered', async () => {
    const signature = await signToolApproval({ secret, ...baseParams });
    const valid = await verifyToolApprovalSignature({
      secret,
      signature,
      ...baseParams,
      toolCallId: 'tampered-call',
    });
    expect(valid).toBe(false);
  });

  it('should reject when the toolName is tampered', async () => {
    const signature = await signToolApproval({ secret, ...baseParams });
    const valid = await verifyToolApprovalSignature({
      secret,
      signature,
      ...baseParams,
      toolName: 'readFile',
    });
    expect(valid).toBe(false);
  });

  it('should reject when the input is tampered', async () => {
    const signature = await signToolApproval({ secret, ...baseParams });
    const valid = await verifyToolApprovalSignature({
      secret,
      signature,
      ...baseParams,
      input: { path: '/app/.env' },
    });
    expect(valid).toBe(false);
  });

  it('should reject when verified with a different secret', async () => {
    const signature = await signToolApproval({ secret, ...baseParams });
    const valid = await verifyToolApprovalSignature({
      secret: 'different-secret',
      signature,
      ...baseParams,
    });
    expect(valid).toBe(false);
  });

  it('should produce the same signature for equivalent inputs with different key order', async () => {
    const sig1 = await signToolApproval({
      secret,
      ...baseParams,
      input: { path: '/tmp/cache', mode: 'delete' },
    });
    const sig2 = await signToolApproval({
      secret,
      ...baseParams,
      input: { mode: 'delete', path: '/tmp/cache' },
    });
    expect(sig1).toBe(sig2);
  });
});
