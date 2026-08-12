package service

import (
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
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

func TestSettleBillingNoSessionSubscriptionFallbackDispatchesSubscriptionNotifyOnce(t *testing.T) {
	setupQuotaNotifySubscriptionTestDB(t)
	require.NoError(t, i18n.Init())

	require.NoError(t, model.DB.Create(&model.User{
		Id:       7002,
		Username: "subscription_notify",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, model.DB.Create(&model.UserSubscription{
		Id:          7001,
		UserId:      7002,
		AmountTotal: 100,
		AmountUsed:  80,
		Status:      "active",
	}).Error)

	var mu sync.Mutex
	notifications := make([]dto.Notify, 0, 1)
	originalDispatcher := dispatchNotifyUser
	dispatchNotifyUser = func(userId int, userEmail string, userSetting dto.UserSetting, data dto.Notify) error {
		mu.Lock()
		defer mu.Unlock()
		notifications = append(notifications, data)
		return nil
	}
	t.Cleanup(func() { dispatchNotifyUser = originalDispatcher })

	relayInfo := &relaycommon.RelayInfo{
		UserId:                                7002,
		UserEmail:                             "subscription@example.com",
		BillingSource:                         BillingSourceSubscription,
		SubscriptionId:                        7001,
		SubscriptionAmountTotal:               100,
		SubscriptionAmountUsedAfterPreConsume: 80,
		UserSetting: dto.UserSetting{
			NotifyType:            dto.NotifyTypeWebhook,
			QuotaWarningThreshold: 30,
			WebhookUrl:            "https://example.com/hook",
		},
		IsPlayground: true,
	}

	require.NoError(t, SettleBilling(nil, relayInfo, 10))
	require.NoError(t, SettleBilling(nil, relayInfo, 10))

	require.Eventually(t, func() bool {
		mu.Lock()
		defer mu.Unlock()
		return len(notifications) == 1
	}, time.Second, 10*time.Millisecond)
	time.Sleep(100 * time.Millisecond)
	mu.Lock()
	defer mu.Unlock()
	require.Len(t, notifications, 1)
	require.Equal(t, dto.NotifyTypeQuotaExceed, notifications[0].Type)

	var stored model.UserSubscription
	require.NoError(t, model.DB.First(&stored, 7001).Error)
	require.EqualValues(t, 90, stored.AmountUsed)
}

func setupQuotaNotifySubscriptionTestDB(t *testing.T) {
	t.Helper()
	originalDB := model.DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalUsingMySQL := common.UsingMySQL
	db, err := gorm.Open(sqlite.Open("file:"+strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	model.DB = db
	common.UsingSQLite = true
	common.UsingPostgreSQL = false
	common.UsingMySQL = false
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.UserSubscription{}, &model.QuotaLifecycleState{}, &model.RecallLifecycleEvent{}))
	t.Cleanup(func() {
		model.DB = originalDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.UsingMySQL = originalUsingMySQL
		require.NoError(t, sqlDB.Close())
	})
}
