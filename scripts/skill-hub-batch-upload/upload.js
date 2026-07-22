#!/usr/bin/env node
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

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const { URL } = require("node:url");

const ZIP_MAX_BYTES = 50 * 1024 * 1024;
const ICON_MAX_BYTES = 1024 * 1024;
const SKILL_NAME_MAX_CHARACTERS = 100;
const SKILL_ID_PATTERN = /^[a-z][a-z-]{0,127}$/;
const VALID_MODES = new Set(["skip", "update", "fail"]);
const EVALUATION_DIMENSIONS = ["safety", "access", "frontier", "economy"];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  normalizeOptions(options);

  const manifestPath = path.resolve(options.manifest);
  const entries = await readManifest(manifestPath);
  const report = createReport(options, manifestPath, entries);
  const validationErrors = validateEntries(entries);
  if (validationErrors.length > 0) {
    report.items = groupValidationErrors(validationErrors);
    report.finishedAt = new Date().toISOString();
    report.summary = summarizeResults(report.items);
    await writeReport(options.report, report);
    for (const error of validationErrors) {
      console.error(`Invalid manifest item #${error.index}: ${error.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Loaded ${entries.length} skills from ${manifestPath}. Mode=${options.mode}, dryRun=${options.dryRun}`,
  );
  if (entries.length === 0) {
    report.finishedAt = new Date().toISOString();
    report.summary = summarizeResults([]);
    await writeReport(options.report, report);
    return;
  }

  const results = await runWithConcurrency(
    entries,
    options,
    async (entry, index) => {
      const ordinal = `${index + 1}/${entries.length}`;
      console.log(`[${ordinal}] ${entry.id}: checking`);
      const result = await processEntry(entry, options);
      console.log(
        `[${ordinal}] ${entry.id}: ${result.status}${result.action ? ` (${result.action})` : ""}`,
      );
      return result;
    },
  );

  report.items = results;
  report.finishedAt = new Date().toISOString();
  report.summary = summarizeResults(results);
  await writeReport(options.report, report);

  const failed = results.filter((item) => item.status === "failed").length;
  const succeeded = results.filter((item) => item.status === "success").length;
  const skipped = results.filter((item) => item.status === "skipped").length;
  console.log(
    `Done. success=${succeeded}, skipped=${skipped}, failed=${failed}, report=${options.report}`,
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const options = {
    baseUrl:
      process.env.SKILL_HUB_BASE_URL || process.env.NEW_API_BASE_URL || "",
    token:
      process.env.SKILL_HUB_ADMIN_TOKEN ||
      process.env.NEW_API_ADMIN_TOKEN ||
      "",
    cookie:
      process.env.SKILL_HUB_SESSION_COOKIE ||
      process.env.NEW_API_SESSION_COOKIE ||
      "",
    userId:
      process.env.SKILL_HUB_ADMIN_USER_ID ||
      process.env.NEW_API_ADMIN_USER_ID ||
      "",
    manifest: "",
    mode: "skip",
    concurrency: 2,
    dryRun: false,
    stopOnError: false,
    report: "",
    timeoutMs: 10 * 60 * 1000,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const [name, inlineValue] = arg.slice(2).split(/=(.*)/s, 2);
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      index += 1;
      if (index >= argv.length) {
        throw new Error(`Missing value for --${name}`);
      }
      return argv[index];
    };

    switch (name) {
      case "base-url":
        options.baseUrl = readValue();
        break;
      case "token":
        options.token = readValue();
        break;
      case "cookie":
      case "session-cookie":
        options.cookie = readValue();
        break;
      case "user-id":
        options.userId = readValue();
        break;
      case "manifest":
        options.manifest = readValue();
        break;
      case "mode":
        options.mode = readValue();
        break;
      case "concurrency":
        options.concurrency = Number(readValue());
        break;
      case "report":
        options.report = readValue();
        break;
      case "timeout-ms":
        options.timeoutMs = Number(readValue());
        break;
      case "dry-run":
        options.dryRun = true;
        break;
      case "stop-on-error":
        options.stopOnError = true;
        break;
      case "help":
      case "h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option: --${name}`);
    }
  }

  return options;
}

function normalizeOptions(options) {
  if (!options.manifest) {
    throw new Error("--manifest is required");
  }
  if (!options.baseUrl) {
    throw new Error("--base-url is required, or set SKILL_HUB_BASE_URL");
  }
  if (!options.token && !options.cookie) {
    throw new Error(
      "--token or --cookie is required, or set SKILL_HUB_ADMIN_TOKEN / SKILL_HUB_SESSION_COOKIE",
    );
  }
  if (!options.userId) {
    throw new Error("--user-id is required, or set SKILL_HUB_ADMIN_USER_ID");
  }
  if (!VALID_MODES.has(options.mode)) {
    throw new Error("--mode must be one of: skip, update, fail");
  }
  if (
    !Number.isInteger(options.concurrency) ||
    options.concurrency <= 0 ||
    options.concurrency > 10
  ) {
    throw new Error("--concurrency must be an integer between 1 and 10");
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error("--timeout-ms must be a positive number");
  }
  options.baseUrl = options.baseUrl.replace(/\/+$/, "");
  options.report = path.resolve(
    options.report || "skill-hub-batch-upload-report.json",
  );
}

async function readManifest(manifestPath) {
  const baseDir = path.dirname(manifestPath);
  const content = await fsp.readFile(manifestPath, "utf8");
  const text = content.replace(/^\uFEFF/, "").trim();
  if (!text) return [];

  if (text.startsWith("[") || text.startsWith("{")) {
    const parsed = JSON.parse(text);
    const items = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.skills)
        ? parsed.skills
        : [parsed];
    return items.map((item, index) => normalizeEntry(item, index + 1, baseDir));
  }

  return text
    .split(/\r?\n/)
    .map((line, lineIndex) => ({ line: line.trim(), lineIndex: lineIndex + 1 }))
    .filter((item) => item.line !== "")
    .map((item, index) =>
      normalizeEntry(JSON.parse(item.line), index + 1, baseDir, item.lineIndex),
    );
}

function normalizeEntry(raw, index, baseDir, sourceLine) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      index,
      sourceLine,
      errors: ["entry must be an object"],
    };
  }

  const zipValue = firstString(
    raw.zip,
    raw.zipPath,
    raw.package,
    raw.packagePath,
  );
  const iconValue = firstString(raw.icon, raw.iconPath);
  let tags = [];
  let tagError = null;
  try {
    tags = normalizeTags(raw.tags);
  } catch (error) {
    tags = [];
    tagError = error;
  }

  const entry = {
    index,
    sourceLine,
    raw,
    id: cleanString(raw.id || raw.skillId),
    name: cleanString(raw.name),
    description: cleanString(raw.description),
    version: cleanString(raw.version) || "1.0.0",
    author: cleanString(raw.author),
    origin: cleanString(raw.origin || raw.sourceName),
    originUrl: cleanString(raw.originUrl || raw.sourceProjectUrl),
    license: cleanString(raw.license),
    evaluation: raw.evaluation ?? null,
    testcases: raw.testcases ?? null,
    tags,
    verified: Boolean(raw.verified),
    recommended: Boolean(raw.recommended),
    sort: normalizeSort(raw.sort),
    published: true,
    zipPath: zipValue ? resolveManifestPath(baseDir, zipValue) : "",
    iconPath: iconValue ? resolveManifestPath(baseDir, iconValue) : "",
    errors: [],
  };

  if (!entry.id) entry.errors.push("id is required");
  if (entry.id && !SKILL_ID_PATTERN.test(entry.id)) {
    entry.errors.push("id must match /^[a-z][a-z-]{0,127}$/");
  }
  if (!entry.name) {
    entry.errors.push("name is required");
  } else {
    const nameLength = Array.from(entry.name).length;
    if (nameLength > SKILL_NAME_MAX_CHARACTERS) {
      entry.errors.push(
        `name must be ${SKILL_NAME_MAX_CHARACTERS} characters or fewer; got ${nameLength}`,
      );
    }
  }
  if (!entry.version) entry.errors.push("version is required");
  if (Array.from(entry.origin).length > 64) {
    entry.errors.push("origin must be 64 characters or fewer");
  }
  if (
    entry.originUrl.length > 2048 ||
    (entry.originUrl && !isHttpURL(entry.originUrl))
  ) {
    entry.errors.push(
      "originUrl must be an absolute HTTP or HTTPS URL with at most 2048 characters",
    );
  }
  if (Array.from(entry.license).length > 128) {
    entry.errors.push("license must be 128 characters or fewer");
  }
  const evaluationError = validateEvaluation(entry.evaluation);
  if (evaluationError) entry.errors.push(evaluationError);
  if (
    entry.testcases !== null &&
    (!entry.testcases ||
      typeof entry.testcases !== "object" ||
      Array.isArray(entry.testcases))
  ) {
    entry.errors.push("testcases must be an object or null");
  }
  if (tagError) {
    entry.errors.push(tagError.message || String(tagError));
  }
  if (!zipValue) entry.errors.push("zip is required");
  if (zipValue && isHttpURL(zipValue)) {
    entry.errors.push("zip must be a local file path, not a URL");
  }
  if (iconValue && isHttpURL(iconValue)) {
    entry.errors.push(
      "icon must be a local file path; omit icon or set it to an empty string to clear it during update",
    );
  }

  return entry;
}

function validateEvaluation(evaluation) {
  if (evaluation === null) return "";
  if (!evaluation || typeof evaluation !== "object" || Array.isArray(evaluation)) {
    return "evaluation must be an object or null";
  }
  if (
    !evaluation.dimensions ||
    typeof evaluation.dimensions !== "object" ||
    Array.isArray(evaluation.dimensions)
  ) {
    return "evaluation.dimensions must be an object";
  }
  for (const key of EVALUATION_DIMENSIONS) {
    const dimension = evaluation.dimensions[key];
    if (!dimension || typeof dimension !== "object" || Array.isArray(dimension)) {
      return `evaluation.dimensions.${key} is required`;
    }
    if (
      typeof dimension.score !== "number" ||
      !Number.isFinite(dimension.score) ||
      dimension.score < 0 ||
      dimension.score > 5
    ) {
      return `evaluation.dimensions.${key}.score must be between 0 and 5`;
    }
  }
  if (
    evaluation.overallScore !== undefined &&
    (typeof evaluation.overallScore !== "number" ||
      !Number.isFinite(evaluation.overallScore) ||
      evaluation.overallScore < 0 ||
      evaluation.overallScore > 5)
  ) {
    return "evaluation.overallScore must be between 0 and 5";
  }
  return "";
}

function validateEntries(entries) {
  const errors = [];
  const seenIDs = new Map();

  for (const entry of entries) {
    for (const message of entry.errors || []) {
      errors.push({ index: entry.index, id: entry.id, message });
    }
    if (entry.id) {
      const firstIndex = seenIDs.get(entry.id);
      if (firstIndex) {
        errors.push({
          index: entry.index,
          id: entry.id,
          message: `duplicate id in manifest; first seen at item #${firstIndex}`,
        });
      } else {
        seenIDs.set(entry.id, entry.index);
      }
    }

    validateFile(entry, "zip", ZIP_MAX_BYTES, [".zip"], errors);
    if (entry.iconPath) {
      validateFile(
        entry,
        "icon",
        ICON_MAX_BYTES,
        [".png", ".jpg", ".jpeg", ".webp"],
        errors,
      );
    }
  }

  return errors;
}

function groupValidationErrors(validationErrors) {
  const byIndex = new Map();
  for (const error of validationErrors) {
    if (!byIndex.has(error.index)) {
      byIndex.set(error.index, {
        status: "failed",
        id: error.id || "",
        index: error.index,
        errors: [],
      });
    }
    byIndex.get(error.index).errors.push(error.message);
  }
  return Array.from(byIndex.values()).map((item) => ({
    ...item,
    error: item.errors.join("; "),
  }));
}

function validateFile(entry, kind, maxBytes, extensions, errors) {
  const filePath = kind === "zip" ? entry.zipPath : entry.iconPath;
  if (!filePath) return;

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    errors.push({
      index: entry.index,
      id: entry.id,
      message: `${kind} file does not exist: ${filePath}`,
    });
    return;
  }
  if (!stat.isFile()) {
    errors.push({
      index: entry.index,
      id: entry.id,
      message: `${kind} path is not a file: ${filePath}`,
    });
  }
  if (stat.size <= 0) {
    errors.push({
      index: entry.index,
      id: entry.id,
      message: `${kind} file is empty: ${filePath}`,
    });
  }
  if (stat.size > maxBytes) {
    errors.push({
      index: entry.index,
      id: entry.id,
      message: `${kind} file is too large: ${filePath} (${stat.size} bytes)`,
    });
  }
  const ext = path.extname(filePath).toLowerCase();
  if (!extensions.includes(ext)) {
    errors.push({
      index: entry.index,
      id: entry.id,
      message: `${kind} file extension must be one of ${extensions.join(", ")}: ${filePath}`,
    });
  }
}

async function processEntry(entry, options) {
  const item = {
    index: entry.index,
    id: entry.id,
    status: "",
    action: "",
    zipPath: entry.zipPath,
    iconPath: entry.iconPath || "",
  };

  try {
    const existing = await getExistingSkill(entry.id, options);
    if (existing && options.mode === "skip") {
      return {
        ...item,
        status: "skipped",
        action: "exists",
        message: "skill already exists",
      };
    }
    if (existing && options.mode === "fail") {
      return {
        ...item,
        status: "failed",
        action: "exists",
        error: "skill already exists",
      };
    }

    const action = existing ? "update" : "create";
    if (options.dryRun) {
      return {
        ...item,
        status: "skipped",
        action: `dry-run-${action}`,
        message: "validated without uploading",
      };
    }

    const uploadTickets = [];
    try {
      const zipUpload = await uploadLocalObject(entry, "zip", options);
      uploadTickets.push(zipUpload.ticket);

      let iconUpload = null;
      if (entry.iconPath) {
        iconUpload = await uploadLocalObject(entry, "icon", options);
        uploadTickets.push(iconUpload.ticket);
      }

      const payload = buildSkillPayload(
        entry,
        zipUpload.result,
        iconUpload && iconUpload.result,
      );
      const response = existing
        ? await apiJSON(
            options,
            "PUT",
            `/api/admin/skill-hub/skills/${encodeURIComponent(entry.id)}`,
            payload,
          )
        : await apiJSON(
            options,
            "POST",
            "/api/admin/skill-hub/skills",
            payload,
          );

      return {
        ...item,
        status: "success",
        action,
        zip: compactUpload(zipUpload.result),
        icon: iconUpload ? compactUpload(iconUpload.result) : undefined,
        skill: response.data,
      };
    } catch (error) {
      await cleanupTickets(uploadTickets, options);
      throw error;
    }
  } catch (error) {
    if (options.stopOnError) {
      throw error;
    }
    return {
      ...item,
      status: "failed",
      error: error.message || String(error),
    };
  }
}

async function getExistingSkill(id, options) {
  const response = await apiJSON(
    options,
    "GET",
    `/api/admin/skill-hub/skills/${encodeURIComponent(id)}`,
    undefined,
    { allowBusinessError: true },
  );
  if (response.success) {
    return response.data || null;
  }
  const message = String(response.message || "").toLowerCase();
  if (message.includes("record not found") || message.includes("not found")) {
    return null;
  }
  throw new Error(response.message || `failed to check skill ${id}`);
}

async function uploadLocalObject(entry, kind, options) {
  const filePath = kind === "zip" ? entry.zipPath : entry.iconPath;
  const stat = fs.statSync(filePath);
  const init = await apiJSON(
    options,
    "POST",
    "/api/admin/skill-hub/direct-upload/init",
    {
      kind,
      skillId: entry.id,
      version: kind === "zip" ? entry.version : "",
      fileName: path.basename(filePath),
      size: stat.size,
    },
  );

  const upload = init.data;
  const ticket = upload.uploadTicket;
  try {
    await putFile(upload, filePath, stat.size, options.timeoutMs);
    const completed = await apiJSON(
      options,
      "POST",
      "/api/admin/skill-hub/direct-upload/complete",
      {
        uploadTicket: ticket,
      },
    );
    return {
      ticket,
      result: completed.data,
    };
  } catch (error) {
    await discardUpload(ticket, options);
    throw error;
  }
}

function buildSkillPayload(entry, zipUpload, iconUpload) {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    version: entry.version,
    author: entry.author,
    origin: entry.origin,
    originUrl: entry.originUrl,
    license: entry.license,
    icon: iconUpload ? iconUpload.url : "",
    tags: entry.tags,
    verified: entry.verified,
    recommended: entry.recommended,
    published: true,
    sort: entry.sort,
    evaluation: entry.evaluation,
    testcases: entry.testcases,
    source: {
      type: "zip",
      url: zipUpload.url,
      ref: zipUpload.object,
      checksum: zipUpload.checksum,
    },
  };
}

async function cleanupTickets(tickets, options) {
  for (const ticket of tickets.filter(Boolean)) {
    await discardUpload(ticket, options);
  }
}

async function discardUpload(ticket, options) {
  if (!ticket) return;
  try {
    await apiJSON(
      options,
      "POST",
      "/api/admin/skill-hub/direct-upload/discard",
      {
        uploadTicket: ticket,
      },
    );
  } catch (error) {
    console.warn(
      `Failed to discard temporary upload: ${error.message || error}`,
    );
  }
}

async function apiJSON(options, method, pathname, body, requestOptions = {}) {
  const url = new URL(pathname, options.baseUrl);
  const headers = {
    Accept: "application/json",
    "New-Api-User": String(options.userId),
  };
  if (options.token) {
    headers.Authorization = formatAuthorization(options.token);
  }
  if (options.cookie) {
    headers.Cookie = formatCookie(options.cookie);
  }
  const init = {
    method,
    headers,
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const response = await fetchWithTimeout(url, init, options.timeoutMs);
  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(
      `Invalid JSON from ${method} ${url.pathname}: ${text.slice(0, 200)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      parsed.message ||
        `${method} ${url.pathname} failed with HTTP ${response.status}`,
    );
  }
  if (
    parsed &&
    parsed.success === false &&
    !requestOptions.allowBusinessError
  ) {
    throw new Error(parsed.message || `${method} ${url.pathname} failed`);
  }
  return parsed;
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function putFile(upload, filePath, size, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(upload.uploadUrl);
    const client = url.protocol === "https:" ? https : http;
    const headers = {
      ...(upload.uploadHeaders || {}),
      "Content-Length": String(size),
    };
    const request = client.request(
      url,
      {
        method: upload.uploadMethod || "PUT",
        headers,
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve();
            return;
          }
          const body = Buffer.concat(chunks).toString("utf8").slice(0, 500);
          reject(
            new Error(
              `OSS upload failed with HTTP ${response.statusCode}: ${body}`,
            ),
          );
        });
      },
    );
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("OSS upload timed out"));
    });
    request.on("error", reject);
    fs.createReadStream(filePath).on("error", reject).pipe(request);
  });
}

async function runWithConcurrency(entries, options, worker) {
  const results = new Array(entries.length);
  let nextIndex = 0;
  let stopped = false;

  async function runWorker() {
    while (!stopped) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= entries.length) return;
      try {
        results[index] = await worker(entries[index], index);
      } catch (error) {
        results[index] = {
          index: entries[index].index,
          id: entries[index].id,
          status: "failed",
          error: error.message || String(error),
        };
        if (options.stopOnError) {
          stopped = true;
        }
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(options.concurrency, entries.length) },
    runWorker,
  );
  await Promise.all(workers);
  return results.filter(Boolean);
}

function normalizeTags(value) {
  if (value === undefined || value === null || value === "") return [];
  const rawValues = Array.isArray(value)
    ? value
    : String(value).split(/[,\uFF0C\r\n]/);
  const tags = [];
  const seen = new Set();

  for (const raw of rawValues) {
    if (typeof raw === "number") {
      throw new Error("tags must be names, not numeric IDs");
    }
    const tag = String(raw || "").trim();
    if (!tag) continue;
    if (/^\d+$/.test(tag)) {
      throw new Error(`tag "${tag}" looks like an ID; tags must be names`);
    }
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }

  return tags;
}

function normalizeSort(value) {
  if (value === undefined || value === null || value === "") return 0;
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.trunc(number);
}

function resolveManifestPath(baseDir, value) {
  const filePath = cleanString(value);
  if (!filePath) return "";
  return path.isAbsolute(filePath) ? filePath : path.resolve(baseDir, filePath);
}

function firstString(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function cleanString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function isHttpURL(value) {
  try {
    const url = new URL(String(value || "").trim());
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.host) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function formatAuthorization(token) {
  const value = String(token || "").trim();
  return `Bearer ${value.replace(/^bearer\s+/i, "")}`;
}

function formatCookie(cookie) {
  return String(cookie || "")
    .trim()
    .replace(/^cookie:\s*/i, "");
}

function compactUpload(upload) {
  if (!upload) return undefined;
  return {
    url: upload.url,
    object: upload.object,
    size: upload.size,
    checksum: upload.checksum,
  };
}

function createReport(options, manifestPath, entries) {
  return {
    startedAt: new Date().toISOString(),
    finishedAt: "",
    baseUrl: options.baseUrl,
    authMode: options.cookie ? "cookie" : "token",
    manifest: manifestPath,
    mode: options.mode,
    dryRun: options.dryRun,
    concurrency: options.concurrency,
    total: entries.length,
    summary: {},
    items: [],
  };
}

function summarizeResults(items) {
  const summary = {
    success: 0,
    skipped: 0,
    failed: 0,
  };
  for (const item of items) {
    if (item.status === "success") summary.success += 1;
    if (item.status === "skipped") summary.skipped += 1;
    if (item.status === "failed") summary.failed += 1;
  }
  return summary;
}

async function writeReport(reportPath, report) {
  await fsp.mkdir(path.dirname(reportPath), { recursive: true });
  await fsp.writeFile(
    reportPath,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
}

function printHelp() {
  console.log(`Skill Hub batch upload

Usage:
  node scripts/skill-hub-batch-upload/upload.js --base-url <url> (--cookie <cookie> | --token <token>) --user-id <id> --manifest <file>

Options:
  --base-url <url>       New API server base URL, or SKILL_HUB_BASE_URL
  --cookie <cookie>      Browser session cookie, or SKILL_HUB_SESSION_COOKIE
  --token <token>        Admin access token, or SKILL_HUB_ADMIN_TOKEN
  --user-id <id>         Admin user ID for New-Api-User, or SKILL_HUB_ADMIN_USER_ID
  --manifest <file>      JSON or JSONL manifest
  --mode <mode>          skip | update | fail; update synchronizes the icon (default: skip)
  --concurrency <n>      Parallel skill uploads, 1-10 (default: 2)
  --dry-run              Validate and check remote conflicts without uploading
  --stop-on-error        Stop scheduling new items after the first failure
  --report <file>        Report path (default: skill-hub-batch-upload-report.json)
  --timeout-ms <n>       API and upload timeout in milliseconds
  --help                 Show this help
`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
