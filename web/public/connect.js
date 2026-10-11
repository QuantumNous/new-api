(function() {
  "use strict";
  const CONNECT_CODES_ISSUE_PATH = "/api/desktop/v2/connect-codes";
  const DEFAULT_DOWNLOAD_URL = "https://yeschoy.com/download";
  class YeschoyConnectError extends Error {
    constructor(reasonCode, httpStatus) {
      super(reasonCode);
      this.name = "YeschoyConnectError";
      this.reasonCode = reasonCode;
      this.httpStatus = httpStatus;
    }
  }
  function pageHttpsOrigin(location) {
    if (location.protocol !== "https:") {
      return null;
    }
    return location.origin;
  }
  function buildConnectDeepLink(origin, code) {
    const params = new URLSearchParams();
    params.set("origin", origin);
    params.set("code", code);
    return `yeschoy://connect?${params.toString()}`;
  }
  async function issueConnectCode(fetchImpl, origin, issuePath) {
    const response = await fetchImpl(issuePath, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin })
    });
    let body;
    try {
      body = await response.json();
    } catch {
      throw new YeschoyConnectError("issue_invalid_response", response.status);
    }
    if (!body || typeof body !== "object" || !("success" in body)) {
      throw new YeschoyConnectError("issue_invalid_response", response.status);
    }
    const envelope = body;
    if (!envelope.success) {
      throw new YeschoyConnectError(envelope.code ?? "issue_failed", response.status);
    }
    const data = envelope.data;
    if (!data || typeof data !== "object") {
      throw new YeschoyConnectError("issue_invalid_response", response.status);
    }
    const record = data;
    if (typeof record.code !== "string" || typeof record.origin !== "string") {
      throw new YeschoyConnectError("issue_invalid_response", response.status);
    }
    return { code: record.code, origin: record.origin };
  }
  function navigateDeepLinkWithDownloadFallback(deepLink, downloadUrl, win, options) {
    let fallbackScheduled = true;
    const clearFallback = () => {
      fallbackScheduled = false;
    };
    const timer = win.setTimeout(() => {
      if (!fallbackScheduled) return;
      options.onFallbackDownload?.();
      win.location.assign(downloadUrl);
    }, options.missingAppTimeoutMs);
    const onBlur = () => {
      win.clearTimeout(timer);
      clearFallback();
      win.removeEventListener?.("blur", onBlur);
    };
    win.addEventListener("blur", onBlur);
    options.onOpening?.();
    win.location.href = deepLink;
  }
  function createYeschoyConnect(defaults = {}) {
    const issuePath = defaults.issuePath ?? CONNECT_CODES_ISSUE_PATH;
    const downloadUrl = defaults.downloadUrl ?? DEFAULT_DOWNLOAD_URL;
    const missingAppTimeoutMs = defaults.missingAppTimeoutMs ?? 2e3;
    const getOrigin = defaults.getOrigin ?? (() => typeof window !== "undefined" ? pageHttpsOrigin(window.location) : null);
    const dispatchPhase = defaults.dispatchPhase ?? (() => {
    });
    async function open(options = {}) {
      const fetchImpl = options.fetchImpl ?? fetch;
      const origin = options.origin ?? getOrigin();
      if (!origin) {
        throw new YeschoyConnectError("connect_origin_not_https");
      }
      const path = options.issuePath ?? issuePath;
      const fallbackUrl = options.downloadUrl ?? downloadUrl;
      const timeoutMs = options.missingAppTimeoutMs ?? missingAppTimeoutMs;
      dispatchPhase("issuing");
      const issued = await issueConnectCode(fetchImpl, origin, path);
      const deepLink = buildConnectDeepLink(issued.origin, issued.code);
      if (typeof window === "undefined") {
        throw new YeschoyConnectError("browser_only");
      }
      navigateDeepLinkWithDownloadFallback(deepLink, fallbackUrl, window, {
        missingAppTimeoutMs: timeoutMs,
        onOpening: () => dispatchPhase("opening"),
        onFallbackDownload: () => dispatchPhase("redirect_download")
      });
    }
    function bindAuto(root = document) {
      const nodes = root.querySelectorAll("[data-yeschoy-connect]");
      nodes.forEach((el) => {
        if (el.dataset.yeschoyConnectBound === "1") return;
        el.dataset.yeschoyConnectBound = "1";
        el.addEventListener("click", (event) => {
          event.preventDefault();
          void open().catch((err) => {
            el.dispatchEvent(
              new CustomEvent("yeschoy-connect-error", {
                detail: err,
                bubbles: true
              })
            );
          });
        });
      });
    }
    return {
      issuePath,
      downloadUrl,
      open,
      bindAuto
    };
  }
  const scriptEl = document.currentScript;
  const downloadOverride = scriptEl instanceof HTMLScriptElement ? scriptEl.dataset.downloadUrl?.trim() : void 0;
  const api = createYeschoyConnect({
    downloadUrl: downloadOverride || void 0
  });
  window.YeschoyConnect = api;
  function init() {
    api.bindAuto();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
