package common

import (
	"fmt"
	"html"
	"strings"
)

// BrandEmailData describes a single DeepRouter transactional email.
// All user-facing copy must be English (see docs/DESIGN.md + customer-facing rules).
type BrandEmailData struct {
	Preheader   string // hidden inbox-preview line
	Title       string // H1 inside the card
	Intro       string // paragraph under the title
	CodeValue   string // optional: large verification code block
	ButtonText  string // optional: CTA button label
	ButtonURL   string // optional: CTA button target
	FallbackURL string // optional: raw link shown when the button cannot be clicked
	Footnote    string // small note (expiry + "ignore if not you")
	LogoURL     string // absolute URL to logo-full.png; falls back to a text wordmark when empty
}

// DeepRouter brand tokens (docs/DESIGN.md §1).
const (
	emailBgCream   = "#F7F4ED"
	emailCardSurf  = "#FCFBF8"
	emailCharcoal  = "#1C1C1C"
	emailMutedText = "#5F5F5D"
	emailBorder    = "#ECEAE4"
	emailAIBlue    = "#2563FF"
	emailFontStack = "'Plus Jakarta Sans','Public Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
	emailMonoStack = "'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace"
	emailSiteURL   = "https://deeprouter.co"
	emailSiteLabel = "deeprouter.co"
)

// RenderBrandEmail wraps transactional copy in the DeepRouter-branded HTML shell.
// The output is a complete, inline-styled HTML document safe to hand to SendEmail.
func RenderBrandEmail(d BrandEmailData) string {
	var b strings.Builder

	// Header: logo lockup (image when available, otherwise a charcoal wordmark).
	header := fmt.Sprintf(
		`<span style="font-family:%s;font-size:20px;font-weight:600;color:%s;letter-spacing:-0.2px;">Deep<span style="color:%s;">Router</span></span>`,
		emailFontStack, emailCharcoal, emailAIBlue)
	if d.LogoURL != "" {
		header = fmt.Sprintf(
			`<img src="%s" alt="%s" width="180" style="display:block;width:180px;max-width:60%%;height:auto;border:0;outline:none;text-decoration:none;" />`,
			html.EscapeString(d.LogoURL), html.EscapeString(SystemName))
	}

	b.WriteString(fmt.Sprintf(`<!DOCTYPE html><html lang="en"><head>`+
		`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`+
		`<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">`+
		`<title>%s</title></head>`, html.EscapeString(d.Title)))

	b.WriteString(fmt.Sprintf(`<body style="margin:0;padding:0;background-color:%s;">`, emailBgCream))

	// Hidden preheader (inbox preview text).
	if d.Preheader != "" {
		b.WriteString(fmt.Sprintf(
			`<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:%s;font-size:1px;line-height:1px;">%s</div>`,
			emailBgCream, html.EscapeString(d.Preheader)))
	}

	b.WriteString(fmt.Sprintf(
		`<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="background-color:%s;">`+
			`<tr><td align="center" style="padding:40px 16px;">`+
			`<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%%;">`,
		emailBgCream))

	// Logo row.
	b.WriteString(fmt.Sprintf(
		`<tr><td align="left" style="padding:0 8px 24px 8px;">%s</td></tr>`, header))

	// Card.
	b.WriteString(fmt.Sprintf(
		`<tr><td style="background-color:%s;border:1px solid %s;border-radius:12px;padding:40px;">`,
		emailCardSurf, emailBorder))

	b.WriteString(fmt.Sprintf(
		`<h1 style="margin:0 0 16px 0;font-family:%s;font-size:24px;line-height:32px;font-weight:600;color:%s;">%s</h1>`,
		emailFontStack, emailCharcoal, html.EscapeString(d.Title)))

	b.WriteString(fmt.Sprintf(
		`<p style="margin:0 0 24px 0;font-family:%s;font-size:16px;line-height:24px;color:%s;">%s</p>`,
		emailFontStack, emailMutedText, html.EscapeString(d.Intro)))

	// Optional verification-code block.
	if d.CodeValue != "" {
		b.WriteString(fmt.Sprintf(
			`<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" `+
				`style="background-color:%s;border:1px solid %s;border-radius:8px;padding:20px;">`+
				`<span style="font-family:%s;font-size:32px;line-height:36px;font-weight:600;letter-spacing:8px;color:%s;">%s</span>`+
				`</td></tr></table>`,
			emailBgCream, emailBorder, emailMonoStack, emailAIBlue, html.EscapeString(d.CodeValue)))
	}

	// Optional CTA button (bulletproof, charcoal primary per DESIGN.md).
	if d.ButtonText != "" && d.ButtonURL != "" {
		b.WriteString(fmt.Sprintf(
			`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0;"><tr>`+
				`<td align="center" style="background-color:%s;border-radius:7px;">`+
				`<a href="%s" target="_blank" style="display:inline-block;padding:13px 28px;font-family:%s;font-size:14px;`+
				`line-height:20px;font-weight:600;color:%s;text-decoration:none;border-radius:7px;">%s</a>`+
				`</td></tr></table>`,
			emailCharcoal, html.EscapeString(d.ButtonURL), emailFontStack, emailCardSurf, html.EscapeString(d.ButtonText)))
	}

	// Optional raw fallback link.
	if d.FallbackURL != "" {
		b.WriteString(fmt.Sprintf(
			`<p style="margin:24px 0 0 0;font-family:%s;font-size:13px;line-height:20px;color:%s;">`+
				`If the button doesn’t work, copy and paste this link into your browser:<br>`+
				`<a href="%s" target="_blank" style="color:%s;word-break:break-all;">%s</a></p>`,
			emailFontStack, emailMutedText, html.EscapeString(d.FallbackURL), emailAIBlue, html.EscapeString(d.FallbackURL)))
	}

	// Footnote.
	if d.Footnote != "" {
		b.WriteString(fmt.Sprintf(
			`<p style="margin:24px 0 0 0;font-family:%s;font-size:13px;line-height:20px;color:%s;">%s</p>`,
			emailFontStack, emailMutedText, html.EscapeString(d.Footnote)))
	}

	b.WriteString(`</td></tr>`)

	// Footer.
	b.WriteString(fmt.Sprintf(
		`<tr><td align="center" style="padding:24px 8px 0 8px;">`+
			`<p style="margin:0;font-family:%s;font-size:12px;line-height:16px;color:%s;">`+
			`Sent by %s · <a href="%s" target="_blank" style="color:%s;text-decoration:none;">%s</a></p>`+
			`</td></tr>`,
		emailFontStack, emailMutedText, html.EscapeString(SystemName), emailSiteURL, emailMutedText, emailSiteLabel))

	b.WriteString(`</table></td></tr></table></body></html>`)

	return b.String()
}
