package service

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
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

func TestWalletQuotaNonEmailNotifyAllowsOnlyWebhookBarkGotify(t *testing.T) {
	if err := i18n.Init(); err != nil {
		t.Fatalf("i18n init failed: %v", err)
	}
	for _, notifyType := range []string{dto.NotifyTypeWebhook, dto.NotifyTypeBark, dto.NotifyTypeGotify} {
		t.Run(notifyType, func(t *testing.T) {
			notify, ok := walletQuotaNonEmailNotifyPayload(&relaycommon.RelayInfo{
				UserId:    42,
				UserEmail: "user@example.com",
				UserQuota: 95,
				UserSetting: dto.UserSetting{
					NotifyType:            notifyType,
					QuotaWarningThreshold: 100,
				},
			}, 10, 0)

			if !ok {
				t.Fatalf("expected %s notification payload", notifyType)
			}
			if notify.Type != dto.NotifyTypeQuotaExceed {
				t.Fatalf("unexpected notify type %q", notify.Type)
			}
		})
	}
}

func TestWalletQuotaNonEmailNotifySkipsEmailAndDefault(t *testing.T) {
	originalThreshold := common.QuotaRemindThreshold
	common.QuotaRemindThreshold = 100
	t.Cleanup(func() { common.QuotaRemindThreshold = originalThreshold })

	for _, notifyType := range []string{"", dto.NotifyTypeEmail} {
		t.Run("notify_type_"+notifyType, func(t *testing.T) {
			_, ok := walletQuotaNonEmailNotifyPayload(&relaycommon.RelayInfo{
				UserId:      43,
				UserEmail:   "user@example.com",
				UserQuota:   95,
				UserSetting: dto.UserSetting{NotifyType: notifyType},
			}, 10, 0)
			if ok {
				t.Fatalf("wallet non-email notifier must skip notify type %q", notifyType)
			}
		})
	}
}

func TestWalletQuotaNonEmailNotifySkipsSubscriptionFunding(t *testing.T) {
	_, ok := walletQuotaNonEmailNotifyPayload(&relaycommon.RelayInfo{
		UserId:        44,
		UserEmail:     "user@example.com",
		UserQuota:     95,
		BillingSource: BillingSourceSubscription,
		UserSetting: dto.UserSetting{
			NotifyType:            dto.NotifyTypeWebhook,
			QuotaWarningThreshold: 100,
		},
	}, 10, 0)
	if ok {
		t.Fatal("wallet non-email notifier must skip subscription-funded consumption")
	}
}
