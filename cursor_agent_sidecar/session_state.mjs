import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

const SCHEMA_VERSION = 1;

function clone(value) {
  return structuredClone(value);
}

function validateRecord(record) {
  if (!record || typeof record !== "object") throw new Error("invalid Cursor session record");
  if (!record.sessionId || !record.model || !record.credentialFingerprint) {
    throw new Error("incomplete Cursor session record");
  }
  if (!Array.isArray(record.toolUseIds) || record.toolUseIds.length === 0) {
    throw new Error("Cursor session record requires tool ids");
  }
  if (!Number.isFinite(record.expiresAt)) throw new Error("Cursor session record requires expiry");
  if (record.kind !== "awaiting" && record.kind !== "replay") {
    throw new Error("unsupported Cursor session record kind");
  }
}

export class CursorHarnessSessionState {
  constructor(filePath, options = {}) {
    this.filePath = String(filePath || "").trim();
    if (!this.filePath) throw new Error("Cursor session state path is required");
    this.now = options.now || (() => Date.now());
    this.onExpire = options.onExpire;
    this.records = new Map();
    this.pins = new Set();
    this.#load();
  }

  #load() {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(this.filePath, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw new Error(`failed to load Cursor session state: ${error?.message || error}`);
    }
    if (parsed?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.records)) {
      throw new Error("unsupported Cursor session state schema");
    }
    for (const record of parsed.records) {
      validateRecord(record);
      if (record.expiresAt > this.now()) this.records.set(record.sessionId, record);
      else this.#notifyExpired(record);
    }
    this.#flush();
  }

  #flush() {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(
      temporary,
      `${JSON.stringify({ schemaVersion: SCHEMA_VERSION, records: [...this.records.values()] })}\n`,
      { mode: 0o600 },
    );
    renameSync(temporary, this.filePath);
  }

  upsert(record) {
    validateRecord(record);
    this.records.set(record.sessionId, clone(record));
    this.#flush();
  }

  remove(sessionId) {
    this.pins.delete(sessionId);
    if (!this.records.delete(sessionId)) return false;
    this.#flush();
    return true;
  }

  findByToolUseIds(toolUseIds) {
    this.sweepExpired();
    const requested = new Set(toolUseIds.map(String));
    const matches = [...this.records.values()].filter((record) =>
      record.toolUseIds.some((id) => requested.has(id)),
    );
    if (matches.length === 0) return null;
    if (matches.length !== 1) {
      throw Object.assign(new Error("tool ids map to multiple persisted Cursor sessions"), {
        status: 409,
      });
    }
    return clone(matches[0]);
  }

  sweepExpired() {
    const now = this.now();
    let changed = false;
    for (const [sessionId, record] of this.records) {
      if (!this.pins.has(sessionId) && record.expiresAt <= now) {
        this.records.delete(sessionId);
        this.#notifyExpired(record);
        changed = true;
      }
    }
    if (changed) this.#flush();
    return changed;
  }

  pin(sessionId) {
    if (this.records.has(sessionId)) this.pins.add(sessionId);
  }

  unpin(sessionId) {
    this.pins.delete(sessionId);
  }

  touch(sessionId, expiresAt) {
    const record = this.records.get(sessionId);
    if (!record) return false;
    record.updatedAt = this.now();
    record.expiresAt = expiresAt;
    this.#flush();
    return true;
  }

  #notifyExpired(record) {
    if (typeof this.onExpire !== "function") return;
    Promise.resolve(this.onExpire(clone(record))).catch((error) => {
      console.error(
        `[cursor-session-state] failed to clean expired agent state session=${record.sessionId}: ${error?.message || error}`,
      );
    });
  }

  counts() {
    this.sweepExpired();
    let awaiting = 0;
    let replay = 0;
    for (const record of this.records.values()) {
      if (record.kind === "awaiting") awaiting += 1;
      else replay += 1;
    }
    return { awaiting, replay, total: awaiting + replay };
  }

  sessionIds() {
    this.sweepExpired();
    return [...this.records.keys()];
  }

  clear() {
    this.records.clear();
    this.pins.clear();
    rmSync(this.filePath, { force: true });
  }
}

export async function deleteSdkAgentState(store, agentId) {
  if (!store || !agentId) return;
  const runIds = [];
  let cursor;
  do {
    const page = await store.runs.list({
      filter: { agentIds: [agentId], limit: 50, ...(cursor ? { cursor } : {}) },
    });
    runIds.push(...page.items.map((run) => run.runId));
    cursor = page.nextCursor;
  } while (cursor);
  if (runIds.length > 0) await store.runEvents.delete({ filter: { runIds } });
  await store.checkpoints.delete({ filter: { agentIds: [agentId] } });
  await store.runs.delete({ filter: { agentIds: [agentId] } });
  await store.agents.delete({ filter: { agentIds: [agentId] } });
}
