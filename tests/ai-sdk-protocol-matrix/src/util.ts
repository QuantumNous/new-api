import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

const SECRET_HEADER_NAMES = new Set([
  "authorization",
  "api-key",
  "x-api-key",
  "x-goog-api-key",
  "proxy-authorization",
  "cookie",
  "set-cookie",
])

export function sanitizeSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
}

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/g, "")
}

export function keyFingerprint(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex").slice(0, 12)
}

export function sha256(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex")
}

export function redactText(value: string, secrets: string[]): string {
  let result = value
  for (const secret of secrets) {
    if (!secret) continue
    result = result.split(secret).join("[REDACTED]")
    const encoded = encodeURIComponent(secret)
    if (encoded !== secret) result = result.split(encoded).join("[REDACTED]")
  }
  return result
}

export function redactUrl(value: string, secrets: string[]): string {
  const redacted = redactText(value, secrets)
  try {
    const url = new URL(redacted)
    for (const key of ["key", "api_key", "apikey", "access_token"]) {
      if (url.searchParams.has(key)) url.searchParams.set(key, "[REDACTED]")
    }
    return url.toString()
  } catch {
    return redacted
  }
}

export function headersToRecord(headers: Headers, secrets: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [name, value] of headers.entries()) {
    result[name] = SECRET_HEADER_NAMES.has(name.toLowerCase()) ? "[REDACTED]" : redactText(value, secrets)
  }
  return result
}

function serializeError(error: Error, secrets: string[], seen: WeakSet<object>): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: error.name,
    message: redactText(error.message, secrets),
    stack: error.stack ? redactText(error.stack, secrets) : undefined,
  }
  for (const key of Object.getOwnPropertyNames(error)) {
    if (key in result) continue
    result[key] = toSerializable((error as unknown as Record<string, unknown>)[key], secrets, seen)
  }
  if (error.cause !== undefined) result.cause = toSerializable(error.cause, secrets, seen)
  return result
}

export function toSerializable(value: unknown, secrets: string[] = [], seen = new WeakSet<object>()): unknown {
  if (value === undefined) return "[undefined]"
  if (value === null || typeof value === "boolean" || typeof value === "number") return value
  if (typeof value === "string") return redactText(value, secrets)
  if (typeof value === "bigint") return value.toString()
  if (typeof value === "symbol") return String(value)
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`
  if (value instanceof URL) return redactUrl(value.toString(), secrets)
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Headers) return headersToRecord(value, secrets)
  if (value instanceof Error) return serializeError(value, secrets, seen)
  if (value instanceof Uint8Array) {
    return {
      type: value.constructor.name,
      byteLength: value.byteLength,
      sha256: sha256(value),
    }
  }
  if (value instanceof ArrayBuffer) {
    const bytes = new Uint8Array(value)
    return { type: "ArrayBuffer", byteLength: bytes.byteLength, sha256: sha256(bytes) }
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return "[Circular]"
    seen.add(value)
    return value.map((item) => toSerializable(item, secrets, seen))
  }
  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]"
    seen.add(value)
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      result[key] = toSerializable(item, secrets, seen)
    }
    return result
  }
  return String(value)
}

export async function writeJson(filePath: string, value: unknown, secrets: string[] = []): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(toSerializable(value, secrets), null, 2)}\n`, "utf8")
}

export async function writeText(filePath: string, value: string, secrets: string[] = []): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, redactText(value, secrets), "utf8")
}

export function hasOwnString(value: unknown, key: string): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && typeof (value as Record<string, unknown>)[key] === "string"
}

export function nowIso(): string {
  return new Date().toISOString()
}
