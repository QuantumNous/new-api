import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
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

test("every listed model has a catalog entry and a matching Try destination", () => {
  const html = read("../html/models.html");
  const models = catalog();
  const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  const listed = rows.filter((row) => /class="m"/.test(row));

  assert.ok(listed.length > 0, "models page must list models");
  for (const row of listed) {
    const model = row.match(/<b>([^<]+)<\/b>/)?.[1];
    const destination = row.match(/href="\/playground\?model=([^"]+)"/)?.[1];
    assert.ok(model, "each model row needs a model name");
    assert.equal(destination, model, `${model} Try link must preselect the same model`);
    assert.ok(models[model], `${model} must declare its provider, modality, and categories`);
  }
});

test("required capability filters are interactive and return registered models", () => {
  const html = read("../html/models.html");
  const models = catalog();
  const required = {
    chat: "Chat / Agents",
    coding: "Coding",
    reasoning: "Reasoning",
    vision: "Vision",
    "image-video": "Image · Video",
    china: "China models",
  };

  for (const [filter, label] of Object.entries(required)) {
    assert.match(html, new RegExp(`<button class="chip" type="button" data-filter="${filter}"[^>]*>${label.replace(/[·/]/g, "\\$&")}</button>`));
    assert.ok(Object.values(models).some((model) => model.tags.includes(filter)), `${label} must include at least one model`);
  }
  assert.match(html, /chip\.addEventListener\("click"/);
  assert.match(html, /tr\.hidden = !show/);
});

test("Playground renders the API method that matches the selected model modality", () => {
  const html = read("../html/playground.html");

  assert.match(html, /assets\/model-catalog\.js\?v=730a/);
  assert.match(html, /OpenAI-compatible Chat Completions/);
  assert.match(html, /OpenAI-compatible Images API/);
  assert.match(html, /Task-based Video Generation API/);
  assert.match(html, /OpenAI-compatible Audio Speech API/);
  assert.match(html, /OpenAI-compatible Audio Transcription API/);
  assert.match(html, /OpenAI-compatible Realtime WebSocket API/);
  assert.match(html, /\/v1\/images\/generations/);
  assert.match(html, /\/v1\/video\/generations/);
  assert.match(html, /\/v1\/audio\/speech/);
  assert.match(html, /\/v1\/audio\/transcriptions/);
  assert.match(html, /\/v1\/realtime/);
  assert.ok(
    html.includes('replace(/\\n\\++(?=  -)/g,"\\n")'),
    "rendered cURL snippets must strip stray diff markers",
  );
});

test("model catalog asset references use the same cache-busting version", () => {
  const pages = ["models.html", "model.html", "playground.html"];
  const versions = pages.map((page) => {
    const html = read(`../html/${page}`);
    const match = html.match(/(?:\/)?assets\/model-catalog\.js\?v=([a-z0-9]+)/);
    assert.ok(match, `${page} must load the shared model catalog`);
    return match[1];
  });

  assert.deepEqual(new Set(versions), new Set(["730a"]));
});

test("Playground can preselect claude-opus-5 from the shared catalog", () => {
  const models = catalog();
  const html = read("../html/playground.html");

  assert.equal(models["claude-opus-5"].provider, "Anthropic");
  assert.match(html, /new URLSearchParams\(location\.search\)\.get\("model"\)/);
  assert.match(html, /CATALOG\[model\] \|\| fallbackFor\(model\)/);
  assert.match(html, /document\.getElementById\("price-tag"\)\.textContent = info\.price/);
});

test("the public Playground allows three persistent previews before sign-up", () => {
  const html = read("../html/playground.html");
  const window = {};
  vm.runInNewContext(read("../html/assets/playground-preview.js"), { window, Number, Object, String });
  const preview = window.FLATKEY_PLAYGROUND_PREVIEW;
  const values = new Map();
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
  };

  assert.equal(preview.state(storage).remaining, 3);
  assert.equal(preview.consume(storage).remaining, 2);
  assert.equal(preview.consume(storage).remaining, 1);
  assert.equal(preview.consume(storage).remaining, 0);
  assert.equal(preview.consume(storage).accepted, false);
  assert.equal(preview.state(storage).remaining, 0, "refreshing must not reset the preview allowance");
  assert.match(html, /<button class="btn primary big" id="run-preview" type="button" data-action="run-preview">/);
  assert.doesNotMatch(html, /id="run-preview"[^>]*href="\/login"/);
  assert.match(html, /previewButton\.addEventListener\("click", runPreview\)/);
  assert.match(html, /previewInput\.addEventListener\("keydown"/);
  assert.match(html, /if\(current\.remaining === 0\)\{\s*location\.assign\("\/login"\)/);
  assert.match(preview.response("gpt-image-2", "image", "a cat").meta, /no paid API request sent/);
});

test("every public static website button has a reachable destination or form action", () => {
  const htmlDirectory = new URL("../html/", import.meta.url);
  const appOnly = new Set(["console.html", "login.html", "onboarding.html", "signup.html"]);
  const htmlFiles = readdirSync(htmlDirectory).filter((file) => file.endsWith(".html") && !appOnly.has(file));
  const buttonLinks = /<a\b(?=[^>]*\bclass="[^"]*\b(?:btn|try)\b[^"]*")[^>]*>/gi;

  for (const file of htmlFiles) {
    const html = read(`../html/${file}`);
    for (const match of html.matchAll(buttonLinks)) {
      const href = match[0].match(/\bhref="([^"]*)"/)?.[1]?.trim();
      assert.ok(href, `${file} contains a button without a destination`);
      assert.notEqual(href, "", `${file} contains a button without a destination`);
      assert.notEqual(href, "#", `${file} contains a placeholder button destination`);
      assert.doesNotMatch(href, /^javascript:/i, `${file} contains a JavaScript URL button`);
      if (href.startsWith("/")) {
        assert.doesNotMatch(href, /\.html(?:[?#]|$)/, `${file} button must use a canonical route`);
      }
    }
    for (const button of html.matchAll(/<button\b[^>]*>/gi)) {
      const tag = button[0];
      const type = tag.match(/\btype="([^"]+)"/)?.[1] ?? "submit";
      assert.ok(["button", "submit"].includes(type), `${file} button has an unsupported type`);
      if (type === "button") assert.match(tag, /data-(?:filter|action)=/, `${file} button needs an explicit interaction contract`);
      if (type === "submit") assert.match(html, /<form\b[^>]*\baction="[^"#][^"]*"[^>]*>/i, `${file} submit button needs a form action`);
    }
  }
});
