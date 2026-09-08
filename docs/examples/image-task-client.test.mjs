import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requestImageTask } from './image-task-client.mjs'

const id = 'a0a0a0a0-1234-4321-8765-123456789abc'
const endpoint = 'https://example.test/v1/images/generations'

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
