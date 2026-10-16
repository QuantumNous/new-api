import { describe, it, expect, vi } from 'vitest';
import { cancelResponseBody } from './cancel-response-body';

function createResponse(body: ReadableStream<Uint8Array> | null): Response {
  return { body } as unknown as Response;
}

describe('cancelResponseBody', () => {
  it('should cancel the body to release the connection', async () => {
    const cancel = vi.fn();
    const response = createResponse(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
        },
        cancel,
      }),
    );

    await cancelResponseBody(response);

    expect(cancel).toHaveBeenCalledOnce();
  });

  it('should be a no-op when the body is null', async () => {
    await expect(
      cancelResponseBody(createResponse(null)),
    ).resolves.toBeUndefined();
  });

  it('should swallow cancel errors so the original rejection is preserved', async () => {
    const response = createResponse(
      new ReadableStream<Uint8Array>({
        cancel() {
          throw new Error('cannot cancel');
        },
      }),
    );

    await expect(cancelResponseBody(response)).resolves.toBeUndefined();
  });
});
