#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "html");
const files = fs.readdirSync(root).filter((file) => file.endsWith(".html")).sort();
const errors = [];
const warnings = [];
const fail = (file, message) => errors.push(`${file}: ${message}`);

const appOnly = new Set(["console.html", "login.html", "onboarding.html", "signup.html"]);
const legacyRoutes = new Set(["/blog", "/models", "/pricing", "/rankings"]);
const requiredNavRoutes = ["models", "cli", "docs", "playground", "pricing", "compute", "usecases"];
const languageTags = new Set(["en-US", "zh-CN", "es-ES", "fr-FR", "pt-PT", "ru-RU", "ja-JP", "vi-VN", "de-DE", "id-ID"]);

for (const file of files) {
  const html = fs.readFileSync(path.join(root, file), "utf8");

  const htmlLanguage = html.match(/<html\b[^>]*\blang="([^"]+)"/i)?.[1];
  if (!htmlLanguage) fail(file, "missing html lang");
  else if (!languageTags.has(htmlLanguage)) fail(file, `html lang is not a supported regional BCP47 tag: ${htmlLanguage}`);
  const viewports = [...html.matchAll(/<meta\s+name="viewport"\s+content="([^"]+)"/gi)];
  if (viewports.length !== 1) fail(file, `expected one viewport meta, found ${viewports.length}`);
  else if (!viewports[0][1].includes("width=device-width")) fail(file, `non-responsive viewport: ${viewports[0][1]}`);
  const cssVersion = "728b";
  if (!html.includes(`fk2.css?v=${cssVersion}`)) fail(file, "missing the current shared CSS cache version");
  if (/\bid=""/.test(html)) fail(file, "contains an empty id");
  if (/<script\b[^>]*\bsrc=""/i.test(html)) fail(file, "contains an empty script src");
  if (/href="(?:#|javascript:[^"]*)"/i.test(html)) fail(file, "contains a placeholder or javascript link");
  if (/\bdata-i18n(?:-ph)?=/.test(html) && !/assets\/i18n\.js\?v=/.test(html)) {
    fail(file, "uses i18n keys without loading assets/i18n.js");
  }
  const i18nScript = html.indexOf("assets/i18n.js?v=724b");
  const shellScript = html.indexOf("assets/site-shell.js?v=720a");
  const trackScript = html.indexOf("assets/track.js?v=721a");
  if (i18nScript === -1) fail(file, "missing the current locale-routing script version");
  if (shellScript === -1) fail(file, "missing the current responsive shell version");
  if (trackScript === -1) fail(file, "missing the current attribution script version");
  if (i18nScript !== -1 && shellScript !== -1 && i18nScript > shellScript) {
    fail(file, "site shell loads before locale state is initialized");
  }

  const footers = [...html.matchAll(/<footer\b/g)];
  if (footers.length !== 1) fail(file, `expected one semantic footer, found ${footers.length}`);
  if (/class="megafoot slim"/.test(html)) fail(file, "still uses the one-line slim footer");
  const fullFooter = html.match(/<footer class="megafoot">([\s\S]*?)<\/footer>/);
  if (!fullFooter) {
    fail(file, "missing the complete shared marketing footer");
  } else {
    const footerMarkup = fullFooter[1];
    const footerColumns = [...footerMarkup.matchAll(/class="col(?:\s|\")/g)].length;
    if (footerColumns !== 5) fail(file, `complete footer has ${footerColumns} columns; expected 5`);
    if (/class="pxgrid"/.test(footerMarkup)) fail(file, "footer pixel overlay can cover navigation links");
    for (const requiredClass of ["cols", "trustrow", "bottom", "legal", "word"]) {
      if (!new RegExp(`class="[^"]*\\b${requiredClass}\\b`).test(footerMarkup)) {
        fail(file, `complete footer is missing .${requiredClass}`);
      }
    }
  }

  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicateIds.length) fail(file, `duplicate ids: ${duplicateIds.join(", ")}`);

  const hreflangs = [...html.matchAll(/hreflang="([^"]+)"/g)].map((match) => match[1]);
  const duplicateHreflangs = [...new Set(hreflangs.filter((lang, index) => hreflangs.indexOf(lang) !== index))];
  if (duplicateHreflangs.length) fail(file, `duplicate hreflang values: ${duplicateHreflangs.join(", ")}`);
  for (const hreflang of hreflangs) {
    if (hreflang !== "x-default" && !languageTags.has(hreflang)) fail(file, `non-regional hreflang: ${hreflang}`);
  }

  for (const image of html.matchAll(/<img\b([^>]*)>/gi)) {
    if (!/\balt="[^"]*"/i.test(image[1])) fail(file, `image is missing alt: ${image[0].slice(0, 100)}`);
  }

  if (!appOnly.has(file)) {
    if (/href="[^"]*\.html(?:[?#][^"]*)?"/i.test(html)) fail(file, "public navigation still exposes a .html URL");
    if (/rel="canonical" href="[^"]*\.html(?:[?#][^"]*)?"/i.test(html)) fail(file, "canonical still uses a .html URL");
  }

  if (!appOnly.has(file)) {
    if (!/<nav\b|class="dbar"/.test(html)) fail(file, "public page is missing navigation");
  }

  const nav = html.match(/<nav class="nav"[^>]*>([\s\S]*?)<\/nav>/);
  if (nav) {
    for (const route of requiredNavRoutes) {
      if (!new RegExp(`href="/${route}(?:[?#\"]|$)`).test(nav[1])) fail(file, `navigation is missing /${route}`);
    }
    const navComputeLinks = [...nav[1].matchAll(/data-i18n="nav\.compute"/g)].length;
    if (navComputeLinks > 1) fail(file, `navigation contains ${navComputeLinks} Compute links`);
  }

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const ref = match[1].split(/[?#]/)[0];
    if (!ref || /^(?:https?:|mailto:|tel:|data:)/i.test(ref) || legacyRoutes.has(ref)) continue;
    if (ref.startsWith("/") && !/\.[a-z0-9]+$/i.test(ref)) continue;
    const local = ref.startsWith("/") ? ref.slice(1) : ref;
    if (!fs.existsSync(path.join(root, local))) fail(file, `missing local target: ${match[1]}`);
  }
}

const terms = fs.readFileSync(path.join(root, "terms.html"), "utf8");
const termNumbers = [...terms.matchAll(/<h2>(\d+)\./g)].map((match) => Number(match[1]));
const expectedTermNumbers = Array.from({ length: 19 }, (_, index) => index + 1);
if (JSON.stringify(termNumbers) !== JSON.stringify(expectedTermNumbers)) {
  fail("terms.html", `section sequence is ${termNumbers.join(", ")}; expected 1–19 exactly once`);
}

const sitemapV2 = fs.readFileSync(path.join(root, "sitemap-v2.xml"), "utf8");
if (/\.html(?:<|\?)/.test(sitemapV2)) fail("sitemap-v2.xml", "contains legacy .html URLs");
if (sitemapV2.includes("https://flatkey.ai/login")) fail("sitemap-v2.xml", "contains a non-indexable login URL");
const sitemapV2Locations = [...sitemapV2.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const duplicateSitemapLocations = [...new Set(sitemapV2Locations.filter((url, index) => sitemapV2Locations.indexOf(url) !== index))];
if (duplicateSitemapLocations.length) fail("sitemap-v2.xml", `duplicate URLs: ${duplicateSitemapLocations.join(", ")}`);

const llmsTxt = fs.readFileSync(path.join(root, "llms.txt"), "utf8");
for (const requiredLlmsContent of [
  "Gemini native generateContent: POST https://router.flatkey.ai/v1beta/models/{model}:generateContent",
  "nano-banana-pro-preview supports both Gemini native generateContent and OpenAI-compatible Chat Completions.",
  "currently do not use /v1/images/generations",
  "Create a video task with POST https://router.flatkey.ai/v1/videos.",
  "Poll task status with GET https://router.flatkey.ai/v1/videos/{task_id}.",
  "Download completed video content with GET https://router.flatkey.ai/v1/videos/{task_id}/content.",
  "https://docs.flatkey.ai/api-reference/seedance-video-generation",
  "https://docs.flatkey.ai/zh/api-reference/seedance-video-generation",
]) {
  if (!llmsTxt.includes(requiredLlmsContent)) fail("llms.txt", `missing API documentation: ${requiredLlmsContent}`);
}

const about = fs.readFileSync(path.join(root, "about.html"), "utf8");
for (const requiredAboutContent of [
  "Hunter Guo",
  "Andrew Guo",
  "Google &amp; Alibaba",
  "Hundreds of millions",
  "AI should be simple enough for",
  'rel="canonical" href="https://flatkey.ai/about"',
  'assets/team/amazon-accelerate-team.jpg',
  'assets/team/team-dinner.jpg',
  'assets/team/product-conversations.jpg',
  'assets/team/seattle-community.jpg',
]) {
  if (!about.includes(requiredAboutContent)) fail("about.html", `missing founder-story content: ${requiredAboutContent}`);
}

const aboutZh = fs.readFileSync(path.join(root, "about-zh.html"), "utf8");
for (const requiredAboutZhContent of [
  '<html lang="zh-CN">',
  "Hunter Guo",
  "Andrew Guo",
  "Google + 阿里巴巴",
  "让每个人都能更简单地使用 AI",
  'rel="canonical" href="https://flatkey.ai/zh/about"',
  'href="/zh/careers"',
  'assets/team/amazon-accelerate-team.jpg',
]) {
  if (!aboutZh.includes(requiredAboutZhContent)) fail("about-zh.html", `missing localized founder-story content: ${requiredAboutZhContent}`);
}

for (const careersFile of ["careers.html", "careers-zh.html"]) {
  const careers = fs.readFileSync(path.join(root, careersFile), "utf8");
  for (const removedOfficeImage of ["qbay-workspace.jpg", "qbay-boardroom.jpg", "qbay-office.jpg"]) {
    if (careers.includes(removedOfficeImage)) fail(careersFile, `still shows empty office image: ${removedOfficeImage}`);
  }
  for (const requiredTeamImage of [
    "amazon-accelerate-team.jpg",
    "team-dinner.jpg",
    "product-conversations.jpg",
    "community-audience.jpg",
    "seattle-community.jpg",
  ]) {
    if (!careers.includes(`assets/team/${requiredTeamImage}`)) fail(careersFile, `missing team image: ${requiredTeamImage}`);
  }
}

const nginxConfig = fs.readFileSync(path.join(path.dirname(root), "nginx.conf"), "utf8");
if (!nginxConfig.includes("location = /about { try_files /about.html =404; }")) {
  fail("nginx.conf", "/about does not serve the new static founder story");
}
if (!nginxConfig.includes("location = /zh/about { try_files /about-zh.html =404; }")) {
  fail("nginx.conf", "/zh/about does not serve the localized static founder story");
}
for (const [legacyPath, canonicalPath] of [
  ["/models.html", "/models"],
  ["/docs.html", "/docs"],
  ["/playground.html", "/playground"],
  ["/topup.html", "/pricing"],
  ["/terms.html", "/terms"],
  ["/about-zh.html", "/zh/about"],
  ["/careers-zh.html", "/zh/careers"],
]) {
  const escapedLegacy = legacyPath.replace(".", "\\.");
  const exact = new RegExp(`location = ${escapedLegacy} \\{ return 301 ${canonicalPath}; \\}`);
  const grouped = legacyPath === "/topup.html" || legacyPath.endsWith("-zh.html") ? false : nginxConfig.includes(`|${legacyPath.slice(1, -5)}|`) || nginxConfig.includes(`(${legacyPath.slice(1, -5)}|`);
  if (!exact.test(nginxConfig) && !grouped) fail("nginx.conf", `${legacyPath} does not permanently redirect to ${canonicalPath}`);
}
for (const [route, file] of [["models", "models.html"], ["cli", "cli.html"], ["docs", "docs.html"], ["playground", "playground.html"], ["pricing", "topup.html"], ["terms", "terms.html"]]) {
  if (!nginxConfig.includes(`location = /${route} { try_files /${file} =404; }`)) fail("nginx.conf", `/${route} does not serve ${file}`);
}
if (!nginxConfig.includes("sub_filter 'lang=\"en\"' 'lang=\"en-US\"';")) fail("nginx.conf", "legacy HTML/XML does not normalize language tags");

const sharedCss = fs.readFileSync(path.join(root, "fk2.css"), "utf8");
if (/\.megafoot\.slim\b/.test(sharedCss)) fail("fk2.css", "contains obsolete slim-footer styles");
for (const visualSignature of [
  "--home-acid:#D9EF6E",
  "body:has(> header.hero)>.nav",
  "body:has(> header.hero)>header.hero",
  "body:has(> header.hero) .hero .board",
  "body:has(> header.hero) .proofGrid",
]) {
  if (!sharedCss.includes(visualSignature)) fail("fk2.css", `missing restored homepage visual signature: ${visualSignature}`);
}

function mediaBlock(maxWidth) {
  const marker = `@media (max-width:${maxWidth}px){`;
  const start = sharedCss.indexOf(marker);
  if (start === -1) return "";
  const next = sharedCss.indexOf("\n@media ", start + marker.length);
  return sharedCss.slice(start, next === -1 ? sharedCss.length : next);
}

for (const desktopWidth of [1740, 1320]) {
  const block = mediaBlock(desktopWidth);
  if (!block) fail("fk2.css", `missing ${desktopWidth}px compact desktop breakpoint`);
  if (/\.nav>a:not\(\.logo\)[^{]*\{[^}]*display\s*:\s*none/.test(block)) {
    fail("fk2.css", `${desktopWidth}px desktop breakpoint hides the primary navigation`);
  }
  if (/\.nav \.nav-toggle\{[^}]*display\s*:\s*flex/.test(block)) {
    fail("fk2.css", `${desktopWidth}px desktop breakpoint replaces navigation with the mobile toggle`);
  }
}

const mobileNavigationBlock = mediaBlock(1180);
if (!/\.nav>a:not\(\.logo\)[^{]*\{[^}]*display\s*:\s*none/.test(mobileNavigationBlock)) {
  fail("fk2.css", "1180px mobile breakpoint does not collapse the primary navigation");
}
if (!/\.nav \.nav-toggle\{[^}]*display\s*:\s*flex/.test(mobileNavigationBlock)) {
  fail("fk2.css", "1180px mobile breakpoint does not expose the navigation toggle");
}

const i18nSource = fs.readFileSync(path.join(root, "assets/i18n.js"), "utf8");
for (const requiredLocaleBehavior of [
  "function pathLocale()",
  "function isAboutPath(pathname)",
  "function localeRoute(locale, route)",
  "function syncLocaleRoutes(locale)",
  'document.documentElement.dataset.locale = l',
  'new CustomEvent("flatkey:languagechange"',
  'sla: "sla"',
  'locale === "zh" ? "/zh/careers" : "/careers"',
]) {
  if (!i18nSource.includes(requiredLocaleBehavior)) {
    fail("assets/i18n.js", `missing locale synchronization behavior: ${requiredLocaleBehavior}`);
  }
}
for (const route of ["home", "careers", "contact", "about", "blog", "terms", "privacy", "sla", "legal-sla", "refund-policy"]) {
  if (!i18nSource.includes(`"${route}"`)) fail("assets/i18n.js", `locale router is missing ${route}`);
}

const shellSource = fs.readFileSync(path.join(root, "assets/site-shell.js"), "utf8");
if (!shellSource.includes("function syncPanel()")) fail("assets/site-shell.js", "mobile navigation is not rebuilt after a locale change");
if (!shellSource.includes('document.addEventListener("flatkey:languagechange"')) {
  fail("assets/site-shell.js", "mobile navigation does not listen for locale changes");
}

const trackSource = fs.readFileSync(path.join(root, "assets/track.js"), "utf8");
for (const requiredAttributionBehavior of [
  "flatkey_ads_attribution",
  "first_landing_path",
  "first_captured_at",
  'path.indexOf("/oauth/") !== 0',
  'path !== "/sign-in"',
  'path !== "/sign-up"',
  "domain=.flatkey.ai",
  "yclid",
]) {
  if (!trackSource.includes(requiredAttributionBehavior)) {
    fail("assets/track.js", `missing paid attribution behavior: ${requiredAttributionBehavior}`);
  }
}

const dictMatch = i18nSource.match(/var DICTS = (\{[\s\S]*?\n\});\n\n  var LEGAL_ROUTES/);
if (!dictMatch) {
  fail("assets/i18n.js", "cannot parse dictionaries");
} else {
  const dicts = vm.runInNewContext(`(${dictMatch[1]})`);
  const referenced = new Set();
  for (const file of files) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    for (const match of html.matchAll(/data-i18n(?:-ph)?="([^"]+)"/g)) referenced.add(match[1]);
  }
  for (const [locale, dictionary] of Object.entries(dicts)) {
    const missing = [...referenced].filter((key) => !(key in dictionary));
    if (missing.length) fail("assets/i18n.js", `${locale} is missing ${missing.length} referenced keys: ${missing.join(", ")}`);
    if (!dictionary["rel.s1"]?.includes('href="/sla"')) {
      fail("assets/i18n.js", `${locale} rel.s1 does not link to the canonical /sla route`);
    }
    if (!dictionary["rel.s1"]?.includes("white-space:nowrap")) {
      fail("assets/i18n.js", `${locale} rel.s1 allows its nested link hit target to split across lines`);
    }
    if (/href="[^"]*\.html/.test(dictionary["rel.s1"] || "")) {
      fail("assets/i18n.js", `${locale} rel.s1 still exposes a legacy .html route`);
    }
  }
}

if (warnings.length) console.warn(`Warnings (${warnings.length})\n${warnings.join("\n")}\n`);
if (errors.length) {
  console.error(`Static website audit failed (${errors.length})\n${errors.join("\n")}`);
  process.exit(1);
}
console.log(`Static website audit passed: ${files.length} HTML files, responsive metadata, navigation, footer, links, hreflang and i18n coverage.`);
