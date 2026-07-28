import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../html");
const templatePath = resolve(root, "index.html");
const i18nPath = resolve(root, "assets/i18n.js");
const homeToolsPath = resolve(root, "assets/home-tools-i18n.js");

const locales = {
  zh: "zh-CN",
  es: "es-ES",
  fr: "fr-FR",
  pt: "pt-PT",
  ru: "ru-RU",
  ja: "ja-JP",
  vi: "vi-VN",
  de: "de-DE",
  id: "id-ID",
};

function captureObject(source, pattern, label) {
  const match = source.match(pattern);
  assert.ok(match, `Could not parse ${label}`);
  return vm.runInNewContext(`(${match[1]})`);
}

const i18nSource = readFileSync(i18nPath, "utf8");
const dictionaries = captureObject(
  i18nSource,
  /var DICTS = (\{[\s\S]*?\n\});\n\n  var LEGAL_ROUTES/,
  "main i18n dictionaries",
);

const homeToolsSource = readFileSync(homeToolsPath, "utf8");
const homeToolsCopy = captureObject(
  homeToolsSource,
  /window\.FLATKEY_HOME_TOOLS_COPY = (\{[\s\S]*\});\s*$/,
  "homepage tools dictionaries",
);

function nestedValue(source, key) {
  return key.split(".").reduce((current, part) => current?.[part], source);
}

function localizeElements(html, attribute, lookup) {
  const element = new RegExp(
    `<([a-z][\\w-]*)\\b([^>]*\\b${attribute}="([^"]+)"[^>]*)>([\\s\\S]*?)<\\/\\1>`,
    "gi",
  );
  return html.replace(element, (full, tag, attributes, key, content) => {
    const translated = lookup(key);
    return translated === undefined
      ? full
      : `<${tag}${attributes}>${translated}</${tag}>`;
  });
}

function metaDescription(html) {
  return html.match(/<meta name="description" content="([^"]*)">/)?.[1] ?? "";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const template = readFileSync(templatePath, "utf8");
for (const [locale, languageTag] of Object.entries(locales)) {
  const targetPath = resolve(root, `${locale}.html`);
  const previous = readFileSync(targetPath, "utf8");
  const previousDescription = metaDescription(previous);

  let html = template
    .replace('<html lang="en-US">', `<html lang="${languageTag}">`)
    .replaceAll('href="assets/', 'href="/assets/')
    .replaceAll('src="assets/', 'src="/assets/')
    .replace('href="fk2.css', 'href="/fk2.css')
    .replace(
      '<link rel="canonical" href="https://flatkey.ai/">',
      `<link rel="canonical" href="https://flatkey.ai/${locale}">`,
    )
    .replaceAll(
      '<meta property="og:url" content="https://flatkey.ai/">',
      `<meta property="og:url" content="https://flatkey.ai/${locale}">`,
    );

  if (previousDescription) {
    const englishDescription = metaDescription(template);
    html = html.replaceAll(
      `content="${englishDescription}"`,
      `content="${previousDescription}"`,
    );
  }

  html = localizeElements(html, "data-i18n", (key) => dictionaries[locale]?.[key]);
  html = localizeElements(html, "data-home-i18n", (key) => nestedValue(homeToolsCopy[locale], key));
  html = html.replace(
    /href="\/?(terms|privacy|legal-sla|sla|refund-policy)\.html([^"]*)"/g,
    (_, route, suffix) => `href="/${route === "legal-sla" ? "sla" : route}${suffix}"`,
  );

  const localeBoot = `<script>try{localStorage.setItem("fk-lang","${locale}")}catch(e){}</script>\n`;
  html = html.replace(
    '<script src="/assets/home-tools-i18n.js?v=727a"></script>',
    `${localeBoot}<script src="/assets/home-tools-i18n.js?v=727a"></script>`,
  );

  assert.match(html, new RegExp(`<html lang="${escapeRegExp(languageTag)}">`));
  assert.match(html, /class="tools-intro"/);
  assert.match(html, /class="tool-universe"/);
  assert.match(html, /https:\/\/console\.flatkey\.ai\/api-marketplace/);
  writeFileSync(targetPath, html);
}

console.log(`Synchronized ${Object.keys(locales).length} localized homepages from index.html.`);
