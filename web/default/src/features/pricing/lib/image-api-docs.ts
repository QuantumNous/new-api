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
  | 'python'
  | 'typescript'
  | 'javascript'

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

  if (ctx.profile.webhook) {
    input.webhook_url = 'https://example.com/webhooks/images'
    input.webhook_secret = '<YOUR_WEBHOOK_SECRET>'
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
    const statusUrl = `${ctx.baseUrl}${pollPath(ctx, '${TASK_ID}')}`

    return [
      '# Submit the image task',
      `IDEMPOTENCY_KEY="image-request-$(uuidgen)"`,
      'TASK_RESPONSE="$(',
      `  curl -sS ${submitUrl} \\`,
      `  -H "Authorization: Bearer $${ctx.apiKeyEnv}" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \\`,
      `  -d '${bodyJson.replaceAll('\n', '\n       ')}'`,
      ')"',
      `printf '%s\\n' "$TASK_RESPONSE"`,
      `TASK_ID="$(printf '%s' "$TASK_RESPONSE" | python3 -c 'import json, sys; print(json.load(sys.stdin)["task_id"])')"`,
      '',
      '# The submit endpoint returns HTTP/1.1 202 Accepted',
      '# Location: /v1/images/generations/task_0123456789abcdef0123456789abcdef',
      '# Retry-After: 2',
      '# {"task_id":"task_0123456789abcdef0123456789abcdef","object":"image.generation.task","status":"queued","progress":"0%","created_at":1710000000}',
      '',
      '# Poll until status is completed or failed',
      'while :; do',
      '  TASK_RESPONSE="$(',
      `    curl -sS "${statusUrl}" \\`,
      `      -H "Authorization: Bearer $${ctx.apiKeyEnv}"`,
      '  )"',
      `  printf '%s\\n' "$TASK_RESPONSE"`,
      `  TASK_STATUS="$(printf '%s' "$TASK_RESPONSE" | python3 -c 'import json, sys; print(json.load(sys.stdin)["status"])')"`,
      '  case "$TASK_STATUS" in',
      '    completed|failed) break ;;',
      '  esac',
      '  sleep 2',
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
      'import json',
      'import os',
      'import time',
      'import uuid',
      '',
      'import requests',
      '',
      `base_url = "${ctx.baseUrl}"`,
      `headers = {`,
      `    "Authorization": f"Bearer {os.environ['${ctx.apiKeyEnv}']}",`,
      `    "Content-Type": "application/json",`,
      `    "Idempotency-Key": f"image-request-{uuid.uuid4()}",`,
      '}',
      `payload = json.loads(r'''${bodyJson}''')`,
      '',
      `response = requests.post(f"{base_url}${ctx.endpointPath}", headers=headers, json=payload)`,
      'response.raise_for_status()',
      'task = response.json()',
      '',
      `while task["status"] not in {"completed", "failed"}:`,
      '    time.sleep(int(response.headers.get("Retry-After", "2")))',
      `    response = requests.get(f"{base_url}${pollPath(ctx, "{task['task_id']}")}", headers=headers)`,
      '    response.raise_for_status()',
      '    task = response.json()',
      '',
      'if task["status"] == "failed":',
      '    raise RuntimeError(task["error"]["message"])',
      '',
      'print(task["result"]["data"][0]["url"])',
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

  return [
    ...typeDeclaration,
    `const baseUrl = '${ctx.baseUrl}'`,
    `const idempotencyKey = \`image-request-\${crypto.randomUUID()}\``,
    `const headers = {`,
    `  Authorization: \`Bearer \${process.env.${ctx.apiKeyEnv}}\`,`,
    `  'Content-Type': 'application/json',`,
    `  'Idempotency-Key': idempotencyKey,`,
    `}`,
    '',
    `let response = await fetch(\`${'${baseUrl}'}${ctx.endpointPath}\`, {`,
    `  method: 'POST',`,
    `  headers,`,
    `  body: JSON.stringify(${bodyJson}),`,
    `})`,
    `if (!response.ok) throw new Error(await response.text())`,
    `let task = (await response.json())${jsonCast}`,
    '',
    `while (task.status !== 'completed' && task.status !== 'failed') {`,
    `  const retryAfter = Number(response.headers.get('Retry-After') || 2)`,
    `  await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))`,
    `  response = await fetch(`,
    `    \`${'${baseUrl}'}${pollPath(ctx, '${task.task_id}')}\`,`,
    `    { headers }`,
    `  )`,
    `  if (!response.ok) throw new Error(await response.text())`,
    `  task = (await response.json())${jsonCast}`,
    `}`,
    '',
    `if (task.status === 'failed') throw new Error(task.error?.message)`,
    `console.log(task.result?.data?.[0]?.url)`,
  ].join('\n')
}
