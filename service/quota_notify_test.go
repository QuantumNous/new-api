package service

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
)

func TestNotifyLang(t *testing.T) {
	if got := notifyLang(""); got != i18n.DefaultLang {
		t.Errorf("empty language should default to %q, got %q", i18n.DefaultLang, got)
	}
	if got := notifyLang("ja"); got != "ja" {
		t.Errorf("set language should pass through, got %q", got)
	}
}

// Guards renderQuotaNotifyContent's notify-type switch: Bark/Gotify must be
// short plain text (no HTML, no link), email/webhook must be HTML with the link.
func TestRenderQuotaNotifyContent(t *testing.T) {
	if err := i18n.Init(); err != nil {
		t.Fatalf("i18n init failed: %v", err)
	}
	const link = "https://flatkey.ai/console/topup"
	const warning = "Low quota"
	const quota = "$1.23"

	// Email and Webhook (default case) → HTML body carrying the top-up link.
	for _, nt := range []string{dto.NotifyTypeEmail, dto.NotifyTypeWebhook} {
		got := renderQuotaNotifyContent(i18n.LangEn, nt, warning, quota, link)
		if !strings.Contains(got, link) || !strings.Contains(got, "<a ") {
			t.Errorf("%s content should be HTML with the link: %s", nt, got)
		}
		if !strings.Contains(got, quota) || !strings.Contains(got, warning) {
			t.Errorf("%s content missing quota/warning: %s", nt, got)
		}
	}

	// Bark and Gotify → short plain text, no HTML tags, no link.
	for _, nt := range []string{dto.NotifyTypeBark, dto.NotifyTypeGotify} {
		got := renderQuotaNotifyContent(i18n.LangEn, nt, warning, quota, link)
		if strings.Contains(got, "<") || strings.Contains(got, link) {
			t.Errorf("%s content should be plain text without HTML/link: %s", nt, got)
		}
		if !strings.Contains(got, quota) || !strings.Contains(got, warning) {
			t.Errorf("%s content missing quota/warning: %s", nt, got)
		}
	}
}
