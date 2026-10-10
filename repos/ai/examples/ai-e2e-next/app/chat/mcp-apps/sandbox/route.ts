const sandboxProxyHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body, iframe {
        width: 100%;
        height: 100%;
        margin: 0;
        border: 0;
        background: transparent;
      }
    </style>
  </head>
  <body>
    <script>
      let appFrame;

      function isJsonRpc(value) {
        return value && value.jsonrpc === '2.0';
      }

      function injectCSP(html, csp) {
        if (!csp) return html;
        const meta = '<meta http-equiv="Content-Security-Policy" content="' +
          csp.replaceAll('"', '&quot;') + '">';
        return html.includes('<head>')
          ? html.replace('<head>', '<head>' + meta)
          : meta + html;
      }

      function createAppFrame(params) {
        appFrame?.remove();
        appFrame = document.createElement('iframe');
        appFrame.sandbox = params.sandbox || 'allow-scripts allow-forms';
        if (params.allow) {
          appFrame.allow = params.allow;
        }
        appFrame.srcdoc = injectCSP(params.html, params.csp);
        document.body.appendChild(appFrame);
      }

      window.addEventListener('message', event => {
        const data = event.data;

        // Only the trusted host window may (re)configure the inner iframe's
        // sandbox and content. Without this source check the untrusted inner
        // frame could forge a resource-ready message to grant itself
        // 'allow-same-origin' and escape to the host origin.
        if (
          isJsonRpc(data) &&
          data.method === 'ui/notifications/sandbox-resource-ready' &&
          event.source === window.parent
        ) {
          createAppFrame(data.params || {});
          return;
        }

        if (isJsonRpc(data) && appFrame && event.source === window.parent) {
          appFrame.contentWindow.postMessage(data, '*');
        } else if (isJsonRpc(data) && event.source === appFrame?.contentWindow) {
          window.parent.postMessage(data, '*');
        }
      });

      window.parent.postMessage({
        jsonrpc: '2.0',
        method: 'ui/notifications/sandbox-proxy-ready'
      }, '*');
    </script>
  </body>
</html>`;

export function GET() {
  return new Response(sandboxProxyHtml, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });
}
