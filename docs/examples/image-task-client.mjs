import { ImageRequestError, readImageResponse } from './image-client.mjs'

async function taskRequest(url, apiKey, method, body, submissionId, signal) {
  const controller = new AbortController()
  const abort = () => controller.abort(signal?.reason)
  if (signal?.aborted) abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const headers = { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (submissionId) headers['Idempotency-Key'] = submissionId
    const response = await fetch(url, { method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body), signal: controller.signal })
    return await readImageResponse(response)
  } catch (error) {
    if (error instanceof ImageRequestError) throw error
    throw new ImageRequestError('网络中断；保留任务编号，恢复查询，不要用新编号重新生图。', 0, 'NETWORK_ERROR')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason ?? new Error('Cancelled')); return }
    const abort = () => { clearTimeout(timer); reject(signal.reason ?? new Error('Cancelled')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, ms)
    signal?.addEventListener('abort', abort, { once: true })
  })
}

/**
 * Returns the SAME final image JSON as the synchronous Images API.
 * Persist submissionId BEFORE starting; onTask receives the server task ID.
 * After a network error, reuse the SAME submissionId and identical request,
 * or pass the saved taskId to resume without another POST.
 */
export async function requestImageTask(endpoint, apiKey, request, options = {}) {
  const base = new URL(endpoint)
  if (!base.pathname.endsWith('/v1/images/generations') && !base.pathname.endsWith('/v1/images/tasks')) {
    throw new Error('Expected /v1/images/generations or /v1/images/tasks endpoint')
  }
  base.pathname = '/v1/images/tasks'
  base.search = ''
  base.hash = ''
  const cryptoAPI = options.crypto ?? globalThis.crypto
  const submissionId = options.submissionId ?? cryptoAPI?.randomUUID()
  const requestBody = JSON.stringify(request)
  let taskId = options.taskId
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuid.test(submissionId) || (taskId && !uuid.test(taskId))) throw new Error('Task and submission IDs must be UUIDs')
  const deadline = Date.now() + (options.maxWaitMs ?? 25 * 60 * 1000)
  try {
    if (!taskId) {
      options.onTask?.({ submissionId })
      let task
      if (options.submissionId) {
        try {
          task = await taskRequest(`${base}/by-submission/${submissionId}`, apiKey, 'GET', undefined, undefined, options.signal)
          if (!cryptoAPI?.subtle) throw new Error('Pass Node webcrypto in options.crypto to verify the saved request')
          const digest = await cryptoAPI.subtle.digest('SHA-256', new TextEncoder().encode(requestBody))
          const requestHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
          if (task.request_hash !== requestHash) throw new ImageRequestError('提交编号已用于不同请求，请勿复用编号修改参数。', 409, 'TASK_REQUEST_CONFLICT')
        } catch (error) {
          if (!(error instanceof ImageRequestError) || error.status !== 404) throw error
        }
      }
      if (!task) task = await taskRequest(base, apiKey, 'POST', requestBody, submissionId, options.signal)
      if (!uuid.test(task.id)) throw new ImageRequestError('任务响应异常，请保留提交编号。', 0, 'INVALID_TASK_RESPONSE')
      taskId = task.id
      options.onTask?.({ submissionId, taskId })
    }
    while (Date.now() < deadline) {
      let task
      try {
        task = await taskRequest(`${base}/${taskId}`, apiKey, 'GET', undefined, undefined, options.signal)
      } catch (error) {
        // Only retry READS. Never regenerate to recover a network/gateway failure.
        if (!options.signal?.aborted && error instanceof ImageRequestError && (error.status === 0 || error.status >= 500)) {
          await wait(options.pollIntervalMs ?? 2000, options.signal)
          continue
        }
        throw error
      }
      if (task.status === 'succeeded' || task.status === 'failed') {
        return await taskRequest(`${base}/${taskId}/result`, apiKey, 'GET', undefined, undefined, options.signal)
      }
      if (task.status !== 'queued' && task.status !== 'running') {
        throw new ImageRequestError('任务结果未确认，请核对记录，不要自动重新生图。', 409, 'TASK_OUTCOME_UNKNOWN')
      }
      await wait(options.pollIntervalMs ?? 2000, options.signal)
    }
    throw new ImageRequestError('等待超时；任务仍可查询，请使用原任务编号恢复。', 0, 'TASK_WAIT_TIMEOUT')
  } catch (error) {
    if (error && typeof error === 'object') {
      error.submissionId = submissionId
      error.taskId = taskId
    }
    throw error
  }
}
