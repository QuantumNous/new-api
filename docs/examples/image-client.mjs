/** A dependency-free JSON reader for external image API clients. No retry. */
export class ImageRequestError extends Error {
  constructor(message, status, code, requestId, cause) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'ImageRequestError'
    this.status = status
    this.code = code
    this.requestId = requestId
    // A timeout can occur after upstream generation. Do not replay paid calls.
    this.autoRetry = false
  }
}

export async function readImageResponse(response) {
  const requestId = response.headers.get('x-request-id') || response.headers.get('cf-ray') || undefined
  // This function owns the response body. Do not call json/text/blob/getReader
  // before it, after it, or from another concurrent consumer of the response.
  if (response.bodyUsed) {
    throw new ImageRequestError('响应体已经被读取。请删除此前的 response.json()/text() 等读取，只保留一次读取。', response.status, 'BODY_ALREADY_CONSUMED', requestId)
  }
  if (response.body?.locked) {
    throw new ImageRequestError('响应流已被其他读取器锁定，请让本函数独占读取响应。', response.status, 'BODY_LOCKED', requestId)
  }
  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (contentType !== 'application/json' && !/^application\/[a-z0-9.+-]+\+json$/.test(contentType)) {
    await response.body?.cancel().catch(() => {})
    throw new ImageRequestError(
      '服务暂时不可用，收到的不是 JSON。请先核对任务记录，再决定是否重新提交。',
      response.status,
      'NON_JSON_RESPONSE',
      requestId,
    )
  }
  let raw
  try {
    // Read exactly once. Parsing the saved string never reads the network again.
    raw = await response.text()
  } catch (cause) {
    throw new ImageRequestError('响应读取失败，无法确认生图结果。请先核对任务记录，不要自动重新提交。', response.status, 'READ_RESPONSE_FAILED', requestId, cause)
  }
  let body
  try {
    body = JSON.parse(raw)
  } catch {
    throw new ImageRequestError('响应不完整或 JSON 格式异常，请先核对任务记录。', response.status, 'INVALID_JSON_RESPONSE', requestId)
  }
  if (!response.ok || body?.error) {
    const message = body?.error?.message || body?.message
    const code = body?.error?.code || body?.code || 'HTTP_ERROR'
    throw new ImageRequestError(typeof message === 'string' ? message : '图片请求失败，请先核对任务记录。', response.status, typeof code === 'string' ? code : 'HTTP_ERROR', requestId)
  }
  return body
}

/** apiKey must come from your secure runtime configuration, never hardcode it. */
export async function requestImage(endpoint, apiKey, request, signal) {
  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(request),
      signal,
    })
  } catch {
    throw new ImageRequestError('连接中断，无法确认生图结果。请先核对任务记录，不要自动重复提交。', 0, 'NETWORK_ERROR')
  }
  return readImageResponse(response)
}
