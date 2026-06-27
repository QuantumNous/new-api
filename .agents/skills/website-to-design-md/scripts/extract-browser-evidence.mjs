#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const url = process.argv[2];
const outPath = process.argv[3];

if (!url) {
  console.error("Usage: node scripts/extract-browser-evidence.mjs <url> [outPath]");
  process.exit(1);
}

const targetCwd = process.cwd();
const outFile = outPath
  ? path.resolve(targetCwd, outPath)
  : path.join(os.tmpdir(), `website-design-evidence-${Date.now()}.json`);

const viewports = [
  { name: "desktop", width: 1440, height: 1400, deviceScaleFactor: 1 },
  { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
];

const mobileUserAgent =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const styleProbe = `
  (() => {
    const clean = (value) => (value || "").replace(/\\s+/g, " ").trim();
    const isVisible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const truncate = (value, limit = 4000) => {
      const text = value || "";
      return text.length > limit ? text.slice(0, limit) + "\\n<!-- truncated -->" : text;
    };
    const attrsOf = (el) => {
      if (!el) return {};
      return Object.fromEntries(
        [...el.attributes]
          .slice(0, 24)
          .map((attr) => [attr.name, clean(attr.value).slice(0, 300)])
      );
    };
    const styleOf = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        text: clean(el.textContent).slice(0, 160),
        className: clean(el.className).slice(0, 200),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        color: s.color,
        backgroundColor: s.backgroundColor,
        borderColor: s.borderColor,
        borderRadius: s.borderRadius,
        boxShadow: s.boxShadow,
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing,
        textTransform: s.textTransform,
        textDecoration: s.textDecorationLine,
        padding: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].join(" "),
        margin: [s.marginTop, s.marginRight, s.marginBottom, s.marginLeft].join(" "),
        gap: s.gap,
        display: s.display,
        position: s.position,
        html: truncate(el.outerHTML, 2400),
        attrs: attrsOf(el),
      };
    };
    const collectCssVariables = (style) =>
      [...style]
        .filter((name) => name.startsWith("--"))
        .slice(0, 160)
        .reduce((acc, name) => {
          const value = clean(style.getPropertyValue(name));
          if (value) acc[name] = value;
          return acc;
        }, {});
    const readableCssRules = () => {
      const sheets = [];
      for (const sheet of [...document.styleSheets].slice(0, 40)) {
        const entry = {
          href: sheet.href || null,
          ownerNode: sheet.ownerNode?.tagName?.toLowerCase() || null,
          rules: [],
          inaccessible: false,
        };
        try {
          const rules = [...sheet.cssRules].slice(0, 80);
          entry.rules = rules.map((rule) => clean(rule.cssText).slice(0, 700));
        } catch {
          entry.inaccessible = true;
        }
        sheets.push(entry);
      }
      return sheets;
    };
    const sampleKeyNodes = (selector, limit = 8) =>
      [...document.querySelectorAll(selector)]
        .filter(isVisible)
        .slice(0, limit)
        .map((el) => ({
          selector,
          ...styleOf(el),
        }));
    const sampleVisible = (selector, limit = 12) =>
      [...document.querySelectorAll(selector)]
        .filter(isVisible)
        .slice(0, limit)
        .map(styleOf);
    const nav = [...document.querySelectorAll("header, nav")].find(isVisible);
    const footer = [...document.querySelectorAll("footer")].find(isVisible);
    const heroHeading = [...document.querySelectorAll("h1")].find(isVisible);
    const heroText = heroHeading?.closest("section, div");
    const cards = [...document.querySelectorAll("section div, li, article")]
      .filter((el) => isVisible(el) && /border|shadow|rounded|card/i.test(el.className || ""))
      .slice(0, 8)
      .map(styleOf);
    const headings = sampleVisible("h1, h2, h3", 16);
    const buttons = sampleVisible("button, a", 20).filter((item) => item.text && item.text.length < 80);
    const sections = [...document.querySelectorAll("main > *, section")]
      .filter(isVisible)
      .slice(0, 16)
      .map((el) => {
        const s = getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          text: clean(el.textContent).slice(0, 120),
          backgroundColor: s.backgroundColor,
          borderColor: s.borderColor,
          minHeight: s.minHeight,
          paddingTop: s.paddingTop,
          paddingBottom: s.paddingBottom,
          html: truncate(el.outerHTML, 2600),
        };
      });
    const dom = {
      htmlLang: document.documentElement.lang || null,
      bodyClass: clean(document.body.className),
      bodyAttributes: attrsOf(document.body),
      rootVariables: collectCssVariables(getComputedStyle(document.documentElement)),
      bodyVariables: collectCssVariables(getComputedStyle(document.body)),
      inlineStyles: [...document.querySelectorAll("style")]
        .slice(0, 24)
        .map((node) => truncate(node.textContent, 2400)),
      styleSheets: readableCssRules(),
      headHtml: truncate(document.head.innerHTML, 10000),
      bodyHtmlStart: truncate(document.body.innerHTML, 12000),
      mainHtml: truncate(document.querySelector("main")?.outerHTML || "", 16000),
      keyNodes: {
        header: sampleKeyNodes("header, nav", 4),
        headings: sampleKeyNodes("h1, h2, h3", 12),
        buttons: sampleKeyNodes("button, a", 16),
        cards: sampleKeyNodes("article, [class*='card'], [class*='panel']", 12),
      },
    };
    const fonts = [...new Set(
      [...document.querySelectorAll("body, body *")]
        .slice(0, 600)
        .map((el) => getComputedStyle(el).fontFamily)
        .filter(Boolean)
    )];
    const colors = [...new Set(
      [...document.querySelectorAll("body, body *")]
        .slice(0, 400)
        .flatMap((el) => {
          const s = getComputedStyle(el);
          return [s.color, s.backgroundColor, s.borderColor];
        })
        .filter((value) => value && value !== "rgba(0, 0, 0, 0)" && value !== "transparent")
    )].slice(0, 60);
    const textSnippets = [...document.querySelectorAll("h1, h2, h3, p, a, button, span")]
      .filter(isVisible)
      .map((el) => clean(el.textContent))
      .filter(Boolean)
      .slice(0, 80);

    return {
      title: document.title,
      url: location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      root: styleOf(document.documentElement),
      body: styleOf(document.body),
      nav: styleOf(nav),
      footer: styleOf(footer),
      heroHeading: styleOf(heroHeading),
      heroContainer: styleOf(heroText),
      headings,
      buttons,
      cards,
      sections,
      fonts,
      colors,
      textSnippets,
      dom,
      documentHeight: document.documentElement.scrollHeight,
      imageCount: document.querySelectorAll("img, picture, svg").length,
    };
  })()
`;

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function which(binary) {
  const result = run("bash", ["-lc", `command -v ${binary}`]);
  if (!result.ok || !result.stdout) {
    return null;
  }
  return result.stdout.split("\n")[0].trim();
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function detectTooling(cwd) {
  const agentBrowserPath = which("agent-browser");
  const chromeCandidates = [
    which("google-chrome"),
    which("chrome"),
    which("chromium"),
    which("chromium-browser"),
    fileExists("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : null,
    fileExists("/Applications/Chromium.app/Contents/MacOS/Chromium")
      ? "/Applications/Chromium.app/Contents/MacOS/Chromium"
      : null,
  ].filter(Boolean);

  const localPlaywright = fileExists(path.join(cwd, "node_modules", ".bin", "playwright"))
    ? path.join(cwd, "node_modules", ".bin", "playwright")
    : null;

  return {
    agentBrowserPath,
    chromePath: chromeCandidates[0] ?? null,
    chromeCandidates,
    localPlaywright,
    globalPlaywright: which("playwright"),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDir(filePath) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
}

function lastNonEmptyLine(value) {
  return `${value ?? ""}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .pop() ?? "";
}

function parseJsonOutput(stdout, label = "JSON output") {
  const text = `${stdout ?? ""}`.trim();
  if (!text) {
    throw new Error(`${label} was empty`);
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      // keep scanning upward in case the CLI printed extra lines
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} was not valid JSON:\n${text.slice(-800)}`);
  }
}

function runAgentBrowser(agentBrowserPath, sessionId, args, options = {}) {
  const result = run(agentBrowserPath, ["--session", sessionId, ...args], {
    input: options.input,
  });

  if (!options.allowFailure && !result.ok) {
    const detail = result.stderr || result.stdout || `agent-browser ${args.join(" ")} failed`;
    throw new Error(detail);
  }

  return result;
}

async function evaluateAgentBrowserJson(agentBrowserPath, sessionId, expression) {
  const result = runAgentBrowser(agentBrowserPath, sessionId, ["eval", "--stdin"], {
    input: `${expression}\n`,
  });
  return parseJsonOutput(result.stdout, "agent-browser eval output");
}

async function evaluateAgentBrowserText(agentBrowserPath, sessionId, expression, options = {}) {
  const result = runAgentBrowser(agentBrowserPath, sessionId, ["eval", "--stdin"], {
    input: `${expression}\n`,
    allowFailure: options.allowFailure ?? false,
  });
  return lastNonEmptyLine(result.stdout);
}

async function scrollSweepAgentBrowser(agentBrowserPath, sessionId) {
  await evaluateAgentBrowserText(agentBrowserPath, sessionId, "window.scrollTo(0, 0); 'ok';", { allowFailure: true });
  runAgentBrowser(agentBrowserPath, sessionId, ["wait", "200"], { allowFailure: true });
  runAgentBrowser(agentBrowserPath, sessionId, ["scroll", "down", "1400"], { allowFailure: true });
  runAgentBrowser(agentBrowserPath, sessionId, ["wait", "300"], { allowFailure: true });
  runAgentBrowser(agentBrowserPath, sessionId, ["scroll", "down", "2200"], { allowFailure: true });
  runAgentBrowser(agentBrowserPath, sessionId, ["wait", "300"], { allowFailure: true });
  await evaluateAgentBrowserText(agentBrowserPath, sessionId, "window.scrollTo(0, 0); 'ok';", { allowFailure: true });
  runAgentBrowser(agentBrowserPath, sessionId, ["wait", "300"], { allowFailure: true });
}

async function extractWithAgentBrowser(urlToRead, agentBrowserPath) {
  const sessionId = `website-design-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    runAgentBrowser(agentBrowserPath, sessionId, ["open", urlToRead]);
    runAgentBrowser(agentBrowserPath, sessionId, ["wait", "--load", "networkidle"], { allowFailure: true });
    runAgentBrowser(agentBrowserPath, sessionId, ["wait", "1500"], { allowFailure: true });
    await scrollSweepAgentBrowser(agentBrowserPath, sessionId);

    const desktop = await evaluateAgentBrowserJson(agentBrowserPath, sessionId, `JSON.stringify(${styleProbe})`);
    const finalUrl =
      (await evaluateAgentBrowserText(agentBrowserPath, sessionId, "location.href", { allowFailure: true })) || urlToRead;
    const title =
      (await evaluateAgentBrowserText(agentBrowserPath, sessionId, "document.title", { allowFailure: true })) ||
      desktop.title ||
      "";

    desktop.title = title;
    desktop.meta = {
      finalUrl,
      contentLength: desktop.dom?.bodyHtmlStart?.length ?? null,
    };

    return {
      extractedAt: new Date().toISOString(),
      url: urlToRead,
      pages: {
        desktop,
      },
      interactions: {},
      tooling: {
        selectedTool: "agent-browser-eval",
        browserPath: agentBrowserPath,
        sessionId,
      },
    };
  } finally {
    runAgentBrowser(agentBrowserPath, sessionId, ["close"], { allowFailure: true });
  }
}

class CdpConnection {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 0;
    this.pending = new Map();
    this.openPromise = null;
  }

  async open() {
    if (this.ws) {
      return;
    }

    this.ws = new WebSocket(this.wsUrl);
    this.openPromise = new Promise((resolve, reject) => {
      const cleanup = () => {
        this.ws?.removeEventListener("open", onOpen);
        this.ws?.removeEventListener("error", onError);
      };
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = (error) => {
        cleanup();
        reject(error);
      };
      this.ws.addEventListener("open", onOpen, { once: true });
      this.ws.addEventListener("error", onError, { once: true });
    });

    this.ws.addEventListener("message", (event) => {
      const payload = JSON.parse(String(event.data));
      if (!payload.id) {
        return;
      }
      const entry = this.pending.get(payload.id);
      if (!entry) {
        return;
      }
      this.pending.delete(payload.id);
      if (payload.error) {
        entry.reject(new Error(payload.error.message || "Unknown CDP error"));
        return;
      }
      entry.resolve(payload.result ?? {});
    });

    this.ws.addEventListener("close", () => {
      for (const [id, entry] of this.pending.entries()) {
        entry.reject(new Error(`CDP connection closed while waiting for message ${id}`));
      }
      this.pending.clear();
    });

    await this.openPromise;
  }

  async send(method, params = {}, sessionId = null, timeout = 30000) {
    await this.open();
    const id = ++this.nextId;
    const payload = { id, method, params };
    if (sessionId) {
      payload.sessionId = sessionId;
    }

    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout for ${method}`));
      }, timeout);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });

      this.ws.send(JSON.stringify(payload));
    });
  }

  async close() {
    if (!this.ws || this.ws.readyState >= WebSocket.CLOSING) {
      return;
    }
    this.ws.close();
    await sleep(50);
  }
}

async function waitForDevToolsPort(userDataDir, timeoutMs = 10000) {
  const portFile = path.join(userDataDir, "DevToolsActivePort");
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const content = await fsp.readFile(portFile, "utf8");
      const [port] = content.trim().split(/\r?\n/);
      if (port) {
        return port.trim();
      }
    } catch {
      // keep polling
    }
    await sleep(100);
  }

  throw new Error("Chrome DevTools port was not exposed in time");
}

function launchChrome(chromePath) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "website-design-chrome-"));
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-sync",
    "--remote-debugging-port=0",
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ];

  const proc = spawn(chromePath, args, {
    stdio: ["ignore", "ignore", "pipe"],
  });

  let stderr = "";
  proc.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  return {
    proc,
    userDataDir,
    getStderr: () => stderr,
  };
}

async function killChrome(proc, userDataDir) {
  if (proc && proc.exitCode === null && !proc.killed) {
    proc.kill("SIGTERM");
    await sleep(250);
    if (proc.exitCode === null) {
      proc.kill("SIGKILL");
    }
  }

  if (userDataDir) {
    await fsp.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function waitForReadyState(conn, sessionId, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const state = await evaluateValue(conn, sessionId, "document.readyState");
      if (state === "complete") {
        return;
      }
    } catch {
      // continue polling
    }
    await sleep(250);
  }
}

async function evaluateValue(conn, sessionId, expression, timeout = 30000) {
  const result = await conn.send(
    "Runtime.evaluate",
    {
      expression,
      returnByValue: true,
      awaitPromise: true,
    },
    sessionId,
    timeout
  );

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  }

  return result.result?.value;
}

async function evaluateObject(conn, sessionId, expression, timeout = 30000) {
  return await evaluateValue(conn, sessionId, expression, timeout);
}

async function scrollSweepCdp(conn, sessionId) {
  await evaluateValue(conn, sessionId, "window.scrollTo(0, 0)");
  await sleep(200);
  await evaluateValue(conn, sessionId, "window.scrollBy(0, 1400)");
  await sleep(300);
  await evaluateValue(conn, sessionId, "window.scrollBy(0, 2200)");
  await sleep(300);
  await evaluateValue(conn, sessionId, "window.scrollTo(0, 0)");
  await sleep(300);
}

function hoverProbe(text) {
  return `(() => {
    const clean = (value) => (value || "").replace(/\\s+/g, " ").trim();
    const isVisible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const styleOf = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      return {
        text: clean(el.textContent),
        color: s.color,
        backgroundColor: s.backgroundColor,
        borderColor: s.borderColor,
        boxShadow: s.boxShadow,
        transform: s.transform,
      };
    };
    const needle = ${JSON.stringify(text)};
    const target = [...document.querySelectorAll("a, button")]
      .find((el) => isVisible(el) && clean(el.textContent).includes(needle));
    if (!target) return null;
    target.scrollIntoView({ block: "center", inline: "center" });
    const rect = target.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      style: styleOf(target),
    };
  })()`;
}

async function hoverStateCdp(conn, sessionId, text) {
  const before = await evaluateObject(conn, sessionId, hoverProbe(text));
  if (!before) {
    return null;
  }

  await conn.send(
    "Input.dispatchMouseEvent",
    { type: "mouseMoved", x: before.x, y: before.y, button: "none" },
    sessionId
  );
  await sleep(150);

  const after = await evaluateObject(conn, sessionId, hoverProbe(text));
  return {
    before: before.style,
    after: after?.style ?? before.style,
  };
}

async function extractWithChrome(urlToRead, chromePath) {
  const launched = launchChrome(chromePath);
  let conn = null;

  try {
    const port = await waitForDevToolsPort(launched.userDataDir);
    const versionInfo = await fetch(`http://127.0.0.1:${port}/json/version`).then((res) => res.json());
    conn = new CdpConnection(versionInfo.webSocketDebuggerUrl);
    await conn.open();

    const results = {
      extractedAt: new Date().toISOString(),
      url: urlToRead,
      pages: {},
      interactions: {},
      tooling: {
        selectedTool: "chrome-cli",
        browserPath: chromePath,
      },
    };

    for (const viewport of viewports) {
      const { targetId } = await conn.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await conn.send("Target.attachToTarget", { targetId, flatten: true });

      await conn.send("Page.enable", {}, sessionId);
      await conn.send("Runtime.enable", {}, sessionId);
      await conn.send("Network.enable", {}, sessionId);
      await conn.send(
        "Emulation.setDeviceMetricsOverride",
        {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
          mobile: Boolean(viewport.isMobile),
        },
        sessionId
      );

      if (viewport.isMobile) {
        await conn.send(
          "Network.setUserAgentOverride",
          {
            userAgent: mobileUserAgent,
          },
          sessionId
        );
        await conn.send(
          "Emulation.setTouchEmulationEnabled",
          { enabled: true, maxTouchPoints: 5 },
          sessionId
        );
      }

      await conn.send("Page.navigate", { url: urlToRead }, sessionId, 120000);
      await waitForReadyState(conn, sessionId, 60000);
      await sleep(1800);
      await scrollSweepCdp(conn, sessionId);

      results.pages[viewport.name] = await evaluateObject(conn, sessionId, styleProbe, 60000);
      results.pages[viewport.name].meta = {
        finalUrl: await evaluateValue(conn, sessionId, "location.href"),
        contentLength: await evaluateValue(conn, sessionId, "document.documentElement.outerHTML.length"),
      };

      if (viewport.name === "desktop") {
        results.interactions.startDeploying = await hoverStateCdp(conn, sessionId, "Start Deploying");
        results.interactions.getDemo = await hoverStateCdp(conn, sessionId, "Get a Demo");
        results.interactions.talkToExpert = await hoverStateCdp(conn, sessionId, "Talk to an Expert");
      }

      await conn.send("Target.closeTarget", { targetId });
    }

    return results;
  } catch (error) {
    const stderr = launched.getStderr();
    const detail = stderr ? `${error.message}\n${stderr}` : error.message;
    throw new Error(`Chrome extraction failed: ${detail}`);
  } finally {
    if (conn) {
      await conn.close().catch(() => {});
    }
    await killChrome(launched.proc, launched.userDataDir);
  }
}

async function loadPlaywrightFrom(targetPath) {
  const localRequire = createRequire(path.join(targetPath, "__codex_playwright_loader__.cjs"));
  try {
    return localRequire("playwright");
  } catch {
    // continue
  }

  try {
    const globalRoot = run("npm", ["root", "-g"]).stdout;
    if (globalRoot) {
      const globalRequire = createRequire(path.join(globalRoot, "playwright", "package.json"));
      return globalRequire("playwright");
    }
  } catch {
    // continue
  }

  const hereRequire = createRequire(import.meta.url);
  return hereRequire("playwright");
}

async function hoverStatePlaywright(page, text) {
  const locator = page.locator("a:visible, button:visible").filter({ hasText: text }).first();
  if ((await locator.count()) === 0) {
    return null;
  }

  const getStyle = async () =>
    locator.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        text: (el.textContent || "").replace(/\s+/g, " ").trim(),
        color: s.color,
        backgroundColor: s.backgroundColor,
        borderColor: s.borderColor,
        boxShadow: s.boxShadow,
        transform: s.transform,
      };
    });

  const before = await getStyle();
  await locator.scrollIntoViewIfNeeded();
  let after = before;
  try {
    await locator.hover();
    await page.waitForTimeout(150);
    after = await getStyle();
  } catch {
    after = before;
  }

  return { before, after };
}

async function extractWithPlaywright(urlToRead, cwd) {
  const { chromium } = await loadPlaywrightFrom(cwd);
  const browser = await chromium.launch({ headless: true });

  try {
    const results = {
      extractedAt: new Date().toISOString(),
      url: urlToRead,
      pages: {},
      interactions: {},
      tooling: {
        selectedTool: "playwright",
      },
    };

    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.isMobile ?? false,
        hasTouch: viewport.hasTouch ?? false,
        userAgent: viewport.isMobile ? mobileUserAgent : undefined,
      });

      const page = await context.newPage();
      await page.goto(urlToRead, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(1800);
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(200);
      await page.mouse.wheel(0, 1400);
      await page.waitForTimeout(300);
      await page.mouse.wheel(0, 2200);
      await page.waitForTimeout(300);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);

      results.pages[viewport.name] = await page.evaluate(styleProbe);
      results.pages[viewport.name].meta = {
        finalUrl: page.url(),
        contentLength: (await page.content()).length,
      };

      if (viewport.name === "desktop") {
        results.interactions.startDeploying = await hoverStatePlaywright(page, "Start Deploying");
        results.interactions.getDemo = await hoverStatePlaywright(page, "Get a Demo");
        results.interactions.talkToExpert = await hoverStatePlaywright(page, "Talk to an Expert");
      }

      await context.close();
    }

    return results;
  } finally {
    await browser.close();
  }
}

async function main() {
  const tooling = detectTooling(targetCwd);
  if (!tooling.agentBrowserPath) {
    throw new Error(
      "`agent-browser` is not available in PATH. This extractor now requires agent-browser and does not fall back to Playwright or Chrome CLI."
    );
  }

  const results = await extractWithAgentBrowser(url, tooling.agentBrowserPath);
  results.tooling = {
    ...(results.tooling ?? {}),
    preferredOrder: ["agent-browser-eval"],
    agentBrowserPath: tooling.agentBrowserPath,
    fallbackNotes: [],
  };

  await ensureDir(outFile);
  await fsp.writeFile(outFile, JSON.stringify(results, null, 2));
  console.log(outFile);
}

await main();
