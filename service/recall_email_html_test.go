package service

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

const validRecallHTML = `<!doctype html>
<html><head><style>.cta{background:#111;color:#fff}</style></head>
<body>
  <p>Hello {{.RecipientName}}</p>
  <p>{{.PromotionCodeMasked}} · {{.ProductSummary}} · {{.ExpiresAt}}</p>
  <a class="cta" href="{{.ClaimURL}}">Claim offer</a>
  <a href="https://flatkey.ai/help">Help</a>
  <a href="{{.UnsubscribeURL}}">Unsubscribe</a>
</body></html>`

func TestRecallEmailTemplateBodyContract(t *testing.T) {
	tests := []struct {
		name    string
		body    string
		html    string
		wantErr string
	}{
		{name: "accepts text body", body: "Plain offer body"},
		{name: "accepts html body", html: validRecallHTML},
		{name: "rejects both bodies empty", wantErr: "requires exactly one body"},
		{name: "rejects both bodies present", body: "Plain offer body", html: validRecallHTML, wantErr: "requires exactly one body"},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			template := RecallEmailTemplate{
				Subject:  "Return offer",
				BodyText: testCase.body,
				BodyHTML: testCase.html,
			}

			_, err := validateRecallEmailTemplateBodyContract(template)

			if testCase.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.ErrorContains(t, err, testCase.wantErr)
		})
	}
}

func TestRecallEmailHTMLValidate(t *testing.T) {
	validWithStaticAssets := strings.Replace(
		validRecallHTML,
		`<p>Hello {{.RecipientName}}</p>`,
		`<p style="color:#111">Hello {{.RecipientName}}</p><img src="https://flatkey.ai/logo.png" alt="Flatkey">`,
		1,
	)

	tests := []struct {
		name    string
		source  string
		wantErr string
	}{
		{name: "accepts full document with style assets static links and actions", source: validWithStaticAssets},
		{name: "rejects oversize document", source: validRecallHTML + strings.Repeat("x", recallEmailHTMLMaxBytes), wantErr: "at most 102400 bytes"},
		{name: "rejects script", source: injectBeforeBodyEnd(`<script>alert(1)</script>`), wantErr: "script"},
		{name: "rejects iframe", source: injectBeforeBodyEnd(`<iframe src="https://flatkey.ai"></iframe>`), wantErr: "iframe"},
		{name: "rejects object", source: injectBeforeBodyEnd(`<object data="https://flatkey.ai"></object>`), wantErr: "object"},
		{name: "rejects embed", source: injectBeforeBodyEnd(`<embed src="https://flatkey.ai">`), wantErr: "embed"},
		{name: "rejects form", source: injectBeforeBodyEnd(`<form action="https://flatkey.ai"></form>`), wantErr: "form"},
		{name: "rejects form controls", source: injectBeforeBodyEnd(`<input name="email">`), wantErr: "input"},
		{name: "rejects base", source: strings.Replace(validRecallHTML, "<head>", `<head><base href="https://flatkey.ai/">`, 1), wantErr: "base"},
		{name: "rejects svg", source: injectBeforeBodyEnd(`<svg><a href="https://flatkey.ai"></a></svg>`), wantErr: "svg"},
		{name: "rejects mathml", source: injectBeforeBodyEnd(`<math><mi>x</mi></math>`), wantErr: "math"},
		{name: "rejects event attributes", source: strings.Replace(validRecallHTML, "<p>", `<p onclick="track()">`, 1), wantErr: "event handler"},
		{name: "rejects srcdoc", source: injectBeforeBodyEnd(`<iframe srcdoc="<p>x</p>"></iframe>`), wantErr: "iframe"},
		{name: "rejects meta refresh", source: strings.Replace(validRecallHTML, "<head>", `<head><meta http-equiv="refresh" content="0;url=https://flatkey.ai">`, 1), wantErr: "refresh"},
		{name: "rejects relative urls", source: strings.Replace(validRecallHTML, "https://flatkey.ai/help", "/help", 1), wantErr: "absolute http or https"},
		{name: "rejects javascript urls", source: strings.Replace(validRecallHTML, "https://flatkey.ai/help", "javascript:alert(1)", 1), wantErr: "absolute http or https"},
		{name: "rejects vbscript urls", source: strings.Replace(validRecallHTML, "https://flatkey.ai/help", "vbscript:msgbox(1)", 1), wantErr: "absolute http or https"},
		{name: "rejects data urls", source: strings.Replace(validRecallHTML, "https://flatkey.ai/help", "data:text/html,hi", 1), wantErr: "absolute http or https"},
		{name: "rejects unsafe css", source: strings.Replace(validRecallHTML, "background:#111", `background:url("javascript:alert(1)")`, 1), wantErr: "unsafe css"},
		{name: "rejects template actions in href urls", source: strings.Replace(validRecallHTML, "https://flatkey.ai/help", "https://tracker.example/{{.RecipientName}}", 1), wantErr: "template action in URL attribute"},
		{name: "rejects template actions in src urls", source: injectBeforeBodyEnd(`<img src="https://cdn.example/{{.ProductSummary}}" alt="Product">`), wantErr: "template action in URL attribute"},
		{name: "rejects template actions in background urls", source: injectBeforeBodyEnd(`<table background="https://cdn.example/{{.RecipientName}}"><tr><td>Deal</td></tr></table>`), wantErr: "template action in URL attribute"},
		{name: "rejects template actions in poster urls", source: injectBeforeBodyEnd(`<video poster="https://cdn.example/{{.ProductSummary}}"></video>`), wantErr: "template action in URL attribute"},
		{name: "rejects escaped javascript in style elements", source: strings.Replace(validRecallHTML, "background:#111", `background:ja\76ascript:alert(1)`, 1), wantErr: "unsafe css"},
		{name: "rejects escaped expression in inline style", source: strings.Replace(validRecallHTML, "<p>", `<p style="width:expr\65ssion(alert(1))">`, 1), wantErr: "unsafe css"},
		{name: "rejects escaped import in style elements", source: strings.Replace(validRecallHTML, "</style>", ` \40import url("https://evil.example/x.css");</style>`, 1), wantErr: "unsafe css"},
		{name: "rejects mso conditional comments with script", source: injectBeforeBodyEnd(`<!--[if mso]><script>alert(1)</script><![endif]-->`), wantErr: "conditional comment"},
		{name: "rejects mso conditional comments with unsafe links", source: injectBeforeBodyEnd(`<!--[if mso]><a href="javascript:alert(1)">x</a><![endif]-->`), wantErr: "conditional comment"},
		{name: "rejects mso conditional comments with unsafe style", source: injectBeforeBodyEnd(`<!--[if mso]><p style="background:url(javascript:alert(1))">x</p><![endif]-->`), wantErr: "conditional comment"},
		{name: "rejects unknown actions", source: strings.Replace(validRecallHTML, "https://flatkey.ai/help", "{{.MagicURL}}", 1), wantErr: "unsupported template field"},
		{name: "rejects template functions", source: strings.Replace(validRecallHTML, "{{.RecipientName}}", `{{printf "%s" .RecipientName}}`, 1), wantErr: "unsupported template command"},
		{name: "rejects template control structures", source: strings.Replace(validRecallHTML, "{{.RecipientName}}", `{{if .RecipientName}}{{.RecipientName}}{{end}}`, 1), wantErr: "unsupported template control"},
		{name: "rejects template variable declarations", source: strings.Replace(validRecallHTML, "{{.RecipientName}}", `{{$x := .RecipientName}}`, 1), wantErr: "unsupported template variable"},
		{name: "rejects template pipelines", source: strings.Replace(validRecallHTML, "{{.RecipientName}}", `{{.RecipientName | .ProductSummary}}`, 1), wantErr: "unsupported template command"},
		{name: "rejects associated template definitions with url actions", source: injectBeforeBodyEnd(`{{define "x"}}{{.ClaimURL}}{{end}}`), wantErr: "unsupported template definition"},
		{name: "rejects associated template definitions without url actions", source: injectBeforeBodyEnd(`{{define "x"}}Hidden copy{{end}}`), wantErr: "unsupported template definition"},
		{name: "rejects claim action outside anchor href", source: strings.Replace(validRecallHTML, `<a class="cta" href="{{.ClaimURL}}">Claim offer</a>`, `<span data-url="{{.ClaimURL}}">Claim offer</span>`, 1), wantErr: "ClaimURL action must appear in an anchor href"},
		{name: "rejects unsubscribe action outside anchor href", source: strings.Replace(validRecallHTML, `<a href="{{.UnsubscribeURL}}">Unsubscribe</a>`, `<span title="{{.UnsubscribeURL}}">Unsubscribe</span>`, 1), wantErr: "UnsubscribeURL action must appear in an anchor href"},
		{name: "rejects claim action in style text", source: strings.Replace(validRecallHTML, "</style>", " {{.ClaimURL}}</style>", 1), wantErr: "ClaimURL action must appear in an anchor href"},
		{name: "rejects unsubscribe action in head text", source: strings.Replace(validRecallHTML, "<head>", "<head>{{.UnsubscribeURL}}", 1), wantErr: "UnsubscribeURL action must appear in an anchor href"},
		{name: "rejects claim action in html comments", source: injectBeforeBodyEnd(`<!-- {{.ClaimURL}} -->`), wantErr: "ClaimURL action must appear in an anchor href"},
		{name: "rejects spaced claim action in visible text", source: injectBeforeBodyEnd(`<p>{{ .ClaimURL }}</p>`), wantErr: "ClaimURL action must appear in an anchor href"},
		{name: "rejects trim-marker unsubscribe action in style text", source: strings.Replace(validRecallHTML, "</style>", " {{- .UnsubscribeURL -}}</style>", 1), wantErr: "UnsubscribeURL action must appear in an anchor href"},
		{name: "rejects trim-marker claim action in html comments", source: injectBeforeBodyEnd(`<!-- {{- .ClaimURL -}} -->`), wantErr: "ClaimURL action must appear in an anchor href"},
		{name: "rejects spaced unsubscribe action in attributes", source: strings.Replace(validRecallHTML, `<a href="https://flatkey.ai/help">Help</a>`, `<a href="https://flatkey.ai/help" title="{{ .UnsubscribeURL }}">Help</a>`, 1), wantErr: "UnsubscribeURL action must appear in an anchor href"},
		{name: "rejects url action in attribute names", source: injectBeforeBodyEnd(`<p {{.ClaimURL}}="x">Dynamic attribute</p>`), wantErr: "template action in attribute name"},
		{name: "rejects ordinary field action in attribute names", source: injectBeforeBodyEnd(`<p {{.RecipientName}}="x">Dynamic attribute</p>`), wantErr: "template action in attribute name"},
		{name: "rejects trim-marker field action in attribute names", source: injectBeforeBodyEnd(`<p {{- .RecipientName -}}="x">Dynamic attribute</p>`), wantErr: "template action in attribute name"},
		{name: "rejects url action in end tags", source: strings.Replace(validRecallHTML, "</p>", `</p {{.ClaimURL}}>`, 1), wantErr: "template action in end tag"},
		{name: "rejects trim-marker ordinary field action in end tags", source: strings.Replace(validRecallHTML, "</p>", `</p {{- .RecipientName -}}>`, 1), wantErr: "template action in end tag"},
		{name: "rejects claim action in doctype", source: strings.Replace(validRecallHTML, "<!doctype html>", "<!doctype html {{.ClaimURL}}>", 1), wantErr: "ClaimURL action must appear in an anchor href"},
		{name: "rejects trim-marker unsubscribe action in doctype", source: strings.Replace(validRecallHTML, "<!doctype html>", "<!doctype html {{- .UnsubscribeURL -}}>", 1), wantErr: "UnsubscribeURL action must appear in an anchor href"},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			_, err := parseRecallEmailHTML(testCase.source)

			if testCase.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.ErrorContains(t, err, testCase.wantErr)
		})
	}
}

func TestRecallEmailHTMLTranslationPlan(t *testing.T) {
	document, err := parseRecallEmailHTML(strings.Replace(
		validRecallHTML,
		`<a href="https://flatkey.ai/help">Help</a>`,
		`<a href="https://flatkey.ai/help" title="Support center" aria-label="Get help">Help</a>`,
		1,
	))
	require.NoError(t, err)
	require.Equal(t, []string{
		"Hello {{.RecipientName}}",
		"{{.PromotionCodeMasked}} · {{.ProductSummary}} · {{.ExpiresAt}}",
		"Claim offer",
		"Support center",
		"Get help",
		"Help",
		"Unsubscribe",
	}, document.TranslationSegments())

	_, err = document.Rebuild([]string{"too few"})
	require.ErrorContains(t, err, "translation count")

	translated, err := document.Rebuild([]string{
		"Hola {{.RecipientName}}",
		"{{.PromotionCodeMasked}} · {{.ProductSummary}} · {{.ExpiresAt}}",
		"Reclamar oferta",
		"Centro de soporte",
		"Obtener ayuda",
		"Ayuda",
		"Cancelar suscripcion",
	})
	require.NoError(t, err)
	require.Contains(t, translated, "Hola {{.RecipientName}}")
	require.Contains(t, translated, `title="Centro de soporte"`)
	require.Contains(t, translated, `aria-label="Obtener ayuda"`)

	_, err = document.Rebuild([]string{
		"Hola {{.RecipientName}}",
		"{{.PromotionCodeMasked}} · {{.ProductSummary}} · {{.ExpiresAt}}",
		"Reclamar oferta",
		"Centro de soporte",
		"Obtener ayuda",
		"Ayuda",
		strings.Repeat("x", recallEmailHTMLMaxBytes),
	})
	require.ErrorContains(t, err, "at most 102400 bytes")
}

func injectBeforeBodyEnd(fragment string) string {
	return strings.Replace(validRecallHTML, "</body>", fragment+"</body>", 1)
}
