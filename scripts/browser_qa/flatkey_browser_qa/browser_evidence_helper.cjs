const fs = require("node:fs");
const readline = require("node:readline");
const path = require("node:path");

const SAFE_LOGICAL_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const API_KEY_PATTERN = /\bsk-[A-Za-z0-9_-]{8,}\b/g;
const MAX_EVENTS = 1000;
const MAX_EVENT_BYTES = 64 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;
const SAFE_FIXED_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const FIXED_CASE_ID = /^FQA-[0-9]{4,}$/;
const FIXED_CASE_TOP_FIELDS = new Set([
  "schema_version",
  "id",
  "kind",
  "name",
  "enabled",
  "severity",
  "owner",
  "fixture",
  "start",
  "steps",
  "assertions",
  "evidence",
  "cleanup",
  "source",
  "promotion",
]);
const START_ORIGIN_URLS = Object.freeze({
  staging_website: "https://staging-website.flatkey.ai",
  staging_console: "https://staging-console.flatkey.ai",
  docs: "https://docs.flatkey.ai",
});
const FIXED_KINDS = new Set(["bug_regression", "coverage_baseline"]);
const FIXED_SEVERITIES = new Set(["critical", "high", "medium", "low", "info"]);
const FIXED_FIXTURES = new Set(["anonymous", "registered_user", "user_with_api_key"]);
const FIXED_CLEANUP = new Set(["required", "not_required"]);
const FIXED_PROMOTION_STATES = new Set([
  "candidate_draft",
  "reproduced_3_of_3",
  "awaiting_product_fix",
  "fixed_behavior_passed_3_of_3",
  "passed_3_of_3",
  "ready_for_review",
]);
const INIT_FAILURE_MESSAGES = Object.freeze({
  init_connect_failed: "browser connection failed",
  init_context_failed: "default browser context unavailable",
  init_websocket_block_failed: "websocket blocking unavailable",
  init_download_block_failed: "download blocking unavailable",
  init_service_worker_block_failed: "service worker blocking unavailable",
  init_page_failed: "browser page unavailable",
  init_service_worker_bypass_failed: "service worker bypass unavailable",
  init_failed: "browser evidence initialization failed",
});
const SAFE_PROTOCOL_ERROR_CODES = new Set([...Object.keys(INIT_FAILURE_MESSAGES), "command_failed"]);

class BrowserEvidenceHelperError extends Error {
  constructor(code) {
    super(INIT_FAILURE_MESSAGES[code] || "browser evidence helper failed");
    this.name = "BrowserEvidenceHelperError";
    this.code = SAFE_PROTOCOL_ERROR_CODES.has(code) ? code : "command_failed";
  }
}

async function runInitStage(code, operation) {
  try {
    return await operation();
  } catch (_error) {
    throw new BrowserEvidenceHelperError(code);
  }
}

function safeScreenshotPath(runtimeDir, logicalName) {
  if (typeof logicalName !== "string" || !SAFE_LOGICAL_NAME.test(logicalName)) {
    throw new Error("invalid screenshot name");
  }
  if (logicalName.endsWith(".png") || logicalName.includes("/") || logicalName.includes("\\") || logicalName.includes("..")) {
    throw new Error("invalid screenshot name");
  }
  const root = fs.realpathSync(runtimeDir);
  const screenshotDir = path.join(root, "screenshots");
  fs.mkdirSync(screenshotDir, { recursive: true, mode: 0o700 });
  const dirReal = fs.realpathSync(screenshotDir);
  if (dirReal !== path.join(root, "screenshots")) {
    throw new Error("screenshot directory must be regular runtime directory");
  }
  const target = path.join(dirReal, `${logicalName}.png`);
  if (!target.startsWith(dirReal + path.sep)) {
    throw new Error("screenshot path escaped runtime");
  }
  if (fs.existsSync(target)) {
    throw new Error("screenshot already exists");
  }
  return target;
}

async function buildMask(page, sensitiveValues = []) {
  const masks = [];
  for (const selector of [
    "input",
    "textarea",
    "[contenteditable=true]",
    "[autocomplete='one-time-code']",
    "input[name*=code i]",
    "input[id*=code i]",
  ]) {
    if (typeof page.locator === "function") {
      masks.push(page.locator(selector));
    }
  }
  const secrets = Array.isArray(sensitiveValues) ? sensitiveValues : [];
  for (const value of secrets) {
    if (typeof value === "string" && value.length > 0 && typeof page.getByText === "function") {
      masks.push(page.getByText(value, { exact: true }));
    }
  }
  if (typeof page.getByText === "function") {
    masks.push(page.getByText(/\bsk-[A-Za-z0-9_-]{8,}\b/));
  }
  return masks;
}

async function captureScreenshot(page, runtimeDir, logicalName, sensitiveValues = []) {
  const target = safeScreenshotPath(runtimeDir, logicalName);
  const mask = await buildMask(page, sensitiveValues);
  if (mask.length === 0) {
    throw new Error("screenshot mask is required");
  }
  const buffer = await page.screenshot({ mask, type: "png" });
  if (!Buffer.isBuffer(buffer)) {
    throw new Error("playwright did not return screenshot buffer");
  }
  const fd = fs.openSync(target, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
  try {
    fs.writeFileSync(fd, buffer);
  } finally {
    fs.closeSync(fd);
  }
  return { path: `screenshots/${path.basename(target)}` };
}

function projectConsoleEvent(event, sensitiveValues = []) {
  return {
    type: event && event.type,
    text: redactText(event && event.text, sensitiveValues),
    location: event && event.location,
  };
}

function projectNetworkEvent(event, sensitiveValues = []) {
  const projected = {};
  for (const key of ["url", "method", "status", "timing", "error"]) {
    if (event && Object.prototype.hasOwnProperty.call(event, key)) {
      projected[key] = key === "url" || key === "error" ? redactText(event[key], sensitiveValues) : event[key];
    }
  }
  return projected;
}

function isChromiumInternalServiceWorker(worker) {
  try {
    if (typeof worker?.url !== "function") {
      return false;
    }
    const workerUrl = worker.url();
    return typeof workerUrl === "string" && new URL(workerUrl).protocol === "chrome-extension:";
  } catch (_error) {
    return false;
  }
}

class BrowserEvidenceSession {
  constructor({ browser, runtimeDir, sensitiveValues = [], maxEvents = MAX_EVENTS, maxEventBytes = MAX_EVENT_BYTES, maxTotalBytes = MAX_TOTAL_BYTES, docsProxyUrl = null }) {
    this.browser = browser;
    this.runtimeDir = runtimeDir;
    this.sensitiveValues = Array.isArray(sensitiveValues) ? sensitiveValues.filter((value) => typeof value === "string" && value.length > 0) : [];
    this.maxEvents = maxEvents;
    this.maxEventBytes = maxEventBytes;
    this.maxTotalBytes = maxTotalBytes;
    this.totalBytes = 0;
    this.overflowError = null;
    this.console = [];
    this.network = [];
    this.context = null;
    this.page = null;
    this.docsProxyUrl = docsProxyUrl;
    this.pageSetupPromises = new Set();
    this.pageSetupError = null;
  }

  async start() {
    const contexts = await runInitStage(
      "init_context_failed",
      async () => typeof this.browser.contexts === "function" ? this.browser.contexts() : [],
    );
    this.context = contexts[0];
    if (!this.context) {
      throw new BrowserEvidenceHelperError("init_context_failed");
    }
    await runInitStage("init_websocket_block_failed", () => this._blockWebSockets());
    await runInitStage("init_download_block_failed", () => this._denyDownloads());
    await runInitStage("init_service_worker_block_failed", () => this._blockServiceWorkers());
    await runInitStage("init_context_failed", async () => this._attachContextListeners());
    const pages = await runInitStage(
      "init_page_failed",
      async () => typeof this.context.pages === "function" ? this.context.pages() : [],
    );
    this.page = pages[0] || await runInitStage(
      "init_page_failed",
      async () => typeof this.context.newPage === "function" ? this.context.newPage() : null,
    );
    if (!this.page) {
      throw new BrowserEvidenceHelperError("init_page_failed");
    }
    await runInitStage("init_service_worker_bypass_failed", () => this._setupPage(this.page));
    if (typeof this.context.on === "function") {
      await runInitStage("init_context_failed", async () => {
        this.context.on("page", (page) => {
          this._trackPageSetup(page);
        });
      });
    }
    return this;
  }

  async _blockWebSockets() {
    if (typeof this.context.routeWebSocket !== "function") {
      throw new Error("websocket blocking unavailable");
    }
    try {
      await this.context.routeWebSocket("**/*", async (socket) => {
        if (socket && typeof socket.close === "function") {
          await socket.close();
        }
      });
    } catch (_error) {
      throw new Error("websocket blocking unavailable");
    }
  }

  async _denyDownloads() {
    if (!this.browser || typeof this.browser.newBrowserCDPSession !== "function") {
      throw new Error("download blocking unavailable");
    }
    let session;
    try {
      session = await this.browser.newBrowserCDPSession();
      if (!session || typeof session.send !== "function") {
        throw new Error("download blocking unavailable");
      }
      await session.send("Browser.setDownloadBehavior", { behavior: "deny" });
    } catch (_error) {
      throw new Error("download blocking unavailable");
    } finally {
      if (session && typeof session.detach === "function") {
        await session.detach().catch(() => {});
      }
    }
  }

  async _blockServiceWorkers() {
    if (typeof this.context.addInitScript !== "function") {
      throw new Error("service worker blocking unavailable");
    }
    if (typeof this.context.on === "function") {
      this.context.on("serviceworker", (worker) => {
        if (!isChromiumInternalServiceWorker(worker)) {
          throw new Error("service worker registration blocked");
        }
      });
    }
    if (
      typeof this.context.serviceWorkers === "function"
      && this.context.serviceWorkers().some((worker) => !isChromiumInternalServiceWorker(worker))
    ) {
      throw new Error("service worker already registered");
    }
    await this.context.addInitScript(`
      if (navigator.serviceWorker) {
        navigator.serviceWorker.register = async () => {
          throw new Error("Service workers are blocked by Flatkey staging QA");
        };
      }
    `);
    if (
      typeof this.context.serviceWorkers === "function"
      && this.context.serviceWorkers().some((worker) => !isChromiumInternalServiceWorker(worker))
    ) {
      throw new Error("service worker already registered");
    }
  }

  _attachContextListeners() {
    if (typeof this.context.on !== "function") {
      return;
    }
    this.context.on("requestfinished", async (request) => {
      try {
        const response = typeof request.response === "function" ? await request.response() : null;
        this._pushNetwork({
          url: typeof request.url === "function" ? request.url() : undefined,
          method: typeof request.method === "function" ? request.method() : undefined,
          status: response && typeof response.status === "function" ? response.status() : undefined,
          timing: typeof request.timing === "function" ? request.timing() : undefined,
        });
      } catch (_error) {
        return;
      }
    });
    this.context.on("requestfailed", (request) => {
      try {
        const failure = typeof request.failure === "function" ? request.failure() : null;
        this._pushNetwork({
          url: typeof request.url === "function" ? request.url() : undefined,
          method: typeof request.method === "function" ? request.method() : undefined,
          error: failure && failure.errorText,
          timing: typeof request.timing === "function" ? request.timing() : undefined,
        });
      } catch (_error) {
        return;
      }
    });
  }

  async _bypassServiceWorkerForPage(page) {
    if (typeof this.context.newCDPSession !== "function") {
      throw new Error("service worker bypass unavailable");
    }
    const session = await this.context.newCDPSession(page);
    if (!session || typeof session.send !== "function") {
      throw new Error("service worker bypass unavailable");
    }
    await session.send("Network.setBypassServiceWorker", { bypass: true });
  }

  async _setupPage(page) {
    await this._bypassServiceWorkerForPage(page);
    this._attachPage(page);
  }

  _trackPageSetup(page) {
    let setupPromise;
    setupPromise = this._setupPage(page)
      .catch((error) => {
        if (!this.pageSetupError) {
          this.pageSetupError = error;
        }
        throw error;
      })
      .finally(() => {
        this.pageSetupPromises.delete(setupPromise);
      });
    this.pageSetupPromises.add(setupPromise);
    setupPromise.catch(() => {});
    return setupPromise;
  }

  async _awaitPageSetups() {
    while (this.pageSetupPromises.size > 0) {
      const pendingSetups = Array.from(this.pageSetupPromises);
      await Promise.allSettled(pendingSetups);
      if (this.pageSetupError) {
        throw new Error("browser page setup failed");
      }
    }
    if (this.pageSetupError) {
      throw new Error("browser page setup failed");
    }
  }

  _attachPage(page) {
    if (!page || typeof page.on !== "function") {
      return;
    }
    page.on("console", (message) => {
      this._pushConsole({
        type: typeof message.type === "function" ? message.type() : undefined,
        text: typeof message.text === "function" ? message.text() : undefined,
        location: typeof message.location === "function" ? message.location() : undefined,
      });
    });
  }

  addSensitiveValues(values) {
    if (!Array.isArray(values)) {
      throw new Error("sensitive values must be an array");
    }
    for (const value of values) {
      if (typeof value === "string" && value.length > 0 && !this.sensitiveValues.includes(value)) {
        this.sensitiveValues.push(value);
      }
    }
  }

  async captureScreenshot(name) {
    await this._awaitPageSetups();
    return captureScreenshot(this.page, this.runtimeDir, name, this.sensitiveValues);
  }

  async flush() {
    await this._awaitPageSetups();
    if (this.overflowError) {
      throw new Error("browser evidence overflow");
    }
    const payload = {
      console: this.console.splice(0, this.console.length),
      network: this.network.splice(0, this.network.length),
    };
    return payload;
  }

  async readDocs(url) {
    const target = validateDocsUrl(url);
    if (!this.docsProxyUrl) {
      throw new Error("docs proxy unavailable");
    }
    if (!this.browser || typeof this.browser.newContext !== "function") {
      throw new Error("docs context unavailable");
    }
    const context = await this.browser.newContext({
      proxy: { server: this.docsProxyUrl },
      javaScriptEnabled: false,
      serviceWorkers: "block",
      acceptDownloads: false,
      storageState: { cookies: [], origins: [] },
    });
    try {
      if (typeof context.routeWebSocket === "function") {
        await context.routeWebSocket("**/*", async (socket) => {
          if (socket && typeof socket.close === "function") {
            await socket.close();
          }
        });
      }
      await context.route("**/*", async (route) => {
        const request = route.request();
        const requestUrl = typeof request.url === "function" ? request.url() : "";
        const method = typeof request.method === "function" ? request.method() : "";
        if (!isAllowedDocsRequest(requestUrl, method)) {
          await route.abort();
          return;
        }
        await route.continue({ headers: stripSensitiveRequestHeaders(request.headers()) });
      });
      const page = await context.newPage();
      try {
        await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 30000 });
      } catch (error) {
        throw new Error("docs read failed");
      }
      const finalUrl = typeof page.url === "function" ? page.url() : target.href;
      if (!isAllowedDocsRequest(finalUrl, "GET")) {
        throw new Error("docs redirect blocked");
      }
      const html = typeof page.content === "function" ? await page.content() : "";
      return { url: finalUrl, status: 200, text: textFromHtml(html) };
    } finally {
      await context.close();
    }
  }

  async executeFixedCase(params) {
    await this._awaitPageSetups();
    const prepared = prepareFixedCaseExecution(params, this.runtimeDir);
    const { casePayload, attemptId, attemptDir, relativeEvidenceDir } = prepared;
    const result = {
      status: "passed",
      case_id: casePayload.id,
      attempt_id: attemptId,
      evidence_dir: relativeEvidenceDir,
      steps: [],
      assertions: [],
      failure: null,
    };
    const documentStatus = attachFixedCaseDocumentStatusTracker(this.page);
    const fail = async (failure) => {
      result.status = "failed";
      result.failure = {
        ...failure,
        evidence: await this._captureFixedCaseFailureEvidence(attemptDir, casePayload.evidence),
      };
      return result;
    };

    try {
      const startStatus = await this._fixedCaseNavigate(casePayload.start.path, casePayload.start.origin);
      documentStatus.set(startStatus);
      for (let index = 0; index < casePayload.steps.length; index += 1) {
        const step = casePayload.steps[index];
        const action = Object.keys(step)[0];
        try {
          const status = await this._executeFixedCaseStep(action, step[action], casePayload.start.origin);
          documentStatus.set(status);
          result.steps.push({ index, action, status: "passed" });
        } catch (_error) {
          return fail({ phase: "step", index, action, code: "step_failed" });
        }
      }
      for (let index = 0; index < casePayload.assertions.length; index += 1) {
        const assertion = casePayload.assertions[index];
        const assertionName = Object.keys(assertion)[0];
        if (!this._fixedCaseAssertionPassed(assertionName, assertion[assertionName], documentStatus.get())) {
          return fail({ phase: "assertion", index, assertion: assertionName, code: "assertion_failed" });
        }
        result.assertions.push({ index, assertion: assertionName, status: "passed" });
      }
      return result;
    } catch (_error) {
      return fail({ phase: "start", index: null, code: "navigation_failed" });
    } finally {
      documentStatus.stop();
    }
  }

  async _executeFixedCaseStep(action, payload, origin) {
    if (action === "navigate") {
      return this._fixedCaseNavigate(payload.path, origin);
    }
    if (action === "navigate_back") {
      const response = await this.page.goBack({ waitUntil: "domcontentloaded", timeout: 30000 });
      if (!response || typeof response.status !== "function") {
        throw new Error("back navigation did not produce a page response");
      }
      return response.status();
    }
    const locator = fixedCaseLocator(this.page, payload.locator);
    if (action === "click") {
      await locator.click();
      return null;
    }
    if (action === "fill") {
      await locator.fill(payload.value);
      return null;
    }
    if (action === "select") {
      await locator.selectOption(payload.value);
      return null;
    }
    if (action === "wait_for") {
      await locator.waitFor({ state: "visible", timeout: 30000 });
      return null;
    }
    throw new Error("invalid fixed case action");
  }

  async _fixedCaseNavigate(pathValue, origin) {
    const response = await this.page.goto(fixedCaseUrl(origin, pathValue), { waitUntil: "domcontentloaded", timeout: 30000 });
    if (!response || typeof response.status !== "function") {
      throw new Error("navigation did not produce a page response");
    }
    const status = response.status();
    if (typeof status !== "number") {
      throw new Error("navigation did not produce a page status");
    }
    return status;
  }

  _fixedCaseAssertionPassed(assertionName, expected, lastStatus) {
    if (assertionName === "page_status_not") {
      return typeof lastStatus === "number" && lastStatus !== expected;
    }
    if (assertionName === "url_not_contains") {
      const currentUrl = typeof this.page.url === "function" ? this.page.url() : "";
      return typeof currentUrl === "string" && !currentUrl.includes(expected);
    }
    throw new Error("invalid fixed case assertion");
  }

  async _captureFixedCaseFailureEvidence(attemptDir, flags) {
    const evidence = {};
    if (flags.screenshot_on_failure) {
      try {
        const screenshot = await captureScreenshot(this.page, attemptDir, "failure", this.sensitiveValues);
        evidence.screenshot = screenshot.path;
      } catch (_error) {
        evidence.screenshot_error = "capture_failed";
      }
    }
    if (flags.capture_console || flags.capture_network) {
      try {
        const flushed = await this.flush();
        if (flags.capture_console) {
          evidence.console = Array.isArray(flushed.console) ? flushed.console : [];
        }
        if (flags.capture_network) {
          evidence.network = Array.isArray(flushed.network) ? flushed.network : [];
        }
      } catch (_error) {
        evidence.flush_error = "flush_failed";
        if (flags.capture_console) {
          evidence.console = [];
        }
        if (flags.capture_network) {
          evidence.network = [];
        }
      }
    }
    return evidence;
  }

  async stop() {
    if (this.browser && typeof this.browser.close === "function") {
      await this.browser.close();
    }
  }

  _pushConsole(event) {
    this._pushBounded(this.console, projectConsoleEvent(event, this.sensitiveValues));
  }

  _pushNetwork(event) {
    this._pushBounded(this.network, projectNetworkEvent(event, this.sensitiveValues));
  }

  _pushBounded(target, event) {
    if (this.overflowError) {
      throw this.overflowError;
    }
    if (this.console.length + this.network.length >= this.maxEvents) {
      this.overflowError = new Error("browser evidence event limit exceeded");
      throw this.overflowError;
    }
    const size = Buffer.byteLength(JSON.stringify(event), "utf8");
    if (size > this.maxEventBytes) {
      this.overflowError = new Error("browser evidence event too large");
      throw this.overflowError;
    }
    if (this.totalBytes + size > this.maxTotalBytes) {
      this.overflowError = new Error("browser evidence total too large");
      throw this.overflowError;
    }
    this.totalBytes += size;
    target.push(event);
  }
}

async function runProtocol({ input = process.stdin, output = process.stdout, connectOverCDP } = {}) {
  const selectedConnect = connectOverCDP || defaultConnectOverCDP;
  let session = null;
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of rl) {
    let request;
    try {
      request = JSON.parse(line);
      if (!request || typeof request !== "object" || typeof request.id !== "number" || typeof request.command !== "string") {
        throw new Error("invalid request");
      }
      const params = request.params && typeof request.params === "object" ? request.params : {};
      let result = {};
      if (request.command === "init") {
        try {
          const browser = await runInitStage("init_connect_failed", () => selectedConnect(params.cdpEndpoint));
          session = await new BrowserEvidenceSession({
            browser,
            runtimeDir: params.runtimeDir,
            sensitiveValues: params.sensitiveValues,
            docsProxyUrl: params.docsProxyUrl,
          }).start();
        } catch (error) {
          if (error instanceof BrowserEvidenceHelperError) {
            throw error;
          }
          throw new BrowserEvidenceHelperError("init_failed");
        }
      } else if (request.command === "captureScreenshot") {
        requireSession(session);
        result = await session.captureScreenshot(params.name);
      } else if (request.command === "addSensitiveValues") {
        requireSession(session);
        session.addSensitiveValues(params.values);
      } else if (request.command === "flush") {
        requireSession(session);
        result = await session.flush();
      } else if (request.command === "readDocs") {
        requireSession(session);
        result = await session.readDocs(params.url);
      } else if (request.command === "executeFixedCase") {
        requireSession(session);
        result = await session.executeFixedCase(params);
      } else if (request.command === "close") {
        if (session) {
          await session.stop();
          session = null;
        }
      } else {
        throw new Error("unknown command");
      }
      output.write(JSON.stringify({ id: request.id, ok: true, result }) + "\n");
    } catch (error) {
      const id = request && typeof request.id === "number" ? request.id : 0;
      const fallback = request && request.command === "init" ? "init_failed" : "command_failed";
      const errorCode = error instanceof BrowserEvidenceHelperError && SAFE_PROTOCOL_ERROR_CODES.has(error.code)
        ? error.code
        : fallback;
      output.write(JSON.stringify({ id, ok: false, error: errorCode }) + "\n");
    }
  }
}

function requireSession(session) {
  if (!session) {
    throw new Error("browser evidence helper not initialized");
  }
}

function prepareFixedCaseExecution(params, runtimeDir) {
  if (!params || typeof params !== "object" || hasUnknownKeys(params, ["case", "attempt", "evidenceDir"])) {
    throw new Error("invalid fixed case");
  }
  const casePayload = params.case;
  const attempt = params.attempt;
  const evidenceDir = params.evidenceDir;
  validateFixedCase(casePayload);
  if (!attempt || typeof attempt !== "object" || hasUnknownKeys(attempt, ["id", "retry"])) {
    throw new Error("invalid fixed case");
  }
  if (!SAFE_FIXED_ID.test(attempt.id)) {
    throw new Error("invalid fixed case");
  }
  if (Object.prototype.hasOwnProperty.call(attempt, "retry") && (!Number.isInteger(attempt.retry) || attempt.retry < 0 || attempt.retry > 100)) {
    throw new Error("invalid fixed case");
  }
  if (typeof evidenceDir !== "string" || !path.isAbsolute(evidenceDir)) {
    throw new Error("invalid fixed case");
  }
  const root = fs.realpathSync(evidenceDir);
  const runtimeRoot = fs.realpathSync(runtimeDir);
  if (root !== runtimeRoot && !root.startsWith(runtimeRoot + path.sep)) {
    throw new Error("invalid fixed case");
  }
  const attemptDir = createSafeFixedEvidenceDir(root, casePayload.id, attempt.id);
  return {
    casePayload,
    attemptId: attempt.id,
    attemptDir,
    relativeEvidenceDir: `${casePayload.id}/${attempt.id}`,
  };
}

function validateFixedCase(casePayload) {
  if (!casePayload || typeof casePayload !== "object" || !hasExactKeys(casePayload, FIXED_CASE_TOP_FIELDS)) {
    throw new Error("invalid fixed case");
  }
  if (
    casePayload.schema_version !== 1
    || !FIXED_CASE_ID.test(casePayload.id)
    || !FIXED_KINDS.has(casePayload.kind)
    || typeof casePayload.enabled !== "boolean"
    || !FIXED_SEVERITIES.has(casePayload.severity)
    || casePayload.owner !== "browser-qa"
    || !FIXED_FIXTURES.has(casePayload.fixture)
    || !FIXED_CLEANUP.has(casePayload.cleanup)
  ) {
    throw new Error("invalid fixed case");
  }
  if (!casePayload.start || typeof casePayload.start !== "object") {
    throw new Error("invalid fixed case");
  }
  if (hasUnknownKeys(casePayload.start, ["origin", "path"]) || !START_ORIGIN_URLS[casePayload.start.origin] || !isRelativeFixedPath(casePayload.start.path)) {
    throw new Error("invalid fixed case");
  }
  if (
    !hasExactKeys(casePayload.evidence, ["screenshot_on_failure", "capture_console", "capture_network"])
    || !hasExactKeys(casePayload.source, ["run_id", "finding_fingerprint", "evidence_uri"])
    || !hasExactKeys(casePayload.promotion, ["state", "attempts_required", "attempts_passed"])
  ) {
    throw new Error("invalid fixed case");
  }
  for (const key of ["screenshot_on_failure", "capture_console", "capture_network"]) {
    if (typeof casePayload.evidence[key] !== "boolean") {
      throw new Error("invalid fixed case");
    }
  }
  if (
    !isFixedString(casePayload.source.run_id)
    || !isFixedString(casePayload.source.finding_fingerprint)
    || !isPrivateEvidenceUri(casePayload.source.evidence_uri)
    || !FIXED_PROMOTION_STATES.has(casePayload.promotion.state)
    || casePayload.promotion.attempts_required !== 3
    || !Number.isInteger(casePayload.promotion.attempts_passed)
    || casePayload.promotion.attempts_passed < 0
    || casePayload.promotion.attempts_passed > 3
  ) {
    throw new Error("invalid fixed case");
  }
  if (casePayload.enabled && (casePayload.promotion.state !== "ready_for_review" || casePayload.promotion.attempts_passed !== 3)) {
    throw new Error("invalid fixed case");
  }
  if (!Array.isArray(casePayload.steps) || casePayload.steps.length === 0 || !Array.isArray(casePayload.assertions) || casePayload.assertions.length === 0) {
    throw new Error("invalid fixed case");
  }
  casePayload.steps.forEach(validateFixedStep);
  casePayload.assertions.forEach(validateFixedAssertion);
}

function validateFixedStep(step) {
  if (!step || typeof step !== "object" || Object.keys(step).length !== 1) {
    throw new Error("invalid fixed case");
  }
  const action = Object.keys(step)[0];
  const payload = step[action];
  if (action === "navigate_back") {
    if (!payload || typeof payload !== "object" || Object.keys(payload).length !== 0) {
      throw new Error("invalid fixed case");
    }
    return;
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("invalid fixed case");
  }
  if (action === "navigate") {
    if (hasUnknownKeys(payload, ["path"]) || !isRelativeFixedPath(payload.path)) {
      throw new Error("invalid fixed case");
    }
    return;
  }
  if (action === "click" || action === "wait_for") {
    if (hasUnknownKeys(payload, ["locator"])) {
      throw new Error("invalid fixed case");
    }
    validateFixedLocator(payload.locator);
    return;
  }
  if (action === "fill" || action === "select") {
    if (hasUnknownKeys(payload, ["locator", "value"]) || !isFixedString(payload.value)) {
      throw new Error("invalid fixed case");
    }
    validateFixedLocator(payload.locator);
    return;
  }
  throw new Error("invalid fixed case");
}

function validateFixedLocator(locator) {
  if (!locator || typeof locator !== "object") {
    throw new Error("invalid fixed case");
  }
  if (locator.by === "role") {
    if (hasUnknownKeys(locator, ["by", "role", "name"]) || !isFixedString(locator.role) || !isFixedString(locator.name)) {
      throw new Error("invalid fixed case");
    }
    return;
  }
  if (locator.by === "label") {
    if (hasUnknownKeys(locator, ["by", "label"]) || !isFixedString(locator.label)) {
      throw new Error("invalid fixed case");
    }
    return;
  }
  if (locator.by === "text") {
    if (hasUnknownKeys(locator, ["by", "text"]) || !isFixedString(locator.text)) {
      throw new Error("invalid fixed case");
    }
    return;
  }
  if (locator.by === "test_id") {
    if (hasUnknownKeys(locator, ["by", "test_id"]) || !isFixedString(locator.test_id)) {
      throw new Error("invalid fixed case");
    }
    return;
  }
  throw new Error("invalid fixed case");
}

function validateFixedAssertion(assertion) {
  if (!assertion || typeof assertion !== "object" || Object.keys(assertion).length !== 1) {
    throw new Error("invalid fixed case");
  }
  const name = Object.keys(assertion)[0];
  const value = assertion[name];
  if (name === "page_status_not") {
    if (!Number.isInteger(value) || value < 100 || value > 599) {
      throw new Error("invalid fixed case");
    }
    return;
  }
  if (name === "url_not_contains") {
    if (!isFixedString(value)) {
      throw new Error("invalid fixed case");
    }
    return;
  }
  throw new Error("invalid fixed case");
}

function fixedCaseLocator(page, locator) {
  if (locator.by === "role") {
    return page.getByRole(locator.role, { name: locator.name, exact: true });
  }
  if (locator.by === "label") {
    return page.getByLabel(locator.label, { exact: true });
  }
  if (locator.by === "text") {
    return page.getByText(locator.text, { exact: true });
  }
  if (locator.by === "test_id") {
    return page.getByTestId(locator.test_id);
  }
  throw new Error("invalid fixed case locator");
}

function attachFixedCaseDocumentStatusTracker(page) {
  let status = null;
  const handler = (response) => {
    if (isMainDocumentResponse(page, response)) {
      const nextStatus = typeof response.status === "function" ? response.status() : null;
      if (typeof nextStatus === "number") {
        status = nextStatus;
      }
    }
  };
  if (page && typeof page.on === "function") {
    page.on("response", handler);
  }
  return {
    get() {
      return status;
    },
    set(nextStatus) {
      if (typeof nextStatus === "number") {
        status = nextStatus;
      }
    },
    stop() {
      if (page && typeof page.off === "function") {
        page.off("response", handler);
      } else if (page && typeof page.removeListener === "function") {
        page.removeListener("response", handler);
      }
    },
  };
}

function isMainDocumentResponse(page, response) {
  try {
    const request = typeof response?.request === "function" ? response.request() : null;
    if (!request || typeof request.resourceType !== "function" || request.resourceType() !== "document") {
      return false;
    }
    if (typeof page?.mainFrame === "function" && typeof response.frame === "function") {
      return response.frame() === page.mainFrame();
    }
    return true;
  } catch (_error) {
    return false;
  }
}

function fixedCaseUrl(origin, pathValue) {
  return new URL(pathValue, START_ORIGIN_URLS[origin]).href;
}

function isRelativeFixedPath(value) {
  if (!isFixedString(value) || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("?") || value.includes("#")) {
    return false;
  }
  try {
    const parsed = new URL(value, "https://relative.invalid");
    return parsed.origin === "https://relative.invalid" && parsed.pathname === value;
  } catch (_error) {
    return false;
  }
}

function isFixedString(value) {
  return typeof value === "string" && /^[^\x00-\x1f\x7f]{1,256}$/.test(value);
}

function hasUnknownKeys(value, allowed) {
  const allowedSet = allowed instanceof Set ? allowed : new Set(allowed);
  return Object.keys(value).some((key) => !allowedSet.has(key));
}

function hasExactKeys(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const allowedSet = allowed instanceof Set ? allowed : new Set(allowed);
  const keys = Object.keys(value);
  return keys.length === allowedSet.size && keys.every((key) => allowedSet.has(key));
}

function createSafeFixedEvidenceDir(root, caseId, attemptId) {
  const caseDir = createSafeFixedEvidenceChild(root, root, caseId, { exclusive: false });
  return createSafeFixedEvidenceChild(root, caseDir, attemptId, { exclusive: true });
}

function createSafeFixedEvidenceChild(root, parent, childName, { exclusive }) {
  const target = path.join(parent, childName);
  if (!isPathInside(root, target)) {
    throw new Error("invalid fixed case");
  }
  try {
    fs.mkdirSync(target, { mode: 0o700 });
  } catch (error) {
    if (error.code !== "EEXIST" || exclusive) {
      throw new Error("invalid fixed case");
    }
  }
  const existing = fs.lstatSync(target);
  if (existing.isSymbolicLink() || !existing.isDirectory()) {
    throw new Error("invalid fixed case");
  }
  const realTarget = fs.realpathSync(target);
  if (!isPathInside(root, realTarget)) {
    throw new Error("invalid fixed case");
  }
  return realTarget;
}

function isPathInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function isPrivateEvidenceUri(value) {
  if (!isFixedString(value)) {
    return false;
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_error) {
    return false;
  }
  return parsed.protocol === "gs:" && Boolean(parsed.hostname) && !parsed.search && !parsed.hash && !value.includes("@");
}

async function defaultConnectOverCDP(endpoint) {
  const { chromium } = require("playwright-core");
  return chromium.connectOverCDP(endpoint);
}

function validateDocsUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_error) {
    throw new Error("docs url blocked");
  }
  if (parsed.protocol !== "https:" || parsed.origin !== "https://docs.flatkey.ai" || parsed.username || parsed.password) {
    throw new Error("docs url blocked");
  }
  return parsed;
}

function isAllowedDocsRequest(value, method) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_error) {
    return false;
  }
  return parsed.protocol === "https:" && parsed.origin === "https://docs.flatkey.ai" && (method === "GET" || method === "HEAD");
}

function stripSensitiveRequestHeaders(headers = {}) {
  const cleaned = {};
  for (const [key, value] of Object.entries(headers || {})) {
    const lower = key.toLowerCase();
    if (lower === "cookie" || lower === "authorization" || lower === "proxy-authorization") {
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

function textFromHtml(html) {
  if (typeof html !== "string") {
    return "";
  }
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60000);
}

function redactText(value, sensitiveValues = []) {
  if (typeof value !== "string") {
    return value;
  }
  let redacted = value.replace(API_KEY_PATTERN, "[REDACTED_API_KEY]").replace(/\b\d{6}\b/g, "[REDACTED_CODE]");
  for (const secret of sensitiveValues) {
    if (typeof secret === "string" && secret.length > 0) {
      redacted = redacted.split(secret).join("[REDACTED_SECRET]");
    }
  }
  return redacted;
}

module.exports = {
  BrowserEvidenceSession,
  buildMask,
  captureScreenshot,
  projectConsoleEvent,
  projectNetworkEvent,
  runProtocol,
  safeScreenshotPath,
  stripSensitiveRequestHeaders,
  validateDocsUrl,
};

if (require.main === module) {
  runProtocol().catch(() => process.exit(1));
}
