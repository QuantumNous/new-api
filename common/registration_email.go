package common

import (
	"bytes"
	"html/template"
)

type RegistrationVerificationEmail struct {
	Lang            string
	SystemName      string
	Heading         string
	Content         string
	Action          string
	Alternative     string
	CodeLabel       string
	Code            string
	Expiry          string
	IgnoreNotice    string
	Footer          string
	VerificationURL string
}

var registrationVerificationEmailTemplate = template.Must(template.New("registration-verification-email").Parse(`<!doctype html>
<html lang="{{.Lang}}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>{{.Heading}}</title>
  <style>
    @media only screen and (max-width: 640px) {
      .email-shell { padding: 20px 12px !important; }
      .email-content { padding: 32px 24px !important; }
      .email-action { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .verification-code { font-size: 28px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;color:#18181b;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{{.Content}}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4f5f7;">
    <tr>
      <td class="email-shell" align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;">
          <tr>
            <td class="email-content" style="padding:44px 48px 40px;">
              <div style="margin:0 0 32px;color:#18181b;font-size:20px;font-weight:700;line-height:28px;">{{.SystemName}}</div>
              <h1 style="margin:0 0 16px;color:#18181b;font-size:30px;font-weight:700;line-height:38px;letter-spacing:0;">{{.Heading}}</h1>
              <p style="margin:0 0 28px;color:#52525b;font-size:16px;line-height:26px;">{{.Content}}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding:0 0 28px;">
                    <a class="email-action" href="{{.VerificationURL}}" target="_blank" rel="noopener noreferrer" style="display:inline-block;min-height:48px;padding:0 28px;border-radius:6px;background:#6d28d9;color:#ffffff;font-size:16px;font-weight:700;line-height:48px;text-align:center;text-decoration:none;">{{.Action}}</a>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;">
                <tr>
                  <td style="width:34%;border-top:1px solid #e4e4e7;font-size:0;line-height:0;">&nbsp;</td>
                  <td align="center" style="padding:0 12px;color:#71717a;font-size:13px;line-height:20px;white-space:nowrap;">{{.Alternative}}</td>
                  <td style="width:34%;border-top:1px solid #e4e4e7;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
              <div style="margin:0 0 24px;padding:20px;border:1px solid #ddd6fe;border-radius:8px;background:#faf9ff;text-align:center;">
                <div style="margin:0 0 8px;color:#71717a;font-size:12px;font-weight:700;line-height:18px;text-transform:uppercase;">{{.CodeLabel}}</div>
                <div class="verification-code" style="margin:0;color:#3b0764;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:32px;font-weight:700;line-height:40px;letter-spacing:0;user-select:all;">{{.Code}}</div>
              </div>
              <p style="margin:0 0 10px;color:#52525b;font-size:14px;line-height:22px;">{{.Expiry}}</p>
              <p style="margin:0;color:#71717a;font-size:13px;line-height:21px;">{{.IgnoreNotice}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 48px;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px;line-height:18px;text-align:center;">{{.Footer}}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`))

func RenderRegistrationVerificationEmail(data RegistrationVerificationEmail) (string, error) {
	var output bytes.Buffer
	if err := registrationVerificationEmailTemplate.Execute(&output, data); err != nil {
		return "", err
	}
	return output.String(), nil
}
