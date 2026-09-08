import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readImageResponse, requestImage } from './image-client.mjs'

test('Cloudflare HTML becomes a structured error instead of a JSON parse exception', async () => {
  const response = new Response('<html>private gateway page</html>', { status: 530, headers: { 'Content-Type': 'text/html', 'CF-Ray': 'example-ray' } })
  await assert.rejects(readImageResponse(response), (error) => {
    assert.equal(error.code, 'NON_JSON_RESPONSE')
    assert.equal(error.status, 530)
    assert.equal(error.autoRetry, false)
    assert.equal(error.requestId, 'example-ray')
    assert.ok(!error.message.includes('private gateway page'))
    return true
  })
})

test('truncated JSON has a stable failure code', async () => {
  await assert.rejects(readImageResponse(new Response('{"data":', { headers: { 'Content-Type': 'application/json' } })), { code: 'INVALID_JSON_RESPONSE', autoRetry: false })
})

test('successful response preserves Base64 and measured size', async () => {
  const data = { data: [{ b64_json: 'aW1hZ2U=', size: '120x80' }], usage: { total_tokens: 20 } }
  assert.deepEqual(await readImageResponse(Response.json(data)), data)
})

test('delivery error remains non-retryable and preserves its code', async () => {
  await assert.rejects(readImageResponse(Response.json({ error: { code: 'image_delivery_failed', message: 'Download failed' } }, { status: 424 })), { code: 'image_delivery_failed', status: 424, autoRetry: false })
})

test('network failure sends the paid request only once', async (context) => {
  let count = 0
  context.mock.method(globalThis, 'fetch', async () => { count++; throw new TypeError('network failed') })
  await assert.rejects(requestImage('https://example.test/v1/images/generations', 'test-only', { prompt: 'test' }), { code: 'NETWORK_ERROR', autoRetry: false })
  assert.equal(count, 1)
})

test('an already consumed response is reported as a client integration error', async () => {
  const response = Response.json({ data: [] })
  await response.json()
  await assert.rejects(readImageResponse(response), { code: 'BODY_ALREADY_CONSUMED', autoRetry: false })
})

test('a locked response is distinguished from invalid JSON', async () => {
  const response = Response.json({ data: [] })
  const reader = response.body.getReader()
  try {
    await assert.rejects(readImageResponse(response), { code: 'BODY_LOCKED', autoRetry: false })
  } finally {
    reader.releaseLock()
  }
})

test('a failed stream read is not reported as a JSON syntax error', async () => {
  const response = new Response(new ReadableStream({ start(controller) { controller.error(new Error('stream failed')) } }), { headers: { 'Content-Type': 'application/json' } })
  await assert.rejects(readImageResponse(response), { code: 'READ_RESPONSE_FAILED', autoRetry: false })
})
