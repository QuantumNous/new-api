const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Readable, Writable } = require("node:stream");
const test = require("node:test");
const helper = require("./browser_evidence_helper.cjs");

test("fixed case runner maps deterministic actions locators assertions and protocol result", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-success-"));
  const calls = [];
  const page = fakeFixedCasePage(calls, {
    url: "https://staging-console.flatkey.ai/settings",
    gotoStatus: 200,
    goBackStatus: 204,
  });
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  session.page = page;

  const result = await session.executeFixedCase({
    case: fixedCase({
      steps: [
        { navigate: { path: "/login" } },
        { click: { locator: { by: "role", role: "button", name: "Sign in" } } },
        { fill: { locator: { by: "label", label: "Email" }, value: "owner@example.com" } },
        { select: { locator: { by: "test_id", test_id: "plan-select" }, value: "pro" } },
        { wait_for: { locator: { by: "text", text: "Dashboard" } } },
        { navigate_back: {} },
      ],
      assertions: [
        { page_status_not: 404 },
        { url_not_contains: "/404" },
      ],
    }),
    attempt: { id: "attempt-001" },
    evidenceDir: runtime,
  });

  assert.equal(result.status, "passed");
  assert.equal(result.case_id, "FQA-9001");
  assert.equal(result.attempt_id, "attempt-001");
  assert.equal(result.evidence_dir, "FQA-9001/attempt-001");
  assert.deepEqual(result.failure, null);
  assert.deepEqual(calls, [
    ["goto", "https://staging-console.flatkey.ai/start", { waitUntil: "domcontentloaded", timeout: 30000 }],
    ["goto", "https://staging-console.flatkey.ai/login", { waitUntil: "domcontentloaded", timeout: 30000 }],
    ["getByRole", "button", { name: "Sign in", exact: true }],
    ["click", "role:button:Sign in"],
    ["getByLabel", "Email", { exact: true }],
    ["fill", "label:Email", "owner@example.com"],
    ["getByTestId", "plan-select"],
    ["selectOption", "test_id:plan-select", "pro"],
    ["getByText", "Dashboard", { exact: true }],
    ["waitFor", "text:Dashboard", { state: "visible", timeout: 30000 }],
    ["goBack", { waitUntil: "domcontentloaded", timeout: 30000 }],
  ]);
  assert.ok(fs.statSync(path.join(runtime, "FQA-9001", "attempt-001")).isDirectory());
});

test("fixed case runner returns structured failure with evidence without masking original failure", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-failure-"));
  const calls = [];
  const page = fakeFixedCasePage(calls, {
    locatorFailures: { "role:button:Missing": new Error("playwright locator failed with secret") },
    screenshotFailure: new Error("screenshot unavailable"),
  });
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  session.page = page;
  session.console.push({ type: "error", text: "console before failure" });
  session.network.push({ url: "https://staging-console.flatkey.ai/api", method: "GET", status: 500 });

  const result = await session.executeFixedCase({
    case: fixedCase({
      steps: [{ click: { locator: { by: "role", role: "button", name: "Missing" } } }],
      assertions: [{ url_not_contains: "/404" }],
    }),
    attempt: { id: "attempt-failed" },
    evidenceDir: runtime,
  });

  assert.equal(result.status, "failed");
  assert.equal(result.failure.phase, "step");
  assert.equal(result.failure.index, 0);
  assert.equal(result.failure.code, "step_failed");
  assert.equal(result.failure.evidence.screenshot_error, "capture_failed");
  assert.equal(result.failure.evidence.console.length, 1);
  assert.equal(result.failure.evidence.network.length, 1);
  assert.ok(!JSON.stringify(result).includes("playwright locator failed with secret"));
});

test("fixed case assertion failure captures screenshot console and network evidence", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-assertion-evidence-"));
  const page = fakeFixedCasePage([], { url: "https://staging-console.flatkey.ai/404" });
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  session.page = page;
  session.console.push({ type: "error", text: "assertion console" });
  session.network.push({ url: "https://staging-console.flatkey.ai/page", method: "GET", status: 404 });

  const result = await session.executeFixedCase({
    case: fixedCase({
      start: { origin: "staging_console", path: "/404" },
      assertions: [{ url_not_contains: "/404" }],
    }),
    attempt: { id: "attempt-assertion" },
    evidenceDir: runtime,
  });

  assert.equal(result.status, "failed");
  assert.equal(result.failure.phase, "assertion");
  assert.equal(result.failure.evidence.screenshot, "screenshots/failure.png");
  assert.equal(result.failure.evidence.console.length, 1);
  assert.equal(result.failure.evidence.network.length, 1);
  assert.ok(fs.existsSync(path.join(runtime, "FQA-9001", "attempt-assertion", "screenshots", "failure.png")));
});

test("fixed case failure evidence honors evidence capture flags", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-flags-"));
  const page = fakeFixedCasePage([], { locatorFailures: { "text:Sign in": new Error("missing") } });
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  session.page = page;
  session.console.push({ type: "error", text: "hidden console" });
  session.network.push({ url: "https://staging-console.flatkey.ai/api", method: "GET", status: 500 });

  const result = await session.executeFixedCase({
    case: fixedCase({
      evidence: { screenshot_on_failure: false, capture_console: true, capture_network: false },
    }),
    attempt: { id: "attempt-flags" },
    evidenceDir: runtime,
  });

  assert.equal(result.status, "failed");
  assert.equal(Object.prototype.hasOwnProperty.call(result.failure.evidence, "screenshot"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.failure.evidence, "screenshot_error"), false);
  assert.equal(result.failure.evidence.console.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(result.failure.evidence, "network"), false);
  assert.equal(fs.existsSync(path.join(runtime, "FQA-9001", "attempt-flags", "screenshots")), false);
});

test("fixed case runner fails closed for unsupported input and path traversal", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-closed-"));
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  session.page = fakeFixedCasePage([]);

  const badCases = [
    fixedCase({ extra: "bad" }),
    fixedCase({ evidence: { screenshot_on_failure: true, capture_console: true, capture_network: true, extra: "bad" } }),
    fixedCase({ steps: [{ evaluate: { source: "document.body" } }] }),
    fixedCase({ steps: [{ script: { command: "click" } }] }),
    fixedCase({ steps: [{ hover: { locator: { by: "text", text: "X" } } }] }),
    fixedCase({ steps: [{ click: { locator: { by: "css", value: ".x" } } }] }),
    fixedCase({ steps: [{ click: { locator: { by: "xpath", value: "//button" } } }] }),
    fixedCase({ start: { origin: "staging_console", path: "https://example.test/" } }),
  ];
  for (const item of badCases) {
    await assert.rejects(
      () => session.executeFixedCase({ case: item, attempt: { id: "attempt-001" }, evidenceDir: runtime }),
      /invalid fixed case/,
    );
  }
  await assert.rejects(
    () => session.executeFixedCase({ case: fixedCase({ id: "../bad" }), attempt: { id: "attempt-001" }, evidenceDir: runtime }),
    /invalid fixed case/,
  );
  await assert.rejects(
    () => session.executeFixedCase({ case: fixedCase(), attempt: { id: "../bad" }, evidenceDir: runtime }),
    /invalid fixed case/,
  );
  await assert.rejects(
    () => session.executeFixedCase({ case: fixedCase(), attempt: { id: "attempt-001" }, evidenceDir: runtime, extra: "bad" }),
    /invalid fixed case/,
  );
});

test("fixed case runner mirrors Python fixed case contract for key invalid cases", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-contract-"));
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  session.page = fakeFixedCasePage([]);
  const invalidCases = [
    mutateFixedCase((item) => { delete item.owner; }),
    mutateFixedCase((item) => { item.schema_version = 2; }),
    mutateFixedCase((item) => { item.id = "BAD-9001"; }),
    mutateFixedCase((item) => { item.kind = "unknown"; }),
    mutateFixedCase((item) => { item.enabled = "false"; }),
    mutateFixedCase((item) => { item.severity = "urgent"; }),
    mutateFixedCase((item) => { item.owner = "security"; }),
    mutateFixedCase((item) => { item.fixture = "admin"; }),
    mutateFixedCase((item) => { item.cleanup = "maybe"; }),
    mutateFixedCase((item) => { item.evidence.capture_network = "true"; }),
    mutateFixedCase((item) => { delete item.source.evidence_uri; }),
    mutateFixedCase((item) => { item.source.evidence_uri = "https://example.test/evidence"; }),
    mutateFixedCase((item) => { item.promotion.attempts_required = 2; }),
    mutateFixedCase((item) => {
      item.enabled = true;
      item.promotion.state = "candidate_draft";
      item.promotion.attempts_passed = 0;
    }),
  ];

  for (const item of invalidCases) {
    await assert.rejects(
      () => session.executeFixedCase({ case: item, attempt: { id: `attempt-${invalidCases.indexOf(item)}` }, evidenceDir: runtime }),
      /invalid fixed case/,
    );
  }
});

test("fixed case runner rejects symlinked evidence paths before writing failure evidence", async (t) => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-link-root-"));
  const escaped = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-link-escaped-"));
  const link = path.join(runtime, "FQA-9001");
  try {
    fs.symlinkSync(escaped, link, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (error.code === "EPERM" || error.code === "EACCES" || error.code === "ENOTSUP") {
      t.skip(`symlink creation unavailable: ${error.code}`);
      return;
    }
    throw error;
  }
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  session.page = fakeFixedCasePage([], { url: "https://staging-console.flatkey.ai/404" });

  await assert.rejects(
    () => session.executeFixedCase({
      case: fixedCase({ start: { origin: "staging_console", path: "/404" } }),
      attempt: { id: "attempt-link" },
      evidenceDir: runtime,
    }),
    /invalid fixed case/,
  );
  assert.equal(fs.existsSync(path.join(escaped, "attempt-link")), false);
});

test("fixed case runner creates attempt evidence directory exclusively", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-exclusive-"));
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  session.page = fakeFixedCasePage([]);

  const first = await session.executeFixedCase({
    case: fixedCase(),
    attempt: { id: "attempt-once" },
    evidenceDir: runtime,
  });
  assert.equal(first.status, "passed");
  await assert.rejects(
    () => session.executeFixedCase({ case: fixedCase(), attempt: { id: "attempt-once" }, evidenceDir: runtime }),
    /invalid fixed case/,
  );
  assert.deepEqual(fs.readdirSync(path.join(runtime, "FQA-9001")).sort(), ["attempt-once"]);
});

test("fixed case runner allows only one concurrent execution for an attempt id", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-concurrent-"));
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  session.page = fakeFixedCasePage([]);

  const results = await Promise.allSettled([
    session.executeFixedCase({ case: fixedCase(), attempt: { id: "attempt-race" }, evidenceDir: runtime }),
    session.executeFixedCase({ case: fixedCase(), attempt: { id: "attempt-race" }, evidenceDir: runtime }),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.deepEqual(fs.readdirSync(path.join(runtime, "FQA-9001")).sort(), ["attempt-race"]);
});

test("fixed case page_status_not tracks latest main document click navigation only", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-status-"));
  const navigationPage = fakeFixedCasePage([], { clickMainDocumentStatus: 404 });
  const navigationSession = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  navigationSession.page = navigationPage;

  const failed = await navigationSession.executeFixedCase({
    case: fixedCase({
      steps: [{ click: { locator: { by: "text", text: "Sign in" } } }],
      assertions: [{ page_status_not: 404 }],
    }),
    attempt: { id: "attempt-nav-404" },
    evidenceDir: runtime,
  });
  assert.equal(failed.status, "failed");
  assert.equal(failed.failure.phase, "assertion");

  const apiPage = fakeFixedCasePage([], { clickApiStatus: 404 });
  const apiSession = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  apiSession.page = apiPage;

  const passed = await apiSession.executeFixedCase({
    case: fixedCase({
      steps: [{ click: { locator: { by: "text", text: "Sign in" } } }],
      assertions: [{ page_status_not: 404 }],
    }),
    attempt: { id: "attempt-api-404" },
    evidenceDir: runtime,
  });
  assert.equal(passed.status, "passed");
});

test("fixed case UI assertions pass through semantic locator state", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-ui-pass-"));
  const calls = [];
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  session.page = fakeFixedCasePage(calls, {
    locatorStates: {
      "text:Ready": { visible: true },
      "text:Spinner": { visible: false },
      "role:button:Continue": { enabled: true, disabled: false },
      "test_id:submit": { enabled: false, disabled: true },
      "label:Email": { value: "owner@example.test" },
      "text:API key": { count: 0 },
    },
  });

  const result = await session.executeFixedCase({
    case: fixedCase({
      assertions: [
        { element_visible: { locator: { by: "text", text: "Ready" } } },
        { element_hidden: { locator: { by: "text", text: "Spinner" } } },
        { element_enabled: { locator: { by: "role", role: "button", name: "Continue" } } },
        { element_disabled: { locator: { by: "test_id", test_id: "submit" } } },
        { element_value_equals: { locator: { by: "label", label: "Email" }, value: "owner@example.test" } },
        { element_count_equals: { locator: { by: "text", text: "API key" }, count: 0 } },
      ],
    }),
    attempt: { id: "attempt-ui-pass" },
    evidenceDir: runtime,
  });

  assert.equal(result.status, "passed");
  assert.ok(calls.some((call) => call[0] === "isVisible" && call[1] === "text:Ready"));
  assert.ok(calls.some((call) => call[0] === "isEnabled" && call[1] === "role:button:Continue"));
  assert.ok(calls.some((call) => call[0] === "isDisabled" && call[1] === "test_id:submit"));
  assert.ok(calls.some((call) => call[0] === "inputValue" && call[1] === "label:Email"));
  assert.ok(calls.some((call) => call[0] === "count" && call[1] === "text:API key"));
});

test("fixed case element_count_equals accepts and executes upper bound count", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-ui-count-upper-"));
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  session.page = fakeFixedCasePage([], {
    locatorStates: {
      "text:Audit row": { count: 1000 },
    },
  });

  const result = await session.executeFixedCase({
    case: fixedCase({
      assertions: [{ element_count_equals: { locator: { by: "text", text: "Audit row" }, count: 1000 } }],
    }),
    attempt: { id: "attempt-ui-count-upper" },
    evidenceDir: runtime,
  });

  assert.equal(result.status, "passed");
});

test("fixed case UI assertions fail closed on mismatched state and browser errors", async () => {
  const cases = [
    ["visible false", { element_visible: { locator: { by: "text", text: "Missing" } } }, { "text:Missing": { visible: false } }],
    ["hidden visible", { element_hidden: { locator: { by: "text", text: "Visible" } } }, { "text:Visible": { visible: true } }],
    ["enabled false", { element_enabled: { locator: { by: "text", text: "Disabled" } } }, { "text:Disabled": { enabled: false } }],
    ["disabled false", { element_disabled: { locator: { by: "text", text: "Enabled" } } }, { "text:Enabled": { disabled: false } }],
    ["value mismatch", { element_value_equals: { locator: { by: "label", label: "Email" }, value: "expected@example.test" } }, { "label:Email": { value: "actual@example.test" } }],
    ["count mismatch", { element_count_equals: { locator: { by: "text", text: "API key" }, count: 1 } }, { "text:API key": { count: 0 } }],
    ["browser error", { element_visible: { locator: { by: "text", text: "Explodes" } } }, { "text:Explodes": { visibleError: new Error("playwright failed with secret") } }],
  ];

  for (const [name, assertion, locatorStates] of cases) {
    const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-ui-fail-"));
    const session = new helper.BrowserEvidenceSession({
      browser: { contexts: () => [] },
      runtimeDir: runtime,
      sensitiveValues: [],
    });
    session.page = fakeFixedCasePage([], { locatorStates });

    const result = await session.executeFixedCase({
      case: fixedCase({ assertions: [assertion] }),
      attempt: { id: `attempt-${name.replaceAll(" ", "-")}` },
      evidenceDir: runtime,
    });

    assert.equal(result.status, "failed", name);
    assert.equal(result.failure.phase, "assertion", name);
    assert.equal(result.failure.code, "assertion_failed", name);
    assert.ok(!JSON.stringify(result).includes("playwright failed with secret"), name);
  }
});

test("fixed case runner rejects invalid UI assertion shapes", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-ui-invalid-"));
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  session.page = fakeFixedCasePage([]);

  const invalidAssertions = [
    { element_visible: { locator: { by: "text", text: "Ready" }, extra: "bad" } },
    { element_hidden: {} },
    { element_enabled: { locator: { by: "css", value: ".ready" } } },
    { element_disabled: { locator: { by: "text", text: "" } } },
    { element_value_equals: { locator: { by: "label", label: "Email" } } },
    { element_count_equals: { locator: { by: "text", text: "API key" }, count: true } },
    { element_count_equals: { locator: { by: "text", text: "API key" }, count: -1 } },
    { element_count_equals: { locator: { by: "text", text: "API key" }, count: 1001 } },
  ];

  for (const assertion of invalidAssertions) {
    await assert.rejects(
      () => session.executeFixedCase({
        case: fixedCase({ assertions: [assertion] }),
        attempt: { id: `attempt-${invalidAssertions.indexOf(assertion)}` },
        evidenceDir: runtime,
      }),
      /invalid fixed case/,
    );
  }
});

test("fixed case network assertions observe only requests after capture for the case origin", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-network-sent-"));
  const calls = [];
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
    fixedCaseSleep: async () => {},
  });
  session.page = fakeFixedCasePage(calls, {
    clickRequestsByClick: [
      [{ url: "https://staging-console.flatkey.ai/api/before-capture?token=secret", method: "GET" }],
      [
        { url: "https://other.example/api/register", method: "POST" },
        { url: "https://staging-console.flatkey.ai/api/register?token=query-secret", method: "POST" },
      ],
    ],
  });

  const result = await session.executeFixedCase({
    case: fixedCase({
      steps: [
        { click: { locator: { by: "text", text: "Sign in" } } },
        { begin_network_capture: {} },
        { click: { locator: { by: "text", text: "Sign in" } } },
      ],
      assertions: [
        { network_request_not_sent: { method: "GET", path: "/api/before-capture", timeout_ms: 0 } },
        { network_request_not_sent: { method: "POST", path: "/api/register", timeout_ms: 0 } },
      ],
    }),
    attempt: { id: "attempt-network-sent" },
    evidenceDir: runtime,
  });

  assert.equal(result.status, "failed");
  assert.equal(result.failure.phase, "assertion");
  assert.equal(result.failure.index, 1);
  assert.equal(result.failure.assertion, "network_request_not_sent");
  assert.equal(session.page.listenerCount("request"), 0);
  assert.ok(!JSON.stringify(result).includes("query-secret"));
});

test("fixed case network_request_sent succeeds on method and pathname or fails after timeout", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-network-sent-timeout-"));
  const sleeps = [];
  const successSession = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
    fixedCaseSleep: async (ms) => sleeps.push(ms),
  });
  successSession.page = fakeFixedCasePage([], {
    clickRequests: [{ url: "https://staging-console.flatkey.ai/api/register?secret=query", method: "POST" }],
  });

  const passed = await successSession.executeFixedCase({
    case: fixedCase({
      steps: [{ begin_network_capture: {} }, { click: { locator: { by: "text", text: "Sign in" } } }],
      assertions: [{ network_request_sent: { method: "POST", path: "/api/register", timeout_ms: 25 } }],
    }),
    attempt: { id: "attempt-network-sent-ok" },
    evidenceDir: runtime,
  });
  assert.equal(passed.status, "passed");
  assert.equal(sleeps.length, 0);

  const timeoutSession = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
    fixedCaseSleep: async (ms) => sleeps.push(ms),
  });
  timeoutSession.page = fakeFixedCasePage([]);
  const failed = await timeoutSession.executeFixedCase({
    case: fixedCase({
      steps: [{ begin_network_capture: {} }],
      assertions: [{ network_request_sent: { method: "GET", path: "/api/missing", timeout_ms: 25 } }],
    }),
    attempt: { id: "attempt-network-sent-timeout" },
    evidenceDir: runtime,
  });

  assert.equal(failed.status, "failed");
  assert.equal(failed.failure.phase, "assertion");
  assert.deepEqual(sleeps, [25]);
});

test("fixed case network assertion accepts timeout upper bound without real wait", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-network-timeout-upper-"));
  const sleeps = [];
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
    fixedCaseSleep: async (ms) => sleeps.push(ms),
  });
  session.page = fakeFixedCasePage([]);

  const result = await session.executeFixedCase({
    case: fixedCase({
      steps: [{ begin_network_capture: {} }],
      assertions: [{ network_request_not_sent: { method: "GET", path: "/api/missing", timeout_ms: 5000 } }],
    }),
    attempt: { id: "attempt-network-timeout-upper" },
    evidenceDir: runtime,
  });

  assert.equal(result.status, "passed");
  assert.deepEqual(sleeps, [5000]);
});

test("fixed case network_request_not_sent waits full timeout and fails immediately on match", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-network-not-sent-"));
  const sleeps = [];
  const successSession = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
    fixedCaseSleep: async (ms) => sleeps.push(ms),
  });
  successSession.page = fakeFixedCasePage([], {
    clickRequests: [{ url: "https://staging-console.flatkey.ai/api/other", method: "GET" }],
  });

  const passed = await successSession.executeFixedCase({
    case: fixedCase({
      steps: [{ begin_network_capture: {} }, { click: { locator: { by: "text", text: "Sign in" } } }],
      assertions: [{ network_request_not_sent: { method: "GET", path: "/api/missing", timeout_ms: 50 } }],
    }),
    attempt: { id: "attempt-network-not-sent-ok" },
    evidenceDir: runtime,
  });
  assert.equal(passed.status, "passed");
  assert.deepEqual(sleeps, [50]);

  const failSleeps = [];
  const failSession = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
    fixedCaseSleep: async (ms) => failSleeps.push(ms),
  });
  failSession.page = fakeFixedCasePage([], {
    clickRequests: [{ url: "https://staging-console.flatkey.ai/api/register", method: "DELETE" }],
  });
  const failed = await failSession.executeFixedCase({
    case: fixedCase({
      steps: [{ begin_network_capture: {} }, { click: { locator: { by: "text", text: "Sign in" } } }],
      assertions: [{ network_request_not_sent: { method: "DELETE", path: "/api/register", timeout_ms: 50 } }],
    }),
    attempt: { id: "attempt-network-not-sent-fail" },
    evidenceDir: runtime,
  });

  assert.equal(failed.status, "failed");
  assert.equal(failed.failure.phase, "assertion");
  assert.deepEqual(failSleeps, []);
});

test("fixed case network tracker fails closed and listener cleanup works on success and failure", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-network-cleanup-"));
  const trackerErrorSession = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
    fixedCaseSleep: async () => {},
  });
  trackerErrorSession.page = fakeFixedCasePage([], {
    clickRequests: [{ url: () => { throw new Error("url getter failed with secret"); }, method: "GET" }],
  });
  const trackerFailed = await trackerErrorSession.executeFixedCase({
    case: fixedCase({
      steps: [{ begin_network_capture: {} }, { click: { locator: { by: "text", text: "Sign in" } } }],
      assertions: [{ network_request_not_sent: { method: "GET", path: "/api/missing", timeout_ms: 0 } }],
    }),
    attempt: { id: "attempt-network-tracker-error" },
    evidenceDir: runtime,
  });
  assert.equal(trackerFailed.status, "failed");
  assert.equal(trackerFailed.failure.phase, "assertion");
  assert.equal(trackerErrorSession.page.listenerCount("request"), 0);
  assert.ok(!JSON.stringify(trackerFailed).includes("url getter failed with secret"));

  const successSession = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
    fixedCaseSleep: async () => {},
  });
  successSession.page = fakeFixedCasePage([]);
  const success = await successSession.executeFixedCase({
    case: fixedCase({ steps: [{ begin_network_capture: {} }] }),
    attempt: { id: "attempt-network-cleanup-success" },
    evidenceDir: runtime,
  });
  assert.equal(success.status, "passed");
  assert.equal(successSession.page.listenerCount("request"), 0);
});

test("fixed case network capture is isolated between consecutive cases", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-network-isolation-"));
  const page = fakeFixedCasePage([], {
    clickRequests: [{ url: "https://staging-console.flatkey.ai/api/register", method: "POST" }],
  });
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
    fixedCaseSleep: async () => {},
  });
  session.page = page;

  const first = await session.executeFixedCase({
    case: fixedCase({
      steps: [{ begin_network_capture: {} }, { click: { locator: { by: "text", text: "Sign in" } } }],
      assertions: [{ network_request_sent: { method: "POST", path: "/api/register", timeout_ms: 0 } }],
    }),
    attempt: { id: "attempt-network-isolation-first" },
    evidenceDir: runtime,
  });
  assert.equal(first.status, "passed");

  const second = await session.executeFixedCase({
    case: fixedCase({
      steps: [{ begin_network_capture: {} }],
      assertions: [{ network_request_not_sent: { method: "POST", path: "/api/register", timeout_ms: 0 } }],
    }),
    attempt: { id: "attempt-network-isolation-second" },
    evidenceDir: runtime,
  });
  assert.equal(second.status, "passed");
});

test("fixed case runner rejects invalid network assertion and capture shapes", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-network-invalid-"));
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  session.page = fakeFixedCasePage([]);

  const invalidCases = [
    fixedCase({ steps: [{ begin_network_capture: { extra: "bad" } }] }),
    fixedCase({ steps: [{ begin_network_capture: {} }, { begin_network_capture: {} }] }),
    fixedCase({ assertions: [{ network_request_sent: { method: "GET", path: "/api/register", timeout_ms: 0 } }] }),
    fixedCase({
      steps: [{ begin_network_capture: {} }],
      assertions: [{ network_request_sent: { method: "OPTIONS", path: "/api/register", timeout_ms: 0 } }],
    }),
    fixedCase({
      steps: [{ begin_network_capture: {} }],
      assertions: [{ network_request_sent: { method: "GET", path: "https://example.test/api", timeout_ms: 0 } }],
    }),
    fixedCase({
      steps: [{ begin_network_capture: {} }],
      assertions: [{ network_request_sent: { method: "GET", path: "/api/register?secret=query", timeout_ms: 0 } }],
    }),
    fixedCase({
      steps: [{ begin_network_capture: {} }],
      assertions: [{ network_request_not_sent: { method: "GET", path: "/api/register#secret", timeout_ms: 0 } }],
    }),
    fixedCase({
      steps: [{ begin_network_capture: {} }],
      assertions: [{ network_request_not_sent: { method: "GET", path: "/api\\register", timeout_ms: 0 } }],
    }),
    fixedCase({
      steps: [{ begin_network_capture: {} }],
      assertions: [{ network_request_not_sent: { method: "GET", path: "/api/register", timeout_ms: true } }],
    }),
    fixedCase({
      steps: [{ begin_network_capture: {} }],
      assertions: [{ network_request_not_sent: { method: "GET", path: "/api/register", timeout_ms: 5001 } }],
    }),
  ];

  for (const item of invalidCases) {
    await assert.rejects(
      () => session.executeFixedCase({
        case: item,
        attempt: { id: `attempt-network-invalid-${invalidCases.indexOf(item)}` },
        evidenceDir: runtime,
      }),
      /invalid fixed case/,
    );
  }
});

test("fixed case runner removes response tracker listeners after success and failure", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-listeners-"));
  const successPage = fakeFixedCasePage([]);
  const successSession = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  successSession.page = successPage;
  await successSession.executeFixedCase({ case: fixedCase(), attempt: { id: "attempt-listener-ok" }, evidenceDir: runtime });
  assert.equal(successPage.listenerCount("response"), 0);

  const failurePage = fakeFixedCasePage([], { locatorFailures: { "text:Sign in": new Error("missing") } });
  const failureSession = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  failureSession.page = failurePage;
  await failureSession.executeFixedCase({ case: fixedCase(), attempt: { id: "attempt-listener-fail" }, evidenceDir: runtime });
  assert.equal(failurePage.listenerCount("response"), 0);
});

test("fixed case runner fails closed on missing back navigation", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-unknown-status-"));
  const backPage = fakeFixedCasePage([], { goBackNull: true });
  const backSession = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  backSession.page = backPage;
  const backResult = await backSession.executeFixedCase({
    case: fixedCase({ steps: [{ navigate_back: {} }] }),
    attempt: { id: "attempt-back-null" },
    evidenceDir: runtime,
  });
  assert.equal(backResult.status, "failed");
  assert.equal(backResult.failure.phase, "step");
});

test("fixed case runner rejects array payloads for empty fixed-case steps", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-empty-step-array-"));
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  session.page = fakeFixedCasePage([]);

  for (const item of [
    fixedCase({ steps: [{ navigate_back: [] }] }),
    fixedCase({ steps: [{ begin_network_capture: [] }] }),
  ]) {
    await assert.rejects(
      () => session.executeFixedCase({
        case: item,
        attempt: { id: `attempt-empty-step-array-${item.steps[0].navigate_back ? "back" : "capture"}` },
        evidenceDir: runtime,
      }),
      /invalid fixed case/,
    );
  }
});

test("fixed case runner fails closed when start navigation has no page status", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-start-null-"));
  const page = fakeFixedCasePage([], { gotoStatus: null });
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  session.page = page;

  const result = await session.executeFixedCase({
    case: fixedCase({ assertions: [{ url_not_contains: "/404" }] }),
    attempt: { id: "attempt-start-null" },
    evidenceDir: runtime,
  });

  assert.equal(result.status, "failed");
  assert.equal(result.failure.phase, "start");
  assert.equal(result.failure.code, "navigation_failed");
});

test("fixed case runner fails closed when navigate step has no page status", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-navigate-null-"));
  const page = fakeFixedCasePage([], { gotoStatuses: [200, null] });
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: runtime,
    sensitiveValues: [],
  });
  session.page = page;

  const result = await session.executeFixedCase({
    case: fixedCase({
      steps: [{ navigate: { path: "/login" } }],
      assertions: [{ url_not_contains: "/404" }],
    }),
    attempt: { id: "attempt-navigate-null" },
    evidenceDir: runtime,
  });

  assert.equal(result.status, "failed");
  assert.equal(result.failure.phase, "step");
  assert.equal(result.failure.action, "navigate");
});

test("fixed case protocol keeps transport success separate from fixed case failure", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-case-protocol-"));
  const page = fakeFixedCasePage([], { url: "https://staging-console.flatkey.ai/404" });
  const response = await runProtocolRequests({
    connectOverCDP: async () => fakeStartedBrowser(page),
    requests: [
      {
        id: 1,
        command: "init",
        params: { cdpEndpoint: "http://127.0.0.1:9222", runtimeDir: runtime, sensitiveValues: [] },
      },
      {
        id: 2,
        command: "executeFixedCase",
        params: {
          case: fixedCase({
            start: { origin: "staging_console", path: "/404" },
            assertions: [{ url_not_contains: "/404" }],
          }),
          attempt: { id: "attempt-001" },
          evidenceDir: runtime,
        },
      },
    ],
  });

  assert.equal(response[1].id, 2);
  assert.equal(response[1].ok, true);
  assert.equal(response[1].result.status, "failed");
  assert.equal(response[1].result.failure.phase, "assertion");
});

test("protocol rejects unknown fixed case commands with bounded command_failed", async () => {
  const response = await runProtocolRequests({
    connectOverCDP: async () => {
      throw new Error("should not connect");
    },
    requests: [{ id: 9, command: "executeArbitraryScript", params: {} }],
  });

  assert.deepEqual(response, [{ id: 9, ok: false, error: "command_failed" }]);
});

test("captureScreenshot rejects paths and writes only masked screenshot buffer", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "browser-evidence-"));
  const calls = [];
  const page = {
    locator(selector) {
      return { selector };
    },
    getByText(text, options) {
      return { text, options };
    },
    async screenshot(options) {
      calls.push(options);
      assert.equal(Object.prototype.hasOwnProperty.call(options, "path"), false);
      assert.ok(Array.isArray(options.mask));
      assert.ok(options.mask.length >= 6);
      return Buffer.from("\x89PNG\r\n\x1a\nmasked", "binary");
    },
  };

  await assert.rejects(() => helper.captureScreenshot(page, runtime, "../bad", []), /invalid screenshot name/);
  await assert.rejects(() => helper.captureScreenshot(page, runtime, "bad.png", []), /invalid screenshot name/);
  await assert.rejects(() => helper.captureScreenshot(page, runtime, "bad\\name", []), /invalid screenshot name/);

  const result = await helper.captureScreenshot(page, runtime, "checkpoint", ["654321", "sk-12345678"]);
  assert.equal(result.path, "screenshots/checkpoint.png");
  assert.equal(calls.length, 1);
  const output = path.join(runtime, result.path);
  assert.ok(fs.readFileSync(output).includes(Buffer.from("masked")));
  await assert.rejects(() => helper.captureScreenshot(page, runtime, "checkpoint", []), /already exists/);
});

test("event projection drops network secrets and redacts console text", () => {
  const consoleEvent = helper.projectConsoleEvent({ type: "log", text: "code 654321 sk-12345678", args: ["secret"] });
  assert.deepEqual(consoleEvent, { type: "log", text: "code [REDACTED_CODE] [REDACTED_API_KEY]", location: undefined });

  const networkEvent = helper.projectNetworkEvent({
    url: "https://staging-console.flatkey.ai/api?token=secret",
    method: "POST",
    status: 200,
    timing: { startTime: 1 },
    headers: { cookie: "secret" },
    postData: "secret",
  });
  assert.deepEqual(Object.keys(networkEvent).sort(), ["method", "status", "timing", "url"]);
});

test("long lived helper masks known values, blocks service workers, buffers evidence, and closes browser", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "browser-evidence-session-"));
  const calls = [];
  const page = {
    locator(selector) {
      return { selector };
    },
    getByText(text, options) {
      calls.push(["mask-value", text, options]);
      return { text, options };
    },
    async screenshot(options) {
      calls.push(["screenshot", options]);
      return Buffer.from("\x89PNG\r\n\x1a\nmasked", "binary");
    },
  };
  const context = {
    pages() {
      return [page];
    },
    async addInitScript(source) {
      calls.push(["init-script", source]);
    },
    async routeWebSocket(pattern, handler) {
      calls.push(["routeWebSocket", pattern, handler]);
    },
    async newCDPSession(selectedPage) {
      calls.push(["cdp-session", selectedPage === page]);
      return {
        async send(method, params) {
          calls.push(["cdp-send", method, params]);
        },
      };
    },
    on(name, handler) {
      calls.push(["context-on", name]);
      if (name === "requestfinished") {
        handler({
          url: () => "https://staging-console.flatkey.ai/api?token=secret",
          method: () => "POST",
          response: async () => ({ status: () => 201 }),
          timing: () => ({ startTime: 2 }),
        });
      }
      if (name === "requestfailed") {
        handler({
          url: () => "https://staging-console.flatkey.ai/fail",
          method: () => "GET",
          failure: () => ({ errorText: "sk-12345678" }),
          timing: () => ({ startTime: 3 }),
        });
      }
    },
  };
  const browser = {
    contexts() {
      return [context];
    },
    async newBrowserCDPSession() {
      calls.push(["browser-cdp-session"]);
      return {
        async send(method, params) {
          calls.push(["browser-cdp-send", method, params]);
        },
      };
    },
    async close() {
      calls.push(["close"]);
    },
  };
  page.on = (name, handler) => {
    calls.push(["page-on", name]);
    if (name === "console") {
      handler({
        type: () => "log",
        text: () => "hello owner+alias@gmail.com 654321",
        location: () => ({ url: "https://staging-console.flatkey.ai", lineNumber: 1 }),
      });
    }
  };

  const session = new helper.BrowserEvidenceSession({
    browser,
    runtimeDir: runtime,
    sensitiveValues: ["owner+alias@gmail.com", "owner@gmail.com", "alias", "pw-secret", "654321"],
    maxEvents: 5,
  });
  await session.start();
  const shot = await session.captureScreenshot("checkpoint");
  const flushed = await session.flush();
  await session.stop();

  assert.equal(shot.path, "screenshots/checkpoint.png");
  assert.ok(calls.some((call) => call[0] === "init-script" && call[1].includes("serviceWorker")));
  assert.ok(calls.some((call) => call[0] === "cdp-send" && call[1] === "Network.setBypassServiceWorker" && call[2].bypass === true));
  assert.ok(calls.some((call) => call[0] === "mask-value" && call[1] === "owner+alias@gmail.com"));
  assert.ok(calls.some((call) => call[0] === "mask-value" && call[1] === "654321"));
  assert.equal(flushed.console.length, 1);
  assert.equal(flushed.network.length, 2);
  assert.ok(!JSON.stringify(flushed).includes("owner+alias@gmail.com"));
  assert.deepEqual(calls.at(-1), ["close"]);
});

test("long lived helper installs websocket and download denial before observing pages", async () => {
  const calls = [];
  const page = fakeScreenshotPage();
  const context = {
    pages() {
      calls.push(["pages"]);
      return [page];
    },
    async addInitScript() {
      calls.push(["init-script"]);
    },
    serviceWorkers() {
      return [];
    },
    async routeWebSocket(pattern, handler) {
      calls.push(["routeWebSocket", pattern, handler]);
    },
    async newCDPSession(selectedPage) {
      calls.push(["page-cdp", selectedPage === page]);
      return { send: async (method, params) => calls.push(["page-cdp-send", method, params]) };
    },
    on() {},
  };
  const browser = {
    contexts() {
      return [context];
    },
    async newBrowserCDPSession() {
      calls.push(["browser-cdp"]);
      return { send: async (method, params) => calls.push(["browser-cdp-send", method, params]) };
    },
  };
  const session = new helper.BrowserEvidenceSession({ browser, runtimeDir: os.tmpdir(), sensitiveValues: [] });

  await session.start();
  const wsHandler = calls.find((call) => call[0] === "routeWebSocket")[2];
  const sockets = [];
  await wsHandler({ close: async () => sockets.push("closed") });

  const pagesIndex = calls.findIndex((call) => call[0] === "pages");
  const wsIndex = calls.findIndex((call) => call[0] === "routeWebSocket");
  const downloadIndex = calls.findIndex((call) => call[0] === "browser-cdp-send" && call[1] === "Browser.setDownloadBehavior");
  assert.ok(wsIndex >= 0 && wsIndex < pagesIndex);
  assert.ok(downloadIndex >= 0 && downloadIndex < pagesIndex);
  assert.deepEqual(calls[downloadIndex][2], { behavior: "deny" });
  assert.deepEqual(sockets, ["closed"]);
});

test("long lived helper fails closed when websocket blocking cannot be applied", async () => {
  const context = fakeSecureStartContext();
  delete context.routeWebSocket;
  const browser = fakeSecureStartBrowser(context);
  const session = new helper.BrowserEvidenceSession({ browser, runtimeDir: os.tmpdir(), sensitiveValues: [] });
  await assert.rejects(() => session.start(), /websocket blocking unavailable/);
});

test("long lived helper fails closed when websocket blocking registration fails", async () => {
  const context = fakeSecureStartContext();
  context.routeWebSocket = async () => {
    throw new Error("route failed");
  };
  const browser = fakeSecureStartBrowser(context);
  const session = new helper.BrowserEvidenceSession({ browser, runtimeDir: os.tmpdir(), sensitiveValues: [] });
  await assert.rejects(() => session.start(), /websocket blocking unavailable/);
});

test("long lived helper fails closed when download denial cannot be applied", async () => {
  const context = fakeSecureStartContext();
  const browser = fakeSecureStartBrowser(context);
  delete browser.newBrowserCDPSession;
  const session = new helper.BrowserEvidenceSession({ browser, runtimeDir: os.tmpdir(), sensitiveValues: [] });
  await assert.rejects(() => session.start(), /download blocking unavailable/);
});

test("long lived helper fails closed when download denial command fails", async () => {
  const context = fakeSecureStartContext();
  const browser = fakeSecureStartBrowser(context);
  browser.newBrowserCDPSession = async () => ({
    send: async () => {
      throw new Error("cdp failed");
    },
  });
  const session = new helper.BrowserEvidenceSession({ browser, runtimeDir: os.tmpdir(), sensitiveValues: [] });
  await assert.rejects(() => session.start(), /download blocking unavailable/);
});

test("long lived helper requires parseable chrome-extension URLs for existing and event workers", async () => {
  const calls = [];
  const listeners = {};
  const page = fakeScreenshotPage();
  const context = {
    pages() {
      return [page];
    },
    async addInitScript(source) {
      calls.push(["init-script", source]);
    },
    serviceWorkers() {
      return [{ url: () => "chrome-extension://nkeimhogjdpnpccoofpliimaahmaaome/thunk.js" }];
    },
    async routeWebSocket() {},
    async newCDPSession(selectedPage) {
      calls.push(["page-cdp", selectedPage === page]);
      return {
        send: async (method, params) => calls.push(["page-cdp-send", method, params]),
      };
    },
    on(name, handler) {
      listeners[name] = handler;
    },
  };
  const browser = fakeSecureStartBrowser(context);
  const session = new helper.BrowserEvidenceSession({ browser, runtimeDir: os.tmpdir(), sensitiveValues: [] });

  await session.start();

  assert.ok(calls.some((call) => call[0] === "init-script" && call[1].includes("serviceWorker")));
  assert.ok(calls.some(
    (call) => call[0] === "page-cdp-send"
      && call[1] === "Network.setBypassServiceWorker"
      && call[2].bypass === true,
  ));
  assert.equal(typeof listeners.serviceworker, "function");
  assert.doesNotThrow(() => listeners.serviceworker({
    url: () => "chrome-extension://nkeimhogjdpnpccoofpliimaahmaaome/thunk.js",
  }));

  const blockedWorkers = [
    {},
    { url: () => "https://staging-console.flatkey.ai/sw.js" },
    { url: () => "chrome-extension:// host" },
    { url: () => { throw new Error("sensitive worker URL failure"); } },
  ];
  for (const worker of blockedWorkers) {
    assert.throws(() => listeners.serviceworker(worker), /service worker registration blocked/);

    const blockedContext = fakeSecureStartContext();
    blockedContext.serviceWorkers = () => [worker];
    const blockedSession = new helper.BrowserEvidenceSession({
      browser: fakeSecureStartBrowser(blockedContext),
      runtimeDir: os.tmpdir(),
      sensitiveValues: [],
    });
    await assert.rejects(() => blockedSession.start(), /service worker blocking unavailable/);
  }
});

test("long lived helper closes the service worker registration window during init script setup", async () => {
  const calls = [];
  const page = fakeScreenshotPage();
  const webWorker = { url: () => "https://staging-console.flatkey.ai/sw.js" };
  let serviceWorkerScans = 0;
  let serviceWorkerHandler;
  const context = fakeSecureStartContext(page);
  context.serviceWorkers = () => {
    serviceWorkerScans += 1;
    return serviceWorkerScans === 1 ? [] : [webWorker];
  };
  context.on = (name, handler) => {
    if (name === "serviceworker") {
      calls.push("serviceworker-listener");
      serviceWorkerHandler = handler;
    }
  };
  context.addInitScript = async () => {
    calls.push("init-script");
    assert.equal(typeof serviceWorkerHandler, "function");
  };
  const session = new helper.BrowserEvidenceSession({
    browser: fakeSecureStartBrowser(context),
    runtimeDir: os.tmpdir(),
    sensitiveValues: [],
  });

  await assert.rejects(() => session.start(), /service worker blocking unavailable/);
  assert.deepEqual(calls, ["serviceworker-listener", "init-script"]);
  assert.equal(serviceWorkerScans, 2);
});

test("long lived helper still fails closed on preexisting web service workers", async () => {
  const context = fakeSecureStartContext();
  context.serviceWorkers = () => [{ url: () => "https://staging-console.flatkey.ai/sw.js" }];
  const browser = fakeSecureStartBrowser(context);
  const session = new helper.BrowserEvidenceSession({ browser, runtimeDir: os.tmpdir(), sensitiveValues: [] });

  await assert.rejects(() => session.start(), /service worker blocking unavailable/);
});

test("long lived helper fails closed when service worker blocking cannot be applied", async () => {
  const browser = {
    contexts() {
      return [{
        pages() {
          return [];
        },
        async routeWebSocket() {},
      }];
    },
    async newBrowserCDPSession() {
      return { send: async () => {} };
    },
  };
  const session = new helper.BrowserEvidenceSession({ browser, runtimeDir: os.tmpdir(), sensitiveValues: [] });
  await assert.rejects(() => session.start(), /service worker blocking unavailable/);
});

test("long lived helper fails closed when service worker bypass cannot be applied", async () => {
  const page = {
    on() {},
  };
  const browser = {
    contexts() {
      return [{
        pages() {
          return [page];
        },
        async addInitScript() {},
        async routeWebSocket() {},
        serviceWorkers() {
          return [];
        },
      }];
    },
    async newBrowserCDPSession() {
      return { send: async () => {} };
    },
  };
  const session = new helper.BrowserEvidenceSession({ browser, runtimeDir: os.tmpdir(), sensitiveValues: [] });
  await assert.rejects(() => session.start(), /service worker bypass unavailable/);
});

test("protocol reports only fixed bounded init failure codes without exposing exception text", async () => {
  const secret = "owner+alias@gmail.com pw-secret sk-12345678 654321";
  const cases = [
    {
      expected: "init_connect_failed",
      connectOverCDP: async () => {
        throw new Error(`connect rejected ${secret}`);
      },
    },
    {
      expected: "init_context_failed",
      connectOverCDP: async () => ({ contexts: () => [] }),
    },
    {
      expected: "init_websocket_block_failed",
      connectOverCDP: async () => {
        const context = fakeSecureStartContext();
        delete context.routeWebSocket;
        return fakeSecureStartBrowser(context);
      },
    },
    {
      expected: "init_download_block_failed",
      connectOverCDP: async () => {
        const browser = fakeSecureStartBrowser();
        delete browser.newBrowserCDPSession;
        return browser;
      },
    },
    {
      expected: "init_service_worker_block_failed",
      connectOverCDP: async () => {
        const context = fakeSecureStartContext();
        delete context.addInitScript;
        return fakeSecureStartBrowser(context);
      },
    },
    {
      expected: "init_page_failed",
      connectOverCDP: async () => {
        const context = fakeSecureStartContext();
        context.pages = () => [];
        delete context.newPage;
        return fakeSecureStartBrowser(context);
      },
    },
    {
      expected: "init_service_worker_bypass_failed",
      connectOverCDP: async () => {
        const context = fakeSecureStartContext();
        delete context.newCDPSession;
        return fakeSecureStartBrowser(context);
      },
    },
  ];

  for (const testCase of cases) {
    const response = await runSingleProtocolRequest(testCase.connectOverCDP);
    assert.deepEqual(response, { id: 17, ok: false, error: testCase.expected });
    assert.ok(response.error.length <= 64);
    assert.ok(!JSON.stringify(response).includes(secret));
    assert.ok(!JSON.stringify(response).includes("owner+alias@gmail.com"));
    assert.ok(!JSON.stringify(response).includes("pw-secret"));
    assert.ok(!JSON.stringify(response).includes("sk-12345678"));
    assert.ok(!JSON.stringify(response).includes("654321"));
  }
});

test("docs reader uses fresh cookie-free docs proxy context, strips sensitive headers, and closes on success", async () => {
  const calls = [];
  const context = fakeDocsContext(calls, {
    async goto(url) {
      calls.push(["goto", url]);
    },
    async content() {
      return "<html><body>hello docs</body></html>";
    },
    url() {
      return "https://docs.flatkey.ai/quickstart";
    },
  });
  const browser = {
    async newContext(options) {
      calls.push(["newContext", options]);
      return context;
    },
  };
  const session = new helper.BrowserEvidenceSession({ browser, runtimeDir: os.tmpdir(), docsProxyUrl: "http://127.0.0.1:4568" });

  const result = await session.readDocs("https://docs.flatkey.ai/quickstart");
  const routeHandler = calls.find((call) => call[0] === "route")[2];
  const continued = [];
  await routeHandler({
    request: () => ({
      url: () => "https://docs.flatkey.ai/quickstart",
      method: () => "GET",
      headers: () => ({ Cookie: "secret=value", Authorization: "Bearer secret", Accept: "text/html" }),
    }),
    continue: async (options) => continued.push(options),
    abort: async () => calls.push(["abort"]),
  });

  assert.equal(result.status, 200);
  assert.equal(result.url, "https://docs.flatkey.ai/quickstart");
  assert.match(result.text, /hello docs/);
  assert.deepEqual(calls[0][1].storageState, { cookies: [], origins: [] });
  assert.equal(calls[0][1].serviceWorkers, "block");
  assert.equal(calls[0][1].javaScriptEnabled, false);
  assert.equal(calls[0][1].acceptDownloads, false);
  assert.equal(calls[0][1].proxy.server, "http://127.0.0.1:4568");
  assert.equal(continued[0].headers.Cookie, undefined);
  assert.equal(continued[0].headers.Authorization, undefined);
  assert.deepEqual(calls.at(-1), ["close"]);
});

test("docs reader disables scripts and closes routed websockets when Playwright supports them", async () => {
  const calls = [];
  const context = fakeDocsContext(calls, {
    async goto(url) {
      calls.push(["goto", url]);
    },
    async content() {
      return "<html><body>docs without script</body></html>";
    },
    url() {
      return "https://docs.flatkey.ai/ws-page";
    },
  });
  context.routeWebSocket = async (pattern, handler) => {
    calls.push(["routeWebSocket", pattern, handler]);
  };
  const browser = {
    async newContext(options) {
      calls.push(["newContext", options]);
      return context;
    },
  };
  const session = new helper.BrowserEvidenceSession({ browser, runtimeDir: os.tmpdir(), docsProxyUrl: "http://127.0.0.1:4568" });

  await session.readDocs("https://docs.flatkey.ai/ws-page");
  const wsHandler = calls.find((call) => call[0] === "routeWebSocket")[2];
  const sockets = [];
  await wsHandler({ url: () => "wss://docs.flatkey.ai/socket", close: () => sockets.push("closed") });
  await wsHandler({ url: () => "wss://staging-console.flatkey.ai/socket", close: () => sockets.push("closed") });

  assert.equal(calls[0][1].javaScriptEnabled, false);
  assert.deepEqual(sockets, ["closed", "closed"]);
});

test("docs reader blocks cookies, writes, cross-origin redirects, and closes on failure", async () => {
  const blockedRequests = [
    ["https://docs.flatkey.ai/quickstart", "POST"],
    ["https://console.flatkey.ai/", "GET"],
  ];
  for (const [url, method] of blockedRequests) {
    const calls = [];
    const context = fakeDocsContext(calls, {
      async goto() {
        throw new Error("blocked");
      },
      url() {
        return "https://docs.flatkey.ai/quickstart";
      },
    });
    const browser = { async newContext() { return context; } };
    const session = new helper.BrowserEvidenceSession({ browser, runtimeDir: os.tmpdir(), docsProxyUrl: "http://127.0.0.1:4568" });
    await assert.rejects(() => session.readDocs("https://docs.flatkey.ai/quickstart"), /docs read failed/);
    const routeHandler = calls.find((call) => call[0] === "route")[2];
    await routeHandler({
      request: () => ({ url: () => url, method: () => method, headers: () => ({}) }),
      continue: async () => calls.push(["continue"]),
      abort: async () => calls.push(["abort"]),
    });
    assert.ok(calls.some((call) => call[0] === "abort"));
    assert.deepEqual(calls.at(-1), ["abort"]);
  }

  const rejectedBeforeContext = new helper.BrowserEvidenceSession({
    browser: { async newContext() { throw new Error("must not create docs context"); } },
    runtimeDir: os.tmpdir(),
    docsProxyUrl: "http://127.0.0.1:4568",
  });
  await assert.rejects(() => rejectedBeforeContext.readDocs("http://169.254.169.254/latest"), /docs url blocked/);

  const calls = [];
  const context = fakeDocsContext(calls, {
    async goto() {},
    async content() {
      return "bad redirect";
    },
    url() {
      return "https://staging-console.flatkey.ai/login";
    },
  });
  const session = new helper.BrowserEvidenceSession({
    browser: { async newContext() { return context; } },
    runtimeDir: os.tmpdir(),
    docsProxyUrl: "http://127.0.0.1:4568",
  });
  await assert.rejects(() => session.readDocs("https://docs.flatkey.ai/redirect"), /docs redirect blocked/);
  assert.deepEqual(calls.at(-1), ["close"]);
});

test("long lived helper fails closed on event count and byte overflow", async () => {
  const session = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: os.tmpdir(),
    sensitiveValues: [],
    maxEvents: 1,
    maxEventBytes: 64,
    maxTotalBytes: 128,
  });

  session._pushConsole({ type: "log", text: "first" });
  assert.throws(() => session._pushConsole({ type: "log", text: "second" }), /browser evidence event limit exceeded/);
  await assert.rejects(() => session.flush(), /browser evidence overflow/);

  const largeEvent = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: os.tmpdir(),
    sensitiveValues: [],
    maxEventBytes: 32,
    maxTotalBytes: 1024,
  });
  assert.throws(() => largeEvent._pushConsole({ type: "log", text: "x".repeat(100) }), /browser evidence event too large/);

  const totalOverflow = new helper.BrowserEvidenceSession({
    browser: { contexts: () => [] },
    runtimeDir: os.tmpdir(),
    sensitiveValues: [],
    maxEvents: 10,
    maxEventBytes: 128,
    maxTotalBytes: 90,
  });
  totalOverflow._pushNetwork({ url: "https://staging-console.flatkey.ai/a", method: "GET" });
  assert.throws(() => totalOverflow._pushNetwork({ url: "https://staging-console.flatkey.ai/b", method: "GET" }), /browser evidence total too large/);
});

test("new page setup pending blocks capture and flush until service worker bypass completes", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "browser-evidence-pending-page-"));
  const oldPage = fakeScreenshotPage();
  const newPage = fakeScreenshotPage();
  const deferred = createDeferred();
  let pageHandler;
  const context = {
    pages: () => [oldPage],
    async addInitScript() {},
    async routeWebSocket() {},
    serviceWorkers: () => [],
    async newCDPSession(page) {
      if (page === newPage) {
        await deferred.promise;
      }
      return { send: async () => {} };
    },
    on(name, handler) {
      if (name === "page") {
        pageHandler = handler;
      }
    },
  };
  const session = new helper.BrowserEvidenceSession({ browser: fakeSecureStartBrowser(context), runtimeDir: runtime });
  await session.start();

  pageHandler(newPage);
  let captureSettled = false;
  const capture = session.captureScreenshot("after-new-page").finally(() => {
    captureSettled = true;
  });
  await delay(20);
  assert.equal(captureSettled, false);

  deferred.resolve();
  await capture;
  await session.flush();
});

test("new page setup drain includes pages opened while evidence operation is waiting", async () => {
  await assertNewPagesOpenedDuringSetupWaitAreDrained("capture", (session) => session.captureScreenshot("during-drain"));
  await assertNewPagesOpenedDuringSetupWaitAreDrained("flush", (session) => session.flush());
});

test("new page setup rejection makes capture and flush fail closed", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "browser-evidence-rejected-page-"));
  const oldPage = fakeScreenshotPage();
  const newPage = fakeScreenshotPage();
  let pageHandler;
  const context = {
    pages: () => [oldPage],
    async addInitScript() {},
    async routeWebSocket() {},
    serviceWorkers: () => [],
    async newCDPSession(page) {
      if (page === newPage) {
        throw new Error("cdp bypass failed");
      }
      return { send: async () => {} };
    },
    on(name, handler) {
      if (name === "page") {
        pageHandler = handler;
      }
    },
  };
  const session = new helper.BrowserEvidenceSession({ browser: fakeSecureStartBrowser(context), runtimeDir: runtime });
  await session.start();

  pageHandler(newPage);
  await delay(20);

  await assert.rejects(() => session.captureScreenshot("after-failed-page"), /browser page setup failed/);
  await assert.rejects(async () => session.flush(), /browser page setup failed/);
});

test("new page setup success attaches listeners and keeps evidence usable", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "browser-evidence-ready-page-"));
  const oldPage = fakeScreenshotPage();
  const newPage = fakeScreenshotPage();
  const calls = [];
  let pageHandler;
  const context = {
    pages: () => [oldPage],
    async addInitScript() {},
    async routeWebSocket() {},
    serviceWorkers: () => [],
    async newCDPSession(page) {
      calls.push(["cdp", page === newPage ? "new" : "old"]);
      return { send: async (method, params) => calls.push(["send", method, params]) };
    },
    on(name, handler) {
      if (name === "page") {
        pageHandler = handler;
      }
    },
  };
  const session = new helper.BrowserEvidenceSession({ browser: fakeSecureStartBrowser(context), runtimeDir: runtime });
  await session.start();

  pageHandler(newPage);
  await session.captureScreenshot("after-ready-page");
  newPage.emitConsole("new page ready");
  const flushed = await session.flush();

  assert.ok(calls.some((call) => call[0] === "cdp" && call[1] === "new"));
  assert.ok(calls.some((call) => call[0] === "send" && call[1] === "Network.setBypassServiceWorker" && call[2].bypass === true));
  assert.equal(flushed.console.length, 1);
  assert.equal(flushed.console[0].text, "new page ready");
});

async function assertNewPagesOpenedDuringSetupWaitAreDrained(operationName, startOperation) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), `browser-evidence-drain-${operationName}-`));
  const oldPage = fakeScreenshotPage();
  const page1 = fakeScreenshotPage();
  const page2 = fakeScreenshotPage();
  const page1Ready = createDeferred();
  const page2Ready = createDeferred();
  let pageHandler;
  const context = {
    pages: () => [oldPage],
    async addInitScript() {},
    async routeWebSocket() {},
    serviceWorkers: () => [],
    async newCDPSession(page) {
      if (page === page1) {
        await page1Ready.promise;
      } else if (page === page2) {
        await page2Ready.promise;
      }
      return { send: async () => {} };
    },
    on(name, handler) {
      if (name === "page") {
        pageHandler = handler;
      }
    },
  };
  const session = new helper.BrowserEvidenceSession({ browser: fakeSecureStartBrowser(context), runtimeDir: runtime });
  await session.start();

  pageHandler(page1);
  let operationSettled = false;
  const operation = startOperation(session).finally(() => {
    operationSettled = true;
  });
  await delay(20);
  assert.equal(operationSettled, false, `${operationName} settled before page1 setup completed`);

  pageHandler(page2);
  page1Ready.resolve();
  await delay(20);
  assert.equal(operationSettled, false, `${operationName} settled before page2 setup completed`);

  page2Ready.resolve();
  await operation;
}

function fakeScreenshotPage() {
  const listeners = {};
  return {
    locator(selector) {
      return { selector };
    },
    getByText(text, options) {
      return { text, options };
    },
    async screenshot(options) {
      assert.ok(Array.isArray(options.mask));
      return Buffer.from("\x89PNG\r\n\x1a\nmasked", "binary");
    },
    on(name, handler) {
      listeners[name] = handler;
    },
    emitConsole(text) {
      listeners.console({
        type: () => "log",
        text: () => text,
        location: () => ({ url: "https://staging-console.flatkey.ai", lineNumber: 1 }),
      });
    },
  };
}

function fakeSecureStartContext(page = fakeScreenshotPage()) {
  return {
    pages() {
      return [page];
    },
    async addInitScript() {},
    serviceWorkers() {
      return [];
    },
    async routeWebSocket(_pattern, handler) {
      this.wsHandler = handler;
    },
    async newCDPSession() {
      return { send: async () => {} };
    },
    on() {},
  };
}

function fakeSecureStartBrowser(context = fakeSecureStartContext()) {
  return {
    contexts() {
      return [context];
    },
    async newBrowserCDPSession() {
      return { send: async () => {} };
    },
  };
}

function fakeDocsContext(calls, page) {
  return {
    async route(pattern, handler) {
      calls.push(["route", pattern, handler]);
    },
    async newPage() {
      calls.push(["newPage"]);
      return page;
    },
    async close() {
      calls.push(["close"]);
    },
  };
}

async function runSingleProtocolRequest(connectOverCDP) {
  const request = JSON.stringify({
    id: 17,
    command: "init",
    params: {
      cdpEndpoint: "http://127.0.0.1:9222",
      runtimeDir: os.tmpdir(),
      sensitiveValues: [],
    },
  }) + "\n";
  let response = "";
  const output = new Writable({
    write(chunk, _encoding, callback) {
      response += chunk.toString("utf8");
      callback();
    },
  });
  await helper.runProtocol({ input: Readable.from([request]), output, connectOverCDP });
  return JSON.parse(response.trim());
}

async function runProtocolRequests({ connectOverCDP, requests }) {
  const inputText = requests.map((request) => JSON.stringify(request)).join("\n") + "\n";
  let response = "";
  const output = new Writable({
    write(chunk, _encoding, callback) {
      response += chunk.toString("utf8");
      callback();
    },
  });
  await helper.runProtocol({ input: Readable.from([inputText]), output, connectOverCDP });
  return response.trim().split("\n").map((line) => JSON.parse(line));
}

function fixedCase(overrides = {}) {
  return {
    schema_version: 1,
    id: "FQA-9001",
    kind: "coverage_baseline",
    name: "Sign in link avoids missing page",
    enabled: false,
    severity: "medium",
    owner: "browser-qa",
    fixture: "anonymous",
    start: { origin: "staging_console", path: "/start" },
    steps: [{ click: { locator: { by: "text", text: "Sign in" } } }],
    assertions: [{ url_not_contains: "/404" }],
    evidence: { screenshot_on_failure: true, capture_console: true, capture_network: true },
    cleanup: "not_required",
    source: {
      run_id: "123456789",
      finding_fingerprint: "finding-9001",
      evidence_uri: "gs://flatkey-browser-qa-private/run-123/fqa-9001",
    },
    promotion: { state: "candidate_draft", attempts_required: 3, attempts_passed: 0 },
    ...overrides,
  };
}

function mutateFixedCase(mutator) {
  const item = fixedCase();
  mutator(item);
  return item;
}

function fakeFixedCasePage(calls = [], options = {}) {
  let currentUrl = options.url || "https://staging-console.flatkey.ai/start";
  const gotoStatuses = Array.isArray(options.gotoStatuses) ? [...options.gotoStatuses] : null;
  const locatorFailures = options.locatorFailures || {};
  const locatorStates = options.locatorStates || {};
  const clickRequestsByClick = Array.isArray(options.clickRequestsByClick) ? [...options.clickRequestsByClick] : null;
  const listeners = new Map();
  const mainFrame = {};
  function emitResponse(status, resourceType, frame = mainFrame) {
    for (const handler of listeners.get("response") || []) {
      handler({
        status: () => status,
        frame: () => frame,
        request: () => ({ resourceType: () => resourceType }),
      });
    }
  }
  function locator(label) {
    return {
      async click() {
        calls.push(["click", label]);
        if (locatorFailures[label]) {
          throw locatorFailures[label];
        }
        emitRequests(clickRequestsByClick ? clickRequestsByClick.shift() : options.clickRequests);
        if (options.clickApiStatus) {
          emitResponse(options.clickApiStatus, "fetch", {});
        }
        if (options.clickMainDocumentStatus) {
          emitResponse(options.clickMainDocumentStatus, "document", mainFrame);
        }
      },
      async fill(value) {
        calls.push(["fill", label, value]);
        if (locatorFailures[label]) {
          throw locatorFailures[label];
        }
      },
      async selectOption(value) {
        calls.push(["selectOption", label, value]);
        if (locatorFailures[label]) {
          throw locatorFailures[label];
        }
      },
      async waitFor(waitOptions) {
        calls.push(["waitFor", label, waitOptions]);
        if (locatorFailures[label]) {
          throw locatorFailures[label];
        }
      },
      async isVisible() {
        calls.push(["isVisible", label]);
        if (locatorStates[label]?.visibleError) {
          throw locatorStates[label].visibleError;
        }
        return locatorStates[label]?.visible === true;
      },
      async isEnabled() {
        calls.push(["isEnabled", label]);
        if (locatorStates[label]?.enabledError) {
          throw locatorStates[label].enabledError;
        }
        return locatorStates[label]?.enabled === true;
      },
      async isDisabled() {
        calls.push(["isDisabled", label]);
        if (locatorStates[label]?.disabledError) {
          throw locatorStates[label].disabledError;
        }
        return locatorStates[label]?.disabled === true;
      },
      async inputValue() {
        calls.push(["inputValue", label]);
        if (locatorStates[label]?.valueError) {
          throw locatorStates[label].valueError;
        }
        return locatorStates[label]?.value || "";
      },
      async count() {
        calls.push(["count", label]);
        if (locatorStates[label]?.countError) {
          throw locatorStates[label].countError;
        }
        return locatorStates[label]?.count || 0;
      },
    };
  }
  return {
    async goto(url, gotoOptions) {
      calls.push(["goto", url, gotoOptions]);
      currentUrl = url;
      const selectedStatus = gotoStatuses ? gotoStatuses.shift() : options.gotoStatus;
      if (Object.prototype.hasOwnProperty.call(options, "gotoStatus") && selectedStatus === null) {
        return null;
      }
      if (gotoStatuses && selectedStatus === null) {
        return null;
      }
      return { status: () => selectedStatus || 200 };
    },
    async goBack(goBackOptions) {
      calls.push(["goBack", goBackOptions]);
      if (options.goBackNull) {
        return null;
      }
      return { status: () => options.goBackStatus || 200 };
    },
    url() {
      return currentUrl;
    },
    mainFrame() {
      return mainFrame;
    },
    getByRole(role, roleOptions) {
      calls.push(["getByRole", role, roleOptions]);
      return locator(`role:${role}:${roleOptions.name}`);
    },
    getByLabel(label, labelOptions) {
      calls.push(["getByLabel", label, labelOptions]);
      return locator(`label:${label}`);
    },
    getByText(text, textOptions) {
      calls.push(["getByText", text, textOptions]);
      return locator(`text:${text}`);
    },
    getByTestId(testId) {
      calls.push(["getByTestId", testId]);
      return locator(`test_id:${testId}`);
    },
    async screenshot() {
      if (options.screenshotFailure) {
        throw options.screenshotFailure;
      }
      return Buffer.from("\x89PNG\r\n\x1a\nfixed", "binary");
    },
    locator() {
      return {};
    },
    on(name, handler) {
      const handlers = listeners.get(name) || new Set();
      handlers.add(handler);
      listeners.set(name, handlers);
    },
    off(name, handler) {
      if (listeners.has(name)) {
        listeners.get(name).delete(handler);
      }
    },
    removeListener(name, handler) {
      if (listeners.has(name)) {
        listeners.get(name).delete(handler);
      }
    },
    listenerCount(name) {
      return listeners.get(name)?.size || 0;
    },
    emitRequest(url, method = "GET") {
      emitRequests([{ url, method }]);
    },
  };

  function emitRequests(requests) {
    for (const request of requests || []) {
      for (const handler of listeners.get("request") || []) {
        handler({
          url: typeof request.url === "function" ? request.url : () => request.url,
          method: typeof request.method === "function" ? request.method : () => request.method,
        });
      }
    }
  }
}

function fakeStartedBrowser(page) {
  return fakeSecureStartBrowser(fakeSecureStartContext(page));
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
