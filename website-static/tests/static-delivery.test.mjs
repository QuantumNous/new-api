import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("Nginx proxies the public status response with bounded browser caching", () => {
  const nginx = read("../nginx.conf");
  const location = nginx.match(/location = \/api\/status\s*\{([\s\S]*?)\n  \}/)?.[1] ?? "";

  assert.ok(location);
  assert.match(
    location,
    /proxy_pass \$\{APP_CONSOLE_ORIGIN\}\/api\/status;/,
  );
  assert.match(location, /proxy_set_header Cookie "";/);
  assert.match(location, /proxy_set_header Authorization "";/);

  const timeoutNames = [
    ...location.matchAll(/proxy_(connect|read|send)_timeout 3s;/g),
  ].map((match) => match[1]);
  assert.deepEqual(timeoutNames.sort(), ["connect", "read", "send"]);
  assert.match(location, /Cache-Control "public, max-age=60" always;/);
});

test("Nginx bridges sanitized v2 pricing anonymously without transforming it", () => {
  const nginx = read("../nginx.conf");
  const location = nginx.match(/location = \/api\/website\/pricing\/v2\s*\{([\s\S]*?)\n  \}/)?.[1] ?? "";

  assert.match(location, /proxy_pass \$\{APP_CONSOLE_ORIGIN\}\/api\/website\/pricing\/v2;/);
  assert.match(location, /proxy_set_header Cookie "";/);
  assert.match(location, /proxy_set_header Authorization "";/);
  for (const timeout of ["connect", "read", "send"]) {
    assert.match(location, new RegExp(`proxy_${timeout}_timeout 3s;`));
  }
  assert.doesNotMatch(location, /proxy_hide_header|sub_filter|add_header Cache-Control|proxy_cache/);
  assert.doesNotMatch(location, /proxy_pass [^;]*\?/);
});

test("static HTML receives one shared configuration script and keeps local docs fallback visible", () => {
  const nginx = read("../nginx.conf");
  const css = read("../html/fk2.css");
  const indexHtml = read("../html/index.html");

  assert.match(
    nginx,
    /sub_filter '<\/body>' '<script src="\/assets\/site-config\.js\?v=[^"]+"><\/script><\/body>';/,
  );
  assert.doesNotMatch(nginx, /sub_filter 'fk2\.css\?v=716b'/);
  assert.match(indexHtml, /<a href="\/docs">Docs<\/a>/);
  assert.doesNotMatch(indexHtml, /href="[^"]*\.html/);
});

test("website navigation applies the shared responsive Flatkey lockup", () => {
  const css = read("../html/fk2.css");

  assert.match(
    css,
    /\.nav>a\.logo\{font-size:30px;letter-spacing:-1\.3px;gap:9px\}/,
  );
  assert.match(
    css,
    /\.nav>a\.logo img\{width:38px;height:38px\}/,
  );
  assert.doesNotMatch(css, /\.nav>\.logo\{/);
  assert.doesNotMatch(css, /\.nav>\.logo img\{/);

  for (const page of [
    "index.html",
    "models.html",
    "model.html",
    "playground.html",
    "topup.html",
    "terms.html",
    "privacy.html",
    "about.html",
    "careers.html",
  ]) {
    const html = read(`../html/${page}`);
    assert.match(
      html,
      /<a class="logo" href="\/"><img src="\/?assets\/flatkey-mark\.svg\?v=4" alt="[^"]*">flatkey<\/a>/,
      `${page} must use the shared Flatkey mark and lowercase wordmark`,
    );
  }
});

test("legacy proxied pages visually use the shared responsive Flatkey lockup", () => {
  const css = read("../html/assets/legacy-skin.css");
  const nginx = read("../nginx.conf");

  assert.match(nginx, /legacy-skin\.css\?v=723b/);
  assert.match(css, /width:36px !important/);
  assert.match(css, /height:36px !important/);
  assert.match(css, /content:url\("\/assets\/flatkey-mark\.svg\?v=4"\) !important/);
  assert.match(css, /header\.fixed nav a\.group span\[style\]::after\{/);
  assert.match(css, /content:"flatkey"/);
  assert.match(css, /font-family:"Public Sans",Inter,-apple-system,sans-serif/);
  assert.match(css, /font-size:28px/);
  assert.match(css, /font-weight:700/);
  assert.match(css, /gap:8px !important/);
  assert.match(css, /@media \(max-width:420px\)/);
  assert.doesNotMatch(css, /content:"flatkey\.ai"/);
});

test("OpenRouter-style homepages omit removed proof and price-comparison blocks", () => {
  const homepages = [
    "index.html", "zh.html", "es.html", "pt.html", "fr.html",
    "id.html", "de.html", "vi.html", "ru.html", "ja.html",
  ];

  for (const homepage of homepages) {
    const html = read(`../html/${homepage}`);
    assert.doesNotMatch(html, /<section class="proof">/);
    assert.doesNotMatch(html, /data-i18n="proof\.(?:t|h|p)[1-4]"/);
    assert.doesNotMatch(html, /<section class="compare">/);
    assert.doesNotMatch(html, /data-i18n="cmp\.(?:h2|sub|foot)"/);
  }
});

test("public static pages use one extensionless canonical route", () => {
  const nginx = read("../nginx.conf");
  const sitemap = read("../html/sitemap-v2.xml");

  for (const [route, file] of [
    ["models", "models.html"],
    ["cli", "cli.html"],
    ["docs", "docs.html"],
    ["playground", "playground.html"],
    ["pricing", "topup.html"],
    ["terms", "terms.html"],
  ]) {
    assert.match(nginx, new RegExp(`location = /${route} \\{ try_files /${file.replace(".", "\\.")} =404; \\}`));
  }
  assert.match(nginx, /location = \/topup\.html \{ return 301 \/pricing; \}/);
  assert.doesNotMatch(sitemap, /\.html</);
  assert.doesNotMatch(sitemap, /<loc>https:\/\/flatkey\.ai\/login<\/loc>/);
});

test("production homepage cannot regress behind the models and tools launch", () => {
  const homepage = read("../html/index.html");

  assert.match(homepage, /More models\./);
  assert.match(homepage, /More tools\./);
  assert.match(homepage, /1,000\+ tools\./);
  assert.match(homepage, /https:\/\/flatkey\.ai\/SKILL\.md/);
  assert.match(homepage, /id="screen-three"/);
});

test("homepage tools CTAs lead directly to the Flatkey API Marketplace", () => {
  const homepage = read("../html/index.html");
  const tracking = read("../html/assets/track.js");
  const marketplaceHref = 'href="https://console.flatkey.ai/api-marketplace"';
  const marketplace = /href="https:\/\/console\.flatkey\.ai\/api-marketplace"/;

  assert.equal(homepage.split(marketplaceHref).length - 1, 3);
  assert.doesNotMatch(homepage, /href="#screen-three"/);
  assert.match(tracking, /tools_marketplace_click/);

  for (const file of ["zh.html", "es.html", "pt.html", "fr.html", "id.html", "de.html", "vi.html", "ru.html", "ja.html"]) {
    assert.match(
      read(`../html/${file}`),
      marketplace,
      `${file} must expose the localized Marketplace navigation CTA`,
    );
  }
});

test("localized homepages keep the final models-and-tools value proposition", () => {
  for (const file of ["zh.html", "es.html", "pt.html", "fr.html", "id.html", "de.html", "vi.html", "ru.html", "ja.html"]) {
    const homepage = read(`../html/${file}`);

    assert.match(homepage, /heroSavings/, `${file} must keep the unified-balance savings card`);
    assert.match(homepage, /toolLine/, `${file} must keep the More Tools headline`);
    assert.match(homepage, /1[,. ]000\+/, `${file} must keep the 1,000+ tools proof point`);
    assert.doesNotMatch(homepage, /<section class="v" id="trust">/, `${file} must keep the removed trust screen out`);
  }
});

test("legacy HTML and sitemap responses normalize regional language tags", () => {
  const nginx = read("../nginx.conf");

  for (const [short, regional] of [["en", "en-US"], ["zh", "zh-CN"], ["ja", "ja-JP"]]) {
    assert.match(nginx, new RegExp(`sub_filter 'lang="${short}"' 'lang="${regional}"';`));
  }
  assert.match(nginx, /sub_filter_types application\/xml text\/xml;/);
  assert.match(nginx, /sub_filter_once off;/);
});

test("the Nginx image substitutes only the configured console origin", () => {
  const dockerfile = read("../Dockerfile");

  assert.match(
    dockerfile,
    /ENV APP_CONSOLE_ORIGIN=https:\/\/console\.flatkey\.ai/,
  );
  assert.match(
    dockerfile,
    /ENV NGINX_ENVSUBST_FILTER=APP_CONSOLE_ORIGIN/,
  );
  assert.match(
    dockerfile,
    /COPY nginx\.conf \/etc\/nginx\/templates\/default\.conf\.template/,
  );
  assert.doesNotMatch(
    dockerfile,
    /COPY nginx\.conf \/etc\/nginx\/conf\.d\/default\.conf/,
  );
});

test("the production workflow passes and smoke-tests the console origin", () => {
  const workflow = read("../../.github/workflows/gcp-deploy-website-static.yml");

  assert.match(
    workflow,
    /--update-env-vars[=\s"']+APP_CONSOLE_ORIGIN=\$\{APP_CONSOLE_ORIGIN\}/,
  );
  assert.match(workflow, /"\$C\/api\/status"/);
  assert.ok(
    workflow.includes(
      `grep -Eq '"success"[[:space:]]*:[[:space:]]*true'`,
    ),
  );
});

function runTrackingScript({ pathname, search, cookie = "" }) {
  let browserCookie = cookie;
  const document = {
    referrer: "",
    addEventListener() {},
    querySelector() { return null; },
  };
  Object.defineProperty(document, "cookie", {
    get() { return browserCookie; },
    set(value) { browserCookie = value; },
  });
  const location = {
    pathname,
    search,
    hostname: "flatkey.ai",
    origin: "https://flatkey.ai",
    protocol: "https:",
  };
  vm.runInNewContext(read("../html/assets/track.js"), {
    Date,
    JSON,
    Object,
    URLSearchParams,
    decodeURIComponent,
    document,
    encodeURIComponent,
    location,
    window: {},
  });
  const pair = browserCookie.split(";", 1)[0];
  const payload = JSON.parse(decodeURIComponent(pair.slice(pair.indexOf("=") + 1)));
  return { browserCookie, cookieHeader: pair, payload };
}

test("paid attribution keeps an immutable first landing across the console handoff", () => {
  const first = runTrackingScript({
    pathname: "/pt",
    search: "?utm_source=google&utm_campaign=flatkey-pt&gclid=click-1&yclid=yandex-1",
  });
  assert.equal(first.payload.first_landing_path, "/pt");
  assert.equal(first.payload.landing_path, "/pt");
  assert.equal(first.payload.yclid, "yandex-1");
  assert.match(first.browserCookie, /domain=\.flatkey\.ai/);
  assert.match(first.browserCookie, /SameSite=Lax/);

  const later = runTrackingScript({
    pathname: "/pricing",
    search: "?utm_source=google&utm_campaign=pricing&gclid=click-2",
    cookie: first.cookieHeader,
  });
  assert.equal(later.payload.first_landing_path, "/pt");
  assert.equal(later.payload.landing_path, "/pricing");
  assert.equal(later.payload.gclid, "click-1");
  assert.equal(later.payload.expires_at, first.payload.expires_at);
});

test("authentication routes never become acquisition landers", () => {
  const captured = runTrackingScript({
    pathname: "/sign-up",
    search: "?utm_source=google&gclid=click-auth",
  });
  assert.equal(captured.payload.first_landing_path, undefined);
  assert.equal(captured.payload.landing_path, "");
});
