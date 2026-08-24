(function initializeSiteConfig(global) {
  "use strict";

  const DOCS_LINK_SELECTOR = [
    '.nav a[href="/docs"]',
    '.megafoot .col a[href="/docs"]',
  ].join(",");

  function normalizeDocsUrl(value) {
    if (typeof value !== "string" || value.trim() === "") return null;

    try {
      const url = new URL(value.trim());
      return url.protocol === "http:" || url.protocol === "https:"
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }

  async function getDocsUrl(fetcher = global.fetch, timeoutMs = 3000) {
    let timeout;

    try {
      const requestOptions = { headers: { accept: "application/json" } };
      let controller;
      if (typeof global.AbortController === "function") {
        controller = new global.AbortController();
        requestOptions.signal = controller.signal;
      }

      const timeoutResult = new Promise((resolve) => {
        timeout = global.setTimeout(() => {
          if (controller) controller.abort();
          resolve(null);
        }, timeoutMs);
      });
      const response = await Promise.race([
        fetcher("/api/status", requestOptions),
        timeoutResult,
      ]);
      if (!response || !response.ok) return null;

      const payload = await response.json();
      if (!payload || payload.success === false) return null;

      return normalizeDocsUrl(payload.data && payload.data.docs_link);
    } catch {
      return null;
    } finally {
      if (timeout !== undefined) global.clearTimeout(timeout);
    }
  }

  function applyDocsUrl(root, docsUrl) {
    const links = root.querySelectorAll(DOCS_LINK_SELECTOR);
    for (const link of links) {
      link.setAttribute("href", docsUrl);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    }
  }

  async function configureDocsLinks(root = global.document, fetcher = global.fetch) {
    const docsUrl = await getDocsUrl(fetcher);
    if (!docsUrl) return null;

    applyDocsUrl(root, docsUrl);
    return docsUrl;
  }

  global.FlatkeySiteConfig = {
    DOCS_LINK_SELECTOR,
    applyDocsUrl,
    configureDocsLinks,
    getDocsUrl,
    normalizeDocsUrl,
  };

  if (global.document && typeof global.fetch === "function") {
    void configureDocsLinks(global.document, global.fetch.bind(global));
  }
})(globalThis);
