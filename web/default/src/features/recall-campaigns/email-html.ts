export const RECALL_EMAIL_ACTIONS = [
  '{{.RecipientName}}',
  '{{.PromotionCodeMasked}}',
  '{{.ProductSummary}}',
  '{{.ExpiresAt}}',
  '{{.ClaimURL}}',
  '{{.UnsubscribeURL}}',
] as const

export const RECALL_CONTENT_ONLY_EMAIL_ACTIONS = [
  '{{.RecipientName}}',
  '{{.UnsubscribeURL}}',
] as const

export const RECALL_EMAIL_ACTION_DESCRIPTIONS: Record<
  (typeof RECALL_EMAIL_ACTIONS)[number],
  string
> = {
  '{{.RecipientName}}':
    "Recipient's display name, or username when no display name is set.",
  '{{.PromotionCodeMasked}}': 'Masked promotion code, for example SAVE****25.',
  '{{.ProductSummary}}':
    'Selected top-up amounts and subscription plan names and prices; internal product IDs are never shown.',
  '{{.ExpiresAt}}': 'Promotion expiration time, displayed in UTC.',
  '{{.ClaimURL}}':
    'Personal link that opens the top-up page and claims the offer.',
  '{{.UnsubscribeURL}}':
    'Personal link that stops future recall emails for this recipient.',
}

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

export const RECALL_CONTENT_ONLY_EMAIL_STARTER_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Flatkey update</title>
    <style>
      @media only screen and (max-width: 640px) {
        .flatkey-container {
          width: 100% !important;
          max-width: 100% !important;
        }
        .flatkey-content {
          padding: 24px !important;
        }
        .flatkey-title {
          font-size: 32px !important;
          line-height: 1.12 !important;
        }
        .flatkey-subtitle {
          font-size: 24px !important;
          line-height: 1.35 !important;
        }
        .flatkey-body {
          font-size: 18px !important;
        }
        .flatkey-cta-wrap,
        .flatkey-cta {
          width: 100% !important;
        }
        .flatkey-cta {
          display: block !important;
          box-sizing: border-box !important;
          text-align: center !important;
        }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background: #f5f6f8; color: #172033; font-family: Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background: #f5f6f8;">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" width="680" cellpadding="0" cellspacing="0" class="flatkey-container" style="width: 100%; max-width: 680px; border-collapse: collapse; background: #ffffff;">
            <tr>
              <td class="flatkey-content" style="padding: 52px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                  <tr>
                    <td style="padding: 0 0 28px;">
                      <div style="font-size: 15px; font-weight: 700; color: #0f83ee; letter-spacing: 0; text-transform: uppercase;">Flatkey</div>
                    </td>
                  </tr>
                  <tr>
                    <td class="flatkey-title" style="padding: 0; color: #172033; font-size: 46px; line-height: 1.08; font-weight: 700;">
                      A new Flatkey update is ready
                    </td>
                  </tr>
                  <tr>
                    <td class="flatkey-subtitle" style="padding: 22px 0 0; color: #5d687c; font-size: 28px; line-height: 1.35; font-weight: 400;">
                      Built for teams that need faster access, clearer usage controls, and less time spent on setup.
                    </td>
                  </tr>
                  <tr>
                    <td class="flatkey-body" style="padding: 34px 0 0; color: #172033; font-size: 21px; line-height: 1.7;">
                      Hello {{.RecipientName}},
                    </td>
                  </tr>
                  <tr>
                    <td class="flatkey-body" style="padding: 18px 0 0; color: #172033; font-size: 21px; line-height: 1.7;">
                      We have a product announcement to share with your workspace. Edit this section with the launch details, customer value, and the next step you want readers to take.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 34px 0 0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background: #eef6ff; border: 1px solid #c7e2ff;">
                        <tr>
                          <td class="flatkey-body" style="padding: 36px; color: #172033; font-size: 21px; line-height: 1.7;">
                            Replace this info card with the release highlights, rollout notes, or availability details your audience needs before they click through.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 38px 0 0;">
                      <table role="presentation" cellpadding="0" cellspacing="0" class="flatkey-cta-wrap" style="border-collapse: collapse;">
                        <tr>
                          <td style="border-radius: 8px; background: #0f83ee;">
                            <a class="flatkey-cta" href="https://flatkey.com" style="display: inline-block; padding: 16px 28px; border-radius: 8px; background: #0f83ee; color: #ffffff; font-size: 18px; font-weight: 700; line-height: 1.2; text-decoration: none;">Read the announcement</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td class="flatkey-body" style="padding: 38px 0 0; color: #172033; font-size: 21px; line-height: 1.7; text-align: right;">
                      The Flatkey team
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 28px 0 0; color: #5d687c; font-size: 14px; line-height: 1.6; text-align: right;">
                      <a href="{{.UnsubscribeURL}}" style="color: #5d687c; text-decoration: underline;">Unsubscribe</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
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
