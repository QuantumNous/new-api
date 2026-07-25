import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function catalog() {
  const window = {};
  vm.runInNewContext(read("../html/assets/model-catalog.js"), { window });
  return window.FLATKEY_MODEL_CATALOG;
}

function renderDetail(model) {
  const window = {};
  vm.runInNewContext(read("../html/assets/model-catalog.js"), { window });
  const root = { innerHTML: "" };
  const codeBox = { textContent: "" };
  const canonical = { href: "" };
  const description = { content: "" };
  const buttons = [
    { getAttribute() { return "curl"; }, addEventListener() {}, classList: { toggle() {} } },
    { getAttribute() { return "python"; }, addEventListener() {}, classList: { toggle() {} } },
    { getAttribute() { return "javascript"; }, addEventListener() {}, classList: { toggle() {} } },
  ];
  const document = {
    title: "",
    getElementById(id) { return id === "model-detail" ? root : codeBox; },
    querySelector(selector) {
      if (selector === 'link[rel="canonical"]') return canonical;
      if (selector === 'meta[name="description"]') return description;
      if (selector === ".copy-code") return { addEventListener() {} };
      return null;
    },
    querySelectorAll(selector) { return selector === "[data-code]" ? buttons : []; },
  };

  vm.runInNewContext(read("../html/assets/model-detail.js"), {
    window,
    document,
    location: { pathname: `/models/${model}` },
    navigator: {},
    setTimeout() {},
  });
  return { root, codeBox, canonical, description, title: document.title };
}

test("claude-opus-5 is registered for the public detail page", () => {
  const model = catalog()["claude-opus-5"];

  assert.ok(model);
  assert.equal(model.provider, "Anthropic");
  assert.equal(model.kind, "chat");
  assert.equal(model.price, "official $5.00 → $4.50 /M input");
  for (const tag of ["chat", "coding", "reasoning", "vision"]) {
    assert.ok(model.tags.includes(tag), `claude-opus-5 must include ${tag}`);
  }
});

test("the public image catalog exactly matches the six callable platform models", () => {
  const models = catalog();
  const html = read("../html/models.html");
  const detail = read("../html/assets/model-detail.js");
  const expected = [
    "gemini-2.5-flash-image",
    "gemini-3-pro-image",
    "gemini-3.1-flash-image",
    "gemini-3.1-flash-lite-image",
    "gpt-image-2",
    "nano-banana-pro-preview",
  ];

  assert.deepEqual(
    Object.keys(models).filter((id) => models[id].kind === "image").sort(),
    expected,
  );
  for (const model of expected) {
    assert.equal(models[model].kind, "image");
    assert.match(html, new RegExp(`<b>${model.replaceAll(".", "\\.")}</b>[\\s\\S]*?Available`));
  }
  assert.equal(models["gpt-image-2"].api, "images");
  for (const model of expected.filter((id) => id !== "gpt-image-2")) {
    assert.equal(models[model].api, "chat-image");
  }
  assert.doesNotMatch(html, /grok-imagine-image/i);
  assert.doesNotMatch(detail, /grok-imagine-image/i);
});

test("every displayed model receives a detail destination", () => {
  const html = read("../html/models.html");
  const models = catalog();
  const listed = [...html.matchAll(/<div class="m">[\s\S]*?<b>([^<]+)<\/b>[\s\S]*?<\/tr>/g)]
    .map((match) => match[1]);

  assert.ok(listed.length >= 31);
  for (const model of new Set(listed)) {
    assert.ok(models[model], model + " must exist in the shared model catalog");
  }
  assert.match(html, /detail\.href = "\/models\/" \+ encodeURIComponent\(model\)/);
});

test("detail examples use the production endpoint for every modality", () => {
  const detail = read("../html/assets/model-detail.js");
  const nginx = read("../nginx.conf");

  for (const endpoint of [
    "/v1/chat/completions",
    "/v1/images/generations",
    "/v1/video/generations",
    "/v1/videos/",
    "/v1/audio/speech",
    "/v1/audio/transcriptions",
    "/v1/realtime?model=",
  ]) {
    assert.ok(detail.includes(endpoint), endpoint + " example is missing");
  }
  assert.match(detail, /api === "chat-image"/);
  assert.match(detail, /Generated image is returned as a Markdown data URI/);
  assert.match(nginx, /location ~ \^\/models\/\[a-zA-Z0-9\._-\]\+\/\?\$/);
});

test("claude-opus-5 uses the generic chat detail route", () => {
  const detail = renderDetail("claude-opus-5");

  assert.match(detail.title, /^claude-opus-5 API/);
  assert.equal(detail.canonical.href, "https://flatkey.ai/models/claude-opus-5");
  assert.match(detail.root.innerHTML, /Availability<\/span><strong class="status live">Available<\/strong>/);
  assert.match(detail.root.innerHTML, /Provider<\/span><strong>Anthropic<\/strong>/);
  assert.match(detail.root.innerHTML, /Flatkey price<\/span><strong>official \$5\.00 → \$4\.50 \/M input<\/strong>/);
  assert.match(detail.root.innerHTML, /Try in Playground/);
  assert.match(detail.codeBox.textContent, /\/v1\/chat\/completions/);
  assert.match(detail.codeBox.textContent, /"model":"claude-opus-5"/);
});
