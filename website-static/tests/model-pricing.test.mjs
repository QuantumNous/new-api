import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function pricing() {
  const window = { Number, Object, Array, Promise };
  vm.runInNewContext(readFileSync(new URL("../html/assets/model-pricing.js", import.meta.url), "utf8"), { window });
  return window.FLATKEY_MODEL_PRICING;
}

function payload(models) {
  return {
    success: true,
    schema_version: "website-public-plg-v2",
    group: "plg",
    generated_at: 100,
    models,
    vendors: "not consumed",
    extra: { billing_expr: "must stay irrelevant" },
  };
}

function prices(overrides = {}) {
  return {
    input: null,
    output: null,
    cache: null,
    image: null,
    audio_input: null,
    audio_output: null,
    request: null,
    ...overrides,
  };
}

function row(name, initial = "Loading pricing…") {
  const configured = { textContent: initial };
  const plg = { textContent: initial };
  return {
    configured,
    plg,
    getAttribute(attribute) { return attribute === "data-pricing-model" ? name : null; },
    querySelector(selector) { return selector.includes("configured") ? configured : selector.includes("plg") ? plg : null; },
  };
}

function root(modelRows) {
  return { querySelectorAll() { return modelRows; } };
}

test("maps token, request, and tiered public price variants", () => {
  const api = pricing();
  const mapped = api.pricesFor(payload([
    { model_name: "token", billing_kind: "token_ratio", prices: prices({ input: { configured: "4", plg: "2" }, output: { configured: "12", plg: "6" } }) },
    { model_name: "request", billing_kind: "request_base", prices: prices({ request: { configured: "0.02", plg: "0.01" } }) },
    { model_name: "tiered", billing_kind: "tiered_expr", prices: prices() },
  ]), ["token", "request", "tiered"]);

  assert.deepEqual({ ...mapped.token }, { configured: "$4/M", plg: "$2/M" });
  assert.deepEqual({ ...mapped.request }, { configured: "$0.02/request", plg: "$0.01/request" });
  assert.deepEqual({ ...mapped.tiered }, { configured: "Variable pricing", plg: "Variable pricing" });
});

test("ignores unconsumed metadata after validating every model contract", () => {
  const api = pricing();
  const mapped = api.pricesFor(payload([
    { model_name: "extra", billing_kind: "tiered_expr", prices: prices(), vendor: { malformed: true } },
    { model_name: "token", billing_kind: "token_ratio", vendor: 99, prices: prices({ input: { configured: "1", plg: "0.5", extra: false }, output: { configured: "2", plg: "1" } }) },
  ]), ["token"]);
  assert.deepEqual({ ...mapped.token }, { configured: "$1/M", plg: "$0.5/M" });
});

test("malformed unconsumed models invalidate the whole payload", () => {
  const api = pricing();
  const modelRow = row("token", "unchanged");
  const page = root([modelRow]);
  const invalid = payload([
    { model_name: "token", billing_kind: "token_ratio", prices: prices({ input: { configured: "2", plg: "1" }, output: { configured: "4", plg: "2" } }) },
    { model_name: "unused", billing_kind: "token_ratio", prices: { input: null } },
  ]);

  assert.throws(() => api.apply(page, invalid), /Incomplete public prices/);
  assert.equal(modelRow.configured.textContent, "unchanged");
  assert.equal(modelRow.plg.textContent, "unchanged");
});

test("invalid or missing consumed prices fail closed without partial updates", () => {
  const api = pricing();
  const first = row("valid", "unchanged");
  const second = row("invalid", "unchanged");
  const page = root([first, second]);
  const invalid = payload([
    { model_name: "valid", billing_kind: "token_ratio", prices: prices({ input: { configured: "2", plg: "1" }, output: { configured: "4", plg: "2" } }) },
    { model_name: "invalid", billing_kind: "request_base", prices: prices({ request: { configured: "0.02" } }) },
  ]);

  assert.throws(() => api.apply(page, invalid), /Invalid public price pair/);
  assert.equal(first.configured.textContent, "unchanged");
  assert.equal(first.plg.textContent, "unchanged");
  assert.equal(second.configured.textContent, "unchanged");
  assert.equal(second.plg.textContent, "unchanged");

  api.apply(page, payload([{ model_name: "valid", billing_kind: "token_ratio", prices: prices({ input: { configured: "2", plg: "1" }, output: { configured: "4", plg: "2" } }) }]));
  assert.equal(first.configured.textContent, "$2/M");
  assert.equal(second.configured.textContent, api.unavailable);
});

test("fetch failure and timeout set every primary price cell unavailable", async () => {
  const api = pricing();
  for (const mode of ["failure", "timeout"]) {
    const modelRow = row("token");
    const page = root([modelRow]);
    const options = mode === "failure" ? {
      fetch: async () => { throw new Error("offline"); },
      AbortController,
      setTimeout,
      clearTimeout,
    } : {
      fetch: (_url, request) => new Promise((_resolve, reject) => {
        if (request.signal.aborted) reject(new Error("aborted"));
        else request.signal.addEventListener("abort", () => reject(new Error("aborted")));
      }),
      AbortController,
      setTimeout(callback) { callback(); return 1; },
      clearTimeout() {},
    };
    assert.equal(await api.load(page, options), false);
    assert.equal(modelRow.configured.textContent, api.unavailable, mode);
    assert.equal(modelRow.plg.textContent, api.unavailable, mode);
  }
});

test("missing browser fetch support fails closed instead of leaving loading prices", () => {
  const modelRow = row("token");
  const window = { Number, Object, Array, Promise, document: root([modelRow]) };

  vm.runInNewContext(readFileSync(new URL("../html/assets/model-pricing.js", import.meta.url), "utf8"), { window });

  assert.equal(modelRow.configured.textContent, window.FLATKEY_MODEL_PRICING.unavailable);
  assert.equal(modelRow.plg.textContent, window.FLATKEY_MODEL_PRICING.unavailable);
});

test("models page loads the versioned pricing asset and has no static numeric primary prices", () => {
  const html = readFileSync(new URL("../html/models.html", import.meta.url), "utf8");
  assert.match(html, /assets\/model-pricing\.js\?v=729a/);
  const primaryTable = html.match(/<table>([\s\S]*?)<\/table>/)?.[1] ?? "";
  assert.doesNotMatch(primaryTable, /<span class="(?:off|ours)">\$\d/);
  assert.equal((primaryTable.match(/data-pricing-model=/g) ?? []).length, 12);
});

test("claude-opus-5 primary row uses live API price cells", () => {
  const html = readFileSync(new URL("../html/models.html", import.meta.url), "utf8");
  const row = html.match(/<tr\b[^>]*data-pricing-model="claude-opus-5"[\s\S]*?<\/tr>/)?.[0] ?? "";

  assert.match(row, /assets\/logos\/claude\.svg/);
  assert.match(row, /<b>claude-opus-5<\/b>/);
  assert.match(row, /<td class="mono">Anthropic<\/td>/);
  assert.match(row, /data-price="configured">Loading pricing/);
  assert.match(row, /data-price="plg">Loading pricing/);
  assert.match(row, /href="\/playground\?model=claude-opus-5"/);
  assert.doesNotMatch(row, /93\.8%|4\.37s|\$3\.33/);
});
