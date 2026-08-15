/**
 * Optional proxy enforcement for Cursor SDK.
 *
 * Direct-egress hosts: leave OFF (default).
 * CN / laptop dev: set CURSOR_AGENT_FORCE_PROXY=1 and/or CURSOR_AGENT_PROXY.
 *
 * Activation (any one):
 *   - CURSOR_AGENT_FORCE_PROXY=1
 *   - CURSOR_AGENT_PROXY=<url> explicitly set
 *   - FORCE_PROXY=1
 *
 * When inactive: only light Cursor.configure (useHttp1 optional, default false).
 */
import { ProxyAgent, setGlobalDispatcher } from "undici";
import { Cursor } from "@cursor/sdk";

const DEFAULT_PROXY = "http://127.0.0.1:7890";

function truthy(v) {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function shouldForceProxy() {
  if (truthy(process.env.CURSOR_AGENT_FORCE_PROXY)) return true;
  if (truthy(process.env.FORCE_PROXY)) return true;
  // Explicit proxy URL set by operator (not merely inherited empty).
  if (String(process.env.CURSOR_AGENT_PROXY || "").trim()) return true;
  return false;
}

function resolveProxyUrl() {
  const raw =
    process.env.CURSOR_AGENT_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy ||
    DEFAULT_PROXY;
  const u = String(raw).trim();
  if (!u) return DEFAULT_PROXY;
  if (/^(https?|socks5?):\/\//i.test(u)) return u;
  return `http://${u}`;
}

export function forceCursorProxy(options = {}) {
  const enabled =
    options.enabled !== undefined ? options.enabled : shouldForceProxy();
  const useHttp1 =
    options.useHttp1ForAgent !== undefined
      ? options.useHttp1ForAgent
      : truthy(process.env.CURSOR_AGENT_FORCE_HTTP1);

  if (!enabled) {
    // US default: no proxy patching. Optionally still force HTTP/1 if asked.
    if (useHttp1) {
      try {
        Cursor.configure({ local: { useHttp1ForAgent: true } });
      } catch (err) {
        console.error("[force_proxy] Cursor.configure failed:", err?.message || err);
      }
    }
    console.log(
      `[force_proxy] inactive (US-friendly default). Set CURSOR_AGENT_FORCE_PROXY=1 or CURSOR_AGENT_PROXY=... for CN/dev.`
    );
    return { enabled: false, proxyUrl: null, useHttp1 };
  }

  const proxyUrl = options.proxyUrl || resolveProxyUrl();

  process.env.HTTP_PROXY = proxyUrl;
  process.env.HTTPS_PROXY = proxyUrl;
  process.env.http_proxy = proxyUrl;
  process.env.https_proxy = proxyUrl;
  process.env.ALL_PROXY = proxyUrl;
  process.env.all_proxy = proxyUrl;
  process.env.NODE_USE_ENV_PROXY = "1";
  if (!process.env.NO_PROXY) {
    process.env.NO_PROXY = "localhost,127.0.0.1,::1,*.local";
    process.env.no_proxy = process.env.NO_PROXY;
  }

  try {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
  } catch (err) {
    console.error("[force_proxy] undici ProxyAgent failed:", err?.message || err);
  }

  // When forcing proxy, HTTP/1 is on by default (HTTP/2 often bypasses proxy).
  const http1 = useHttp1 || process.env.CURSOR_AGENT_FORCE_HTTP1 !== "0";
  try {
    Cursor.configure({
      local: {
        useHttp1ForAgent: http1,
      },
    });
  } catch (err) {
    console.error("[force_proxy] Cursor.configure failed:", err?.message || err);
  }

  console.log(
    `[force_proxy] ACTIVE proxy=${proxyUrl} useHttp1ForAgent=${http1} NODE_USE_ENV_PROXY=1`
  );
  return { enabled: true, proxyUrl, useHttp1: http1 };
}

forceCursorProxy();
