export const RECALL_EMAIL_ACTIONS = [
  '{{.RecipientName}}',
  '{{.PromotionCodeMasked}}',
  '{{.ProductSummary}}',
  '{{.ExpiresAt}}',
  '{{.ClaimURL}}',
  '{{.UnsubscribeURL}}',
] as const

export const RECALL_EMAIL_STARTER_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Recall offer</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background: #f6f8fb;
        color: #1f2937;
        font-family: Arial, Helvetica, sans-serif;
        line-height: 1.5;
      }
      .container {
        width: 100%;
        max-width: 640px;
        margin: 0 auto;
        padding: 24px;
        background: #ffffff;
      }
      .button {
        display: inline-block;
        padding: 12px 18px;
        border-radius: 6px;
        background: #2563eb;
        color: #ffffff;
        text-decoration: none;
      }
      .footer {
        margin-top: 24px;
        color: #6b7280;
        font-size: 13px;
      }
      @media (max-width: 640px) {
        .container {
          padding: 16px;
        }
        .button {
          display: block;
          text-align: center;
        }
      }
    </style>
  </head>
  <body>
    <main class="container">
      <p>Hello {{.RecipientName}},</p>
      <p>Your account offer is ready to review.</p>
      <p>We saved an offer for {{.ProductSummary}}. Use promotion code {{.PromotionCodeMasked}} before {{.ExpiresAt}}.</p>
      <p><a class="button" href="{{.ClaimURL}}">Claim your offer</a></p>
      <p class="footer"><a href="{{.UnsubscribeURL}}">Unsubscribe</a></p>
    </main>
  </body>
</html>`

function escapeRecallHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function convertRecallBodyTextToHtml(bodyText: string): string {
  const paragraphs = bodyText
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeRecallHtml(paragraph)}</p>`)
    .join('\n      ')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Recall offer</title>
  </head>
  <body>
    <main>
      ${paragraphs || '<p>Hello {{.RecipientName}},</p>'}
      <p><a href="{{.ClaimURL}}">Claim your offer</a></p>
      <p><a href="{{.UnsubscribeURL}}">Unsubscribe</a></p>
    </main>
  </body>
</html>`
}

export function normalizeRecallBodyInputToHtml(bodyInput: string): string {
  const trimmed = bodyInput.trim()
  if (/<\/?[a-z][\w:-]*(?:\s[^<>]*)?>/i.test(trimmed)) {
    return bodyInput
  }
  return convertRecallBodyTextToHtml(bodyInput)
}

export function insertRecallEmailAction(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: (typeof RECALL_EMAIL_ACTIONS)[number]
): { value: string; selection: number } {
  const clamp = (selection: number) =>
    Math.max(0, Math.min(value.length, Math.trunc(selection)))
  const start = clamp(Math.min(selectionStart, selectionEnd))
  const end = clamp(Math.max(selectionStart, selectionEnd))
  return {
    value: `${value.slice(0, start)}${action}${value.slice(end)}`,
    selection: start + action.length,
  }
}
