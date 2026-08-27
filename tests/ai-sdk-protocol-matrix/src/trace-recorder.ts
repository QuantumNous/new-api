import { AsyncLocalStorage } from "node:async_hooks"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import type { OperationTrace } from "./types.js"
import { headersToRecord, nowIso, redactText, redactUrl, sanitizeSegment, toSerializable, writeJson, writeText } from "./util.js"

interface TraceScope {
  absoluteDirectory: string
  relativeDirectory: string
  nextExchange: number
  pending: Set<Promise<void>>
}

export interface OperationExecution<T> {
  value: T
  trace: OperationTrace
}

function parseJsonBody(body: string): unknown {
  if (!body.trim()) return undefined
  try {
    return JSON.parse(body)
  } catch {
    return undefined
  }
}

function parseEventStream(body: string): unknown[] {
  const events: unknown[] = []
  const blocks = body.split(/\r?\n\r?\n/)
  for (const block of blocks) {
    if (!block.trim()) continue
    const eventName = block
      .split(/\r?\n/)
      .find((line) => line.startsWith("event:"))
      ?.slice("event:".length)
      .trim()
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trimStart())
      .join("\n")
    if (!data) {
      events.push({ event: eventName, raw: block })
      continue
    }
    if (data === "[DONE]") {
      events.push({ event: eventName, data })
      continue
    }
    try {
      events.push({ event: eventName, data: JSON.parse(data) })
    } catch {
      events.push({ event: eventName, data })
    }
  }
  return events
}

export class TraceRecorder {
  readonly fetch: typeof fetch
  private readonly storage = new AsyncLocalStorage<TraceScope>()
  private readonly secrets: string[]

  constructor(
    private readonly outputRoot: string,
    apiKey: string,
  ) {
    this.secrets = [apiKey].filter(Boolean)
    this.fetch = this.recordingFetch.bind(this) as typeof fetch
  }

  async withOperation<T>(relativeDirectory: string, operationName: string, fn: () => Promise<T>): Promise<OperationExecution<T>> {
    const operationSegment = sanitizeSegment(operationName)
    const relative = path.join(relativeDirectory, operationSegment)
    const absolute = path.join(this.outputRoot, relative)
    await mkdir(absolute, { recursive: true })
    const scope: TraceScope = {
      absoluteDirectory: absolute,
      relativeDirectory: relative.split(path.sep).join("/"),
      nextExchange: 1,
      pending: new Set(),
    }

    let value: T | undefined
    let operationError: unknown
    await this.storage.run(scope, async () => {
      try {
        value = await fn()
      } catch (error) {
        operationError = error
      } finally {
        await Promise.allSettled(scope.pending)
      }
    })

    if (operationError !== undefined) throw operationError
    return {
      value: value as T,
      trace: {
        relativeDirectory: scope.relativeDirectory,
        exchangeCount: scope.nextExchange - 1,
      },
    }
  }

  private async recordingFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const scope = this.storage.getStore()
    if (!scope) throw new Error("TraceRecorder.fetch was called outside withOperation()")

    const sequence = scope.nextExchange
    scope.nextExchange += 1
    const prefix = `http-${String(sequence).padStart(3, "0")}`
    const request = new Request(input, init)
    const startedAt = nowIso()
    const startTime = performance.now()
    let requestBody = ""
    try {
      requestBody = await request.clone().text()
    } catch (error) {
      await writeJson(path.join(scope.absoluteDirectory, `${prefix}.request-body-error.json`), error, this.secrets)
    }

    await Promise.all([
      writeJson(
        path.join(scope.absoluteDirectory, `${prefix}.request.json`),
        {
          sequence,
          startedAt,
          method: request.method,
          url: redactUrl(request.url, this.secrets),
          headers: headersToRecord(request.headers, this.secrets),
          parsedBody: parseJsonBody(redactText(requestBody, this.secrets)),
        },
        this.secrets,
      ),
      writeText(path.join(scope.absoluteDirectory, `${prefix}.request.body.txt`), requestBody, this.secrets),
    ])

    let response: Response
    try {
      response = await fetch(request)
    } catch (error) {
      await writeJson(
        path.join(scope.absoluteDirectory, `${prefix}.network-error.json`),
        {
          sequence,
          startedAt,
          finishedAt: nowIso(),
          durationMs: Math.round(performance.now() - startTime),
          error,
        },
        this.secrets,
      )
      throw error
    }

    const responseClone = response.clone()
    const capture = responseClone
      .text()
      .then(async (responseBody) => {
        const contentType = response.headers.get("content-type") ?? ""
        const parsedBody = contentType.includes("text/event-stream")
          ? parseEventStream(responseBody)
          : parseJsonBody(responseBody)
        await Promise.all([
          writeJson(
            path.join(scope.absoluteDirectory, `${prefix}.response.json`),
            {
              sequence,
              startedAt,
              finishedAt: nowIso(),
              durationMs: Math.round(performance.now() - startTime),
              status: response.status,
              statusText: response.statusText,
              ok: response.ok,
              url: redactUrl(response.url || request.url, this.secrets),
              headers: headersToRecord(response.headers, this.secrets),
              parsedBody: toSerializable(parsedBody, this.secrets),
            },
            this.secrets,
          ),
          writeText(path.join(scope.absoluteDirectory, `${prefix}.response.body.txt`), responseBody, this.secrets),
        ])
      })
      .catch(async (error) => {
        await writeJson(path.join(scope.absoluteDirectory, `${prefix}.response-body-error.json`), error, this.secrets)
      })
      .finally(() => {
        scope.pending.delete(capture)
      })

    scope.pending.add(capture)
    return response
  }
}
