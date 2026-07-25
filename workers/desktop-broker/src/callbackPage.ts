// The desktop's loopback listener accepts a form POST, not a redirect: a 302 to
// http://127.0.0.1:<port>/oauth/callback would arrive as a GET with the tokens in the URL, where
// they would land in browser history and in any referer. So the browser gets a page that posts
// the fields across and then shows the result of that post.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Only loopback targets: the callback carries live connector tokens, and the desktop is the
 *  only thing entitled to them. */
export function isLoopbackRedirect(redirect: string): boolean {
  let url: URL;
  try {
    url = new URL(redirect);
  } catch {
    return false;
  }
  if (url.protocol !== "http:") return false;
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost" && url.hostname !== "[::1]") return false;
  return url.pathname === "/oauth/callback";
}

export function autoPostPage(redirect: string, fields: Record<string, string | undefined>): Response {
  const inputs = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(String(value))}">`)
    .join("\n      ");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Connecting to BoxAI…</title>
    <meta name="robots" content="noindex">
    <style>
      body { font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
             display: flex; align-items: center; justify-content: center; height: 100vh;
             margin: 0; color: #1f2328; background: #f6f7f9; }
      main { text-align: center; }
      noscript { display: block; margin-top: 12px; }
    </style>
  </head>
  <body>
    <main>
      <p>Connecting to BoxAI…</p>
      <form id="deliver" method="POST" action="${escapeHtml(redirect)}">
      ${inputs}
      <noscript><button type="submit">Continue</button></noscript>
      </form>
    </main>
    <script>document.getElementById("deliver").submit();</script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}

/** Consent failures still have to reach the desktop, which shows the reason and cleans up its
 *  pending state — otherwise the app sits on a spinner until the user restarts it. */
export function errorPage(redirect: string | null, error: string, appState = ""): Response {
  if (redirect && isLoopbackRedirect(redirect)) {
    return autoPostPage(redirect, { error, app_state: appState });
  }
  const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Connection failed</title></head>
  <body style="font: 15px/1.5 -apple-system, sans-serif; padding: 40px">
    <h1 style="font-size: 17px">Connection failed</h1>
    <p>${escapeHtml(error)}</p>
    <p>Return to BoxAI and try again.</p>
  </body>
</html>`;
  return new Response(html, { status: 400, headers: { "content-type": "text/html; charset=utf-8" } });
}
