/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { ModelApiProfile } from '../types'

export type ImageSampleLanguage =
  | 'curl'
  | 'bash'
  | 'python'
  | 'typescript'
  | 'javascript'

export const STANDARD_SAMPLE_LANGUAGES: readonly ImageSampleLanguage[] = [
  'curl',
  'python',
  'typescript',
  'javascript',
]

export const IMAGE_SAMPLE_LANGUAGES: readonly ImageSampleLanguage[] = [
  'curl',
  'bash',
  'python',
  'typescript',
  'javascript',
]

export type ImageSampleContext = {
  baseUrl: string
  apiKeyEnv: string
  modelName: string
  endpointPath: string
  profile: ModelApiProfile
}

function imageRequestBody(ctx: ImageSampleContext): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt: 'A serene koi pond at sunset, ukiyo-e style.',
  }

  const gatewayFields = new Set([
    'prompt',
    'image_input',
    'webhook_url',
    'webhook_secret',
  ])
  const usesUnifiedDimensions = ctx.profile.parameters.some(
    (parameter) =>
      parameter.name === 'aspect_ratio' || parameter.name === 'resolution'
  )
  for (const parameter of ctx.profile.parameters) {
    if (gatewayFields.has(parameter.name)) continue
    if (parameter.name === 'size' && usesUnifiedDimensions) continue

    const value = parameter.default
    // Provider-specific object/array fields are shown in the parameter table;
    // leaving them out of the runnable sample avoids sending an empty object
    // that a provider may interpret differently from an omitted field.
    if (value !== undefined && parameter.type !== 'array') {
      input[parameter.name] = value
    }
  }

  const operations = ctx.profile.operations || []
  if (operations.length === 1 && operations[0] === 'edit') {
    const imageInputParameter = ctx.profile.parameters.find(
      (item) => item.name === 'image_input' || item.name === 'input_urls'
    )
    if (imageInputParameter) {
      input[imageInputParameter.name] = ['https://example.com/reference.png']
    }
  }

  return { model: ctx.modelName, input }
}

function pollPath(ctx: ImageSampleContext, taskId: string): string {
  return (ctx.profile.poll_endpoint || `${ctx.endpointPath}/{task_id}`).replace(
    '{task_id}',
    taskId
  )
}

export function buildAsyncImageSample(
  language: ImageSampleLanguage,
  ctx: ImageSampleContext
): string {
  const submitUrl = `${ctx.baseUrl}${ctx.endpointPath}`
  const bodyJson = JSON.stringify(imageRequestBody(ctx), null, 2)

  if (language === 'curl') {
    const statusUrl = `${ctx.baseUrl}${pollPath(ctx, '<TASK_ID>')}`

    return [
      `# Set ${ctx.apiKeyEnv} before running and replace <UNIQUE_ID>.`,
      '# Submit the image task',
      `curl ${submitUrl} \\`,
      `  -H "Authorization: Bearer $${ctx.apiKeyEnv}" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -H "Idempotency-Key: image-request-<UNIQUE_ID>" \\`,
      `  -d '${bodyJson.replaceAll('\n', '\n       ')}'`,
      '',
      '# HTTP/1.1 202 Accepted',
      '# Copy task_id from the response, then replace <TASK_ID>.',
      '# Poll the image task',
      `curl "${statusUrl}" \\`,
      `  -H "Authorization: Bearer $${ctx.apiKeyEnv}"`,
    ].join('\n')
  }

  if (language === 'bash') {
    const statusUrl = `${ctx.baseUrl}${pollPath(ctx, '${TASK_ID}')}`

    return [
      '# Requires Bash, curl, and Python 3. Set the API key before running:',
      `# export ${ctx.apiKeyEnv}="..."`,
      'set -euo pipefail',
      `: "\${${ctx.apiKeyEnv}:?Set ${ctx.apiKeyEnv} before running}"`,
      '',
      'readonly REQUEST_TIMEOUT_SECONDS=30',
      'readonly POLL_TIMEOUT_SECONDS=900',
      'RESPONSE_HEADERS="$(mktemp)"',
      'RESPONSE_BODY="$(mktemp)"',
      'trap \'rm -f "$RESPONSE_HEADERS" "$RESPONSE_BODY"\' EXIT',
      '',
      'read_retry_after() {',
      '  local value',
      `  value="$(awk -F ': *' 'tolower($1) == "retry-after" { gsub(/\\r/, "", $2); print $2; exit }' "$RESPONSE_HEADERS")"`,
      '  if [[ "$value" =~ ^[0-9]+$ ]]; then',
      '    printf \'%s\' "$value"',
      '  else',
      "    printf '2'",
      '  fi',
      '}',
      '',
      '# Submit the image task',
      '# Webhooks are optional and intentionally omitted from this polling example.',
      `IDEMPOTENCY_KEY="image-request-$(python3 -c 'import uuid; print(uuid.uuid4())')"`,
      'if ! HTTP_STATUS="$(',
      '  curl --silent --show-error \\',
      '    --max-time "$REQUEST_TIMEOUT_SECONDS" \\',
      '    --dump-header "$RESPONSE_HEADERS" \\',
      '    --output "$RESPONSE_BODY" \\',
      "    --write-out '%{http_code}' \\",
      `    ${submitUrl} \\`,
      `    -H "Authorization: Bearer $${ctx.apiKeyEnv}" \\`,
      `    -H "Content-Type: application/json" \\`,
      `    -H "Idempotency-Key: $IDEMPOTENCY_KEY" \\`,
      `    -d '${bodyJson.replaceAll('\n', '\n         ')}'`,
      ')"; then',
      "  printf 'Submit request failed\\n' >&2",
      '  exit 1',
      'fi',
      'TASK_RESPONSE="$(cat "$RESPONSE_BODY")"',
      `printf '%s\\n' "$TASK_RESPONSE"`,
      'if [ "$HTTP_STATUS" != "202" ]; then',
      '  printf \'Submit failed (HTTP %s): %s\\n\' "$HTTP_STATUS" "$TASK_RESPONSE" >&2',
      '  exit 1',
      'fi',
      `TASK_ID="$(printf '%s' "$TASK_RESPONSE" | python3 -c 'import json, sys; print(json.load(sys.stdin)["task_id"])')"`,
      `TASK_STATUS="$(printf '%s' "$TASK_RESPONSE" | python3 -c 'import json, sys; print(json.load(sys.stdin)["status"])')"`,
      'POLL_DEADLINE=$(( $(date +%s) + POLL_TIMEOUT_SECONDS ))',
      '',
      '# The submit endpoint returns HTTP/1.1 202 Accepted',
      '# Location: /v1/images/generations/task_0123456789abcdef0123456789abcdef',
      '# Retry-After: 2',
      '# {"task_id":"task_0123456789abcdef0123456789abcdef","object":"image.generation.task","status":"queued","progress":"0%","created_at":1710000000}',
      '',
      '# Poll until status is completed or failed, honoring Retry-After.',
      'while [ "$TASK_STATUS" != "completed" ] && [ "$TASK_STATUS" != "failed" ]; do',
      '  RETRY_AFTER_SECONDS="$(read_retry_after)"',
      '  if (( $(date +%s) + RETRY_AFTER_SECONDS >= POLL_DEADLINE )); then',
      '    printf \'Image task polling timed out after %s seconds\\n\' "$POLL_TIMEOUT_SECONDS" >&2',
      '    exit 1',
      '  fi',
      '  sleep "$RETRY_AFTER_SECONDS"',
      '  REMAINING_SECONDS=$(( POLL_DEADLINE - $(date +%s) ))',
      '  if (( REMAINING_SECONDS <= 0 )); then',
      '    printf \'Image task polling timed out after %s seconds\\n\' "$POLL_TIMEOUT_SECONDS" >&2',
      '    exit 1',
      '  fi',
      '  POLL_REQUEST_TIMEOUT_SECONDS="$REQUEST_TIMEOUT_SECONDS"',
      '  if (( REMAINING_SECONDS < POLL_REQUEST_TIMEOUT_SECONDS )); then',
      '    POLL_REQUEST_TIMEOUT_SECONDS="$REMAINING_SECONDS"',
      '  fi',
      '',
      '  if ! HTTP_STATUS="$(',
      '    curl --silent --show-error \\',
      '      --max-time "$POLL_REQUEST_TIMEOUT_SECONDS" \\',
      '      --dump-header "$RESPONSE_HEADERS" \\',
      '      --output "$RESPONSE_BODY" \\',
      "      --write-out '%{http_code}' \\",
      `      "${statusUrl}" \\`,
      `      -H "Authorization: Bearer $${ctx.apiKeyEnv}"`,
      '  )"; then',
      "    printf 'Poll request failed\\n' >&2",
      '    exit 1',
      '  fi',
      '  TASK_RESPONSE="$(cat "$RESPONSE_BODY")"',
      `  printf '%s\\n' "$TASK_RESPONSE"`,
      '  if [ "$HTTP_STATUS" != "200" ]; then',
      '    printf \'Poll failed (HTTP %s): %s\\n\' "$HTTP_STATUS" "$TASK_RESPONSE" >&2',
      '    exit 1',
      '  fi',
      `  TASK_STATUS="$(printf '%s' "$TASK_RESPONSE" | python3 -c 'import json, sys; print(json.load(sys.stdin)["status"])')"`,
      'done',
      '',
      'if [ "$TASK_STATUS" = "failed" ]; then',
      `  printf '%s' "$TASK_RESPONSE" | python3 -c 'import json, sys; print(json.load(sys.stdin)["error"]["message"], file=sys.stderr)'`,
      '  exit 1',
      'fi',
      '',
      `printf '%s' "$TASK_RESPONSE" | python3 -c 'import json, sys; print(json.load(sys.stdin)["result"]["data"][0]["url"])'`,
    ].join('\n')
  }

  if (language === 'python') {
    return [
      '# Requires Python 3.9+ and requests 2.x.',
      `# Set ${ctx.apiKeyEnv} before running.`,
      'import json',
      'import os',
      'import time',
      'import uuid',
      '',
      'import requests',
      '',
      `base_url = "${ctx.baseUrl}"`,
      'request_timeout_seconds = 30',
      'poll_timeout_seconds = 900',
      '# requests uses per-operation network timeouts; the deadline is also',
      '# checked after every in-flight poll returns.',
      `api_key = os.getenv("${ctx.apiKeyEnv}")`,
      'if not api_key:',
      `    raise RuntimeError("Set ${ctx.apiKeyEnv} before running")`,
      '',
      'auth_headers = {"Authorization": f"Bearer {api_key}"}',
      `submit_headers = {`,
      '    **auth_headers,',
      `    "Content-Type": "application/json",`,
      `    "Idempotency-Key": f"image-request-{uuid.uuid4()}",`,
      '}',
      `payload = json.loads(r'''${bodyJson}''')`,
      '',
      'def request(',
      '    action, method, url, timeout_seconds=request_timeout_seconds, **kwargs',
      '):',
      '    try:',
      '        return requests.request(',
      '            method, url, timeout=timeout_seconds, **kwargs',
      '        )',
      '    except requests.RequestException as exc:',
      '        raise RuntimeError(f"{action} request failed: {exc}") from exc',
      '',
      '',
      'def require_status(response, expected_status, action):',
      '    if response.status_code != expected_status:',
      '        raise RuntimeError(',
      '            f"{action} failed (HTTP {response.status_code}): {response.text}"',
      '        )',
      '',
      '',
      'def retry_delay(response):',
      '    try:',
      '        value = float(response.headers.get("Retry-After", "2"))',
      '    except ValueError:',
      '        return 2.0',
      '    return value if value >= 0 else 2.0',
      '',
      '',
      '# Webhooks are optional and intentionally omitted from this polling example.',
      'response = request(',
      '    "Submit",',
      '    "POST",',
      `    f"{base_url}${ctx.endpointPath}",`,
      '    headers=submit_headers,',
      '    json=payload,',
      ')',
      'require_status(response, 202, "Submit")',
      'task = response.json()',
      'task_id = task.get("task_id")',
      'if not task_id:',
      '    raise RuntimeError("Submit response did not include task_id")',
      'poll_deadline = time.monotonic() + poll_timeout_seconds',
      '',
      `while task["status"] not in {"completed", "failed"}:`,
      '    delay = retry_delay(response)',
      '    if time.monotonic() + delay >= poll_deadline:',
      '        raise TimeoutError(',
      '            f"Image task polling timed out after {poll_timeout_seconds} seconds"',
      '        )',
      '    time.sleep(delay)',
      '    remaining = poll_deadline - time.monotonic()',
      '    if remaining <= 0:',
      '        raise TimeoutError(',
      '            f"Image task polling timed out after {poll_timeout_seconds} seconds"',
      '        )',
      '    response = request(',
      '        "Poll",',
      '        "GET",',
      `        f"{base_url}${pollPath(ctx, '{task_id}')}",`,
      '        timeout_seconds=min(request_timeout_seconds, remaining),',
      '        headers=auth_headers,',
      '    )',
      '    if time.monotonic() >= poll_deadline:',
      '        raise TimeoutError(',
      '            f"Image task polling timed out after {poll_timeout_seconds} seconds"',
      '        )',
      '    require_status(response, 200, "Poll")',
      '    task = response.json()',
      '',
      'if task["status"] == "failed":',
      '    raise RuntimeError(task.get("error", {}).get("message", "Image generation failed"))',
      '',
      'result_data = task.get("result", {}).get("data", [])',
      'result_url = result_data[0].get("url") if result_data else None',
      'if not result_url:',
      '    raise RuntimeError("Completed task did not include result.data[0].url")',
      'print(result_url)',
    ].join('\n')
  }

  const typeDeclaration =
    language === 'typescript'
      ? [
          'type ImageTask = {',
          '  task_id: string',
          "  object: 'image.generation.task'",
          "  status: 'queued' | 'in_progress' | 'completed' | 'failed'",
          '  progress: string',
          '  created_at: number',
          '  completed_at?: number',
          '  result?: { data?: Array<{ url?: string }> }',
          '  error?: { message: string; code: string }',
          '}',
          '',
        ]
      : []
  const jsonCast = language === 'typescript' ? ' as ImageTask' : ''
  const stringType = language === 'typescript' ? ': string' : ''
  const numberType = language === 'typescript' ? ': number' : ''
  const responseType = language === 'typescript' ? ': Response' : ''
  const requestInitType = language === 'typescript' ? ': RequestInit' : ''
  const responsePromiseType =
    language === 'typescript' ? ': Promise<Response>' : ''
  const voidPromiseType = language === 'typescript' ? ': Promise<void>' : ''

  return [
    '// Requires Node.js 18+ in ESM mode or Bun 1.0+.',
    `// Set ${ctx.apiKeyEnv} before running.`,
    `import { randomUUID } from 'node:crypto'`,
    '',
    ...typeDeclaration,
    `const baseUrl = '${ctx.baseUrl}'`,
    `const requestTimeoutMs = 30_000`,
    `const pollTimeoutMs = 900_000`,
    `const apiKey = process.env.${ctx.apiKeyEnv}`,
    `if (!apiKey) throw new Error('Set ${ctx.apiKeyEnv} before running')`,
    `const idempotencyKey = \`image-request-\${randomUUID()}\``,
    `const authHeaders = { Authorization: \`Bearer \${apiKey}\` }`,
    `const submitHeaders = {`,
    `  ...authHeaders,`,
    `  'Content-Type': 'application/json',`,
    `  'Idempotency-Key': idempotencyKey,`,
    `}`,
    '',
    `async function fetchWithTimeout(`,
    `  url${stringType},`,
    `  init${requestInitType},`,
    `  action${stringType},`,
    `  timeoutMs${numberType} = requestTimeoutMs`,
    `)${responsePromiseType} {`,
    `  try {`,
    `    return await fetch(url, {`,
    `      ...init,`,
    `      signal: AbortSignal.timeout(timeoutMs),`,
    `    })`,
    `  } catch (error) {`,
    `    const message = error instanceof Error ? error.message : String(error)`,
    `    throw new Error(\`\${action} request failed: \${message}\`)`,
    `  }`,
    `}`,
    '',
    `async function requireStatus(`,
    `  response${responseType},`,
    `  expectedStatus${numberType},`,
    `  action${stringType},`,
    `)${voidPromiseType} {`,
    `  if (response.status === expectedStatus) return`,
    `  const body = await response.text()`,
    `  throw new Error(\`${'${action}'} failed (HTTP \${response.status}): \${body}\`)`,
    `}`,
    '',
    `function retryDelayMs(response${responseType})${numberType} {`,
    `  const seconds = Number(response.headers.get('Retry-After') ?? 2)`,
    `  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 2000`,
    `}`,
    '',
    `// Webhooks are optional and intentionally omitted from this polling example.`,
    `let response = await fetchWithTimeout(`,
    `  \`${'${baseUrl}'}${ctx.endpointPath}\`,`,
    `  {`,
    `    method: 'POST',`,
    `    headers: submitHeaders,`,
    `    body: JSON.stringify(${bodyJson}),`,
    `  },`,
    `  'Submit',`,
    `)`,
    `await requireStatus(response, 202, 'Submit')`,
    `let task = (await response.json())${jsonCast}`,
    `const taskId = task.task_id`,
    `if (!taskId) throw new Error('Submit response did not include task_id')`,
    `const pollDeadline = Date.now() + pollTimeoutMs`,
    '',
    `while (task.status !== 'completed' && task.status !== 'failed') {`,
    `  const delayMs = retryDelayMs(response)`,
    `  if (Date.now() + delayMs >= pollDeadline) {`,
    `    throw new Error(\`Image task polling timed out after \${pollTimeoutMs / 1000} seconds\`)`,
    `  }`,
    `  await new Promise((resolve) => setTimeout(resolve, delayMs))`,
    `  const remainingMs = pollDeadline - Date.now()`,
    `  if (remainingMs <= 0) {`,
    `    throw new Error(\`Image task polling timed out after \${pollTimeoutMs / 1000} seconds\`)`,
    `  }`,
    `  response = await fetchWithTimeout(`,
    `    \`${'${baseUrl}'}${pollPath(ctx, '${taskId}')}\`,`,
    `    { headers: authHeaders },`,
    `    'Poll',`,
    `    Math.min(requestTimeoutMs, remainingMs),`,
    `  )`,
    `  await requireStatus(response, 200, 'Poll')`,
    `  task = (await response.json())${jsonCast}`,
    `}`,
    '',
    `if (task.status === 'failed') {`,
    `  throw new Error(task.error?.message || 'Image generation failed')`,
    `}`,
    `const resultUrl = task.result?.data?.[0]?.url`,
    `if (!resultUrl) {`,
    `  throw new Error('Completed task did not include result.data[0].url')`,
    `}`,
    `console.log(resultUrl)`,
  ].join('\n')
}
