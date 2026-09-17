import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requestImageTask, prepareImageTaskRequest } from './image-task-client.mjs'
import { setImmediate } from 'node:timers/promises'

const id = 'a0a0a0a0-1234-4321-8765-123456789abc'
const endpoint = 'https://example.test/v1/images/generations'

test('Blob references survive JSON serialization and output parameters are preserved', async () => {
  const blob = new Blob([new Uint8Array([137,80,78,71,13,10,26,10])], {type:'image/png'})
  const request = {images:[blob],size:'960x1280',output_format:'jpeg',output_compression:100,quality:'low'}
  const body = JSON.parse(JSON.stringify(await prepareImageTaskRequest(request)))
  assert.equal(body.images[0],'data:image/png;base64,iVBORw0KGgo=')
  assert.equal(body.size,'960x1280');assert.equal(body.output_format,'jpeg');assert.equal(body.output_compression,100);assert.equal(body.quality,'low')
  assert.equal(request.images[0],blob)
})

test('already serialized empty Blob objects fail before creating a paid task', async () => {
  await assert.rejects(prepareImageTaskRequest({images:[{}]}),/空对象/)
})

test('posts exactly once, polls, and returns unchanged Base64 JSON', async (t) => {
  const calls = []
  const result = { data: [{ b64_json: 'aW1hZ2U=', size: '3x4' }], usage: { total_tokens: 20 } }
  const responses = [{ id }, { status: 'running' }, { status: 'succeeded' }, result]
  t.mock.method(globalThis, 'fetch', async (url, init) => { calls.push({ url: String(url), ...init }); if(String(url).includes('/by-submission/'))return Response.json({error:{message:'not found'}},{status:404}); return Response.json(responses.shift()) })
  assert.deepEqual(await requestImageTask(endpoint, 'test-only', { model: 'gpt-image-2' }, { submissionId: id, pollIntervalMs: 0 }), result)
  assert.equal(calls.filter(c => c.method === 'POST').length, 1)
  assert.equal(calls[1].headers['Idempotency-Key'], id)
  assert.equal(calls[4].url, `https://example.test/v1/images/tasks/${id}/result`)
})

test('resuming a task never submits again', async (t) => {
  const methods = []
  t.mock.method(globalThis, 'fetch', async (url, init) => { methods.push(init.method); return Response.json(String(url).endsWith('/result') ? { data: [] } : { status: 'succeeded' }) })
  await requestImageTask(endpoint, 'test-only', {}, { taskId: id })
  assert.deepEqual(methods, ['GET', 'GET'])
})

test('uncertain submission retains its idempotency key without POST retry', async (t) => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async (_url, init) => { if(init.method==='GET')return Response.json({error:{message:'not found'}},{status:404}); calls++; throw new TypeError('network failed') })
  await assert.rejects(requestImageTask(endpoint, 'test-only', {}, { submissionId: id }), { code: 'NETWORK_ERROR', submissionId: id })
  assert.equal(calls, 1)
})

test('a transient polling failure retries GET only', async (t) => {
  const methods = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    methods.push(init.method)
    if (methods.length === 1) return new Response('<html>error</html>', { status: 530, headers: { 'Content-Type': 'text/html' } })
    return Response.json(String(url).endsWith('/result') ? { data: [] } : { status: 'succeeded' })
  })
  await requestImageTask(endpoint, 'test-only', {}, { taskId: id, pollIntervalMs: 0 })
  assert.deepEqual(methods, ['GET', 'GET', 'GET'])
})

test('result body can take over 30 seconds without cancellation', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let stream, signal
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (!String(url).endsWith('/result')) return Response.json({ status: 'succeeded' })
    signal = init.signal
    return new Response(new ReadableStream({ start(controller) {
      stream = controller
      signal.addEventListener('abort', () => controller.error(signal.reason), { once: true })
    } }), { headers: { 'Content-Type': 'application/json' } })
  })
  const pending = requestImageTask(endpoint, 'test-only', {}, { taskId: id })
  await setImmediate()
  assert.ok(stream)
  t.mock.timers.tick(31000)
  assert.equal(signal.aborted, false)
  stream.enqueue(new TextEncoder().encode('{"data":[]}'))
  stream.close()
  assert.deepEqual(await pending, { data: [] })
})

test('interrupted result retries the same GET and submits generation only once', async (t) => {
  const calls = []
  let reads = 0
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url: String(url), method: init.method })
    if (init.method === 'POST') return Response.json({ id })
    if (!String(url).endsWith('/result')) return Response.json({ status: 'succeeded' })
    if (++reads === 1) return new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('{"data":'))
      controller.error(new TypeError('connection terminated'))
    } }), { headers: { 'Content-Type': 'application/json' } })
    return Response.json({ data: [{ b64_json: 'aW1hZ2U=' }] })
  })
  const result = await requestImageTask(endpoint, 'test-only', {}, { resultRetryDelayMs: 0 })
  assert.equal(result.data[0].b64_json, 'aW1hZ2U=')
  assert.equal(calls.filter(call => call.method === 'POST').length, 1)
  assert.deepEqual(calls.filter(call => call.url.endsWith('/result')), Array(2).fill({ url: `https://example.test/v1/images/tasks/${id}/result`, method: 'GET' }))
})

test('configured download timeout retries twice, retaining request ID and original cause', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let reads = 0
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(init.method, 'GET')
    if (!String(url).endsWith('/result')) return Response.json({ status: 'succeeded' })
    reads++
    return new Response(new ReadableStream({ start(controller) {
      init.signal.addEventListener('abort', () => controller.error(init.signal.reason), { once: true })
    } }), { headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'saved-request' } })
  })
  const pending = assert.rejects(requestImageTask(endpoint, 'test-only', {}, {
    taskId: id, resultTimeoutMs: 45000, resultRetryDelayMs: 10,
  }), error => {
    assert.equal(error.code, 'REQUEST_TIMEOUT')
    assert.equal(error.taskId, id)
    assert.equal(error.requestId, 'saved-request')
    assert.equal(error.cause.code, 'READ_RESPONSE_FAILED')
    assert.equal(error.cause.cause.name, 'TimeoutError')
    return true
  })
  for (let attempt = 1; attempt <= 3; attempt++) {
    await setImmediate()
    assert.equal(reads, attempt)
    t.mock.timers.tick(45000)
    await setImmediate()
    t.mock.timers.tick(10)
  }
  await pending
  assert.equal(reads, 3)
})

test('user cancellation during download does not retry', async (t) => {
  const controller = new AbortController()
  let reads = 0
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (!String(url).endsWith('/result')) return Response.json({ status: 'succeeded' })
    reads++
    return new Response(new ReadableStream({ start(stream) {
      init.signal.addEventListener('abort', () => stream.error(init.signal.reason), { once: true })
    } }), { headers: { 'Content-Type': 'application/json' } })
  })
  const pending = assert.rejects(requestImageTask(endpoint, 'test-only', {}, { taskId: id, signal: controller.signal }), { code: 'READ_RESPONSE_FAILED', taskId: id })
  await setImmediate()
  controller.abort()
  await pending
  assert.equal(reads, 1)
})

test('saved upstream failure is returned without retrying its result', async (t) => {
  let reads = 0
  t.mock.method(globalThis, 'fetch', async url => {
    if (!String(url).endsWith('/result')) return Response.json({ status: 'failed' })
    reads++
    return Response.json({ error: { code: 'upstream_error', message: 'Generation failed' } }, { status: 500 })
  })
  await assert.rejects(requestImageTask(endpoint, 'test-only', {}, { taskId: id }), { code: 'upstream_error' })
  assert.equal(reads, 1)
})
