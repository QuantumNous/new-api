package service

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	_ "unsafe"

	"github.com/QuantumNous/new-api/common"
	i18n2 "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

//go:linkname modelCommonKeyCol github.com/QuantumNous/new-api/model.commonKeyCol
var modelCommonKeyCol string

type billingStatusTestFunding struct {
	source        string
	preConsumeErr error
}

func (f *billingStatusTestFunding) Source() string { return f.source }

func (f *billingStatusTestFunding) PreConsume(amount int) error { return f.preConsumeErr }

func (f *billingStatusTestFunding) Settle(delta int) error { return nil }

func (f *billingStatusTestFunding) Refund() error { return nil }

func requireAPIStatusCode(t *testing.T, err error, expected int) *types.NewAPIError {
	t.Helper()

	var apiErr *types.NewAPIError
	require.ErrorAs(t, err, &apiErr)
	require.Equal(t, expected, apiErr.StatusCode)
	return apiErr
}

func resetBillingStatusTables(t *testing.T) {
	t.Helper()

	modelCommonKeyCol = "`key`"
	require.NoError(t, i18n2.Init())
	require.NoError(t, model.DB.AutoMigrate(
		&model.UserSubscription{},
		&model.UserSubscriptionContract{},
		&model.SubscriptionPreConsumeRecord{},
		&model.SubscriptionDiscountAccount{},
		&model.SubscriptionDiscountEntry{},
	))
	require.NoError(t, model.DB.Exec("DELETE FROM subscription_discount_entries").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM subscription_discount_accounts").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM user_subscription_contracts").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM subscription_pre_consume_records").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM user_subscriptions").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM tokens").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM users").Error)
}

func newTestGinContext() *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	return c
}

func newQuotaStatusRelayInfo(userID, tokenID int, tokenKey string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		UserId:          userID,
		TokenId:         tokenID,
		TokenKey:        tokenKey,
		UsingGroup:      "default",
		UserGroup:       "default",
		BillingSource:   BillingSourceWallet,
		OriginModelName: "test-model",
	}
}

func TestPreConsumeQuotaReturnsForbiddenForQuotaExhaustion(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("user quota exhausted", func(t *testing.T) {
		const userID = 10101
		resetBillingStatusTables(t)
		seedUser(t, userID, 0)

		c := newTestGinContext()
		relayInfo := newQuotaStatusRelayInfo(userID, 0, "")
		apiErr := PreConsumeQuota(c, 1, relayInfo)

		require.NotNil(t, apiErr)
		require.Equal(t, http.StatusForbidden, apiErr.StatusCode)
	})

	t.Run("subscription discount ledger is not API quota", func(t *testing.T) {
		const userID = 10118
		resetBillingStatusTables(t)
		seedUser(t, userID, 0)
		require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
			_, err := model.GrantSubscriptionDiscountTx(tx, model.SubscriptionDiscountGrantInput{
				UserID:          userID,
				USDMinor:        500,
				EntryType:       model.SubscriptionDiscountEntryTypeGrantInviter,
				SourceType:      "test",
				SourceKey:       "api-quota-isolation",
				IdempotencyKey:  "api-quota-isolation",
				PricingSnapshot: "{}",
			})
			return err
		}))

		c := newTestGinContext()
		relayInfo := newQuotaStatusRelayInfo(userID, 0, "")
		apiErr := PreConsumeQuota(c, 1, relayInfo)

		require.NotNil(t, apiErr)
		require.Equal(t, http.StatusForbidden, apiErr.StatusCode)
		account, err := model.GetSubscriptionDiscountAccount(userID)
		require.NoError(t, err)
		require.EqualValues(t, 500, account.AvailableUSDMinor)
		require.Zero(t, relayInfo.FinalPreConsumedQuota)
	})

	t.Run("pre consume exceeds remaining user quota", func(t *testing.T) {
		const userID = 10102
		resetBillingStatusTables(t)
		seedUser(t, userID, 100)

		c := newTestGinContext()
		relayInfo := newQuotaStatusRelayInfo(userID, 0, "")
		apiErr := PreConsumeQuota(c, 200, relayInfo)

		require.NotNil(t, apiErr)
		require.Equal(t, http.StatusForbidden, apiErr.StatusCode)
	})

	t.Run("token quota exhausted", func(t *testing.T) {
		const (
			userID   = 10103
			tokenID  = 10203
			tokenKey = "billing-status-token-preconsume"
		)
		resetBillingStatusTables(t)
		seedUser(t, userID, 1000)
		seedToken(t, tokenID, userID, tokenKey, 50)

		c := newTestGinContext()
		relayInfo := newQuotaStatusRelayInfo(userID, tokenID, tokenKey)
		apiErr := PreConsumeQuota(c, 100, relayInfo)

		require.NotNil(t, apiErr)
		require.Equal(t, http.StatusForbidden, apiErr.StatusCode)
	})

	t.Run("unlimited token pre consumes token quota without exhaustion check", func(t *testing.T) {
		const (
			userID   = 10113
			tokenID  = 10213
			tokenKey = "billing-status-token-unlimited"
		)
		resetBillingStatusTables(t)
		seedUser(t, userID, 100)
		require.NoError(t, model.DB.Create(&model.Token{
			Id:             tokenID,
			UserId:         userID,
			Key:            tokenKey,
			Name:           "unlimited_test_token",
			Status:         common.TokenStatusEnabled,
			RemainQuota:    -50,
			UsedQuota:      10,
			UnlimitedQuota: true,
			ExpiredTime:    -1,
		}).Error)

		c := newTestGinContext()
		relayInfo := newQuotaStatusRelayInfo(userID, tokenID, tokenKey)
		relayInfo.TokenUnlimited = true
		apiErr := PreConsumeQuota(c, 80, relayInfo)

		require.Nil(t, apiErr)
		var token model.Token
		require.NoError(t, model.DB.First(&token, "id = ?", tokenID).Error)
		require.Equal(t, -130, token.RemainQuota)
		require.Equal(t, 90, token.UsedQuota)
	})
}

func TestBillingSessionPreConsumeReturnsForbiddenForQuotaErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("token quota exhausted", func(t *testing.T) {
		const (
			userID   = 10104
			tokenID  = 10204
			tokenKey = "billing-status-token-session"
		)
		resetBillingStatusTables(t)
		seedUser(t, userID, 1000)
		seedToken(t, tokenID, userID, tokenKey, 20)

		c := newTestGinContext()
		session := &BillingSession{
			relayInfo: newQuotaStatusRelayInfo(userID, tokenID, tokenKey),
			funding:   &billingStatusTestFunding{source: BillingSourceWallet},
		}

		apiErr := session.preConsume(c, 100)

		require.NotNil(t, apiErr)
		require.Equal(t, http.StatusForbidden, apiErr.StatusCode)
	})

	t.Run("subscription exhausted", func(t *testing.T) {
		resetBillingStatusTables(t)
		c := newTestGinContext()
		session := &BillingSession{
			relayInfo: &relaycommon.RelayInfo{
				UserId:        10105,
				IsPlayground:  true,
				BillingSource: BillingSourceSubscription,
			},
			funding: &billingStatusTestFunding{
				source:        BillingSourceSubscription,
				preConsumeErr: errors.New("subscription quota insufficient, need=2"),
			},
		}

		apiErr := session.preConsume(c, 2)

		require.NotNil(t, apiErr)
		require.Equal(t, http.StatusForbidden, apiErr.StatusCode)
	})

	t.Run("unlimited token rollback does not increase token quota", func(t *testing.T) {
		const (
			userID   = 10115
			tokenID  = 10215
			tokenKey = "billing-status-token-unlimited-rollback"
		)
		resetBillingStatusTables(t)
		seedUser(t, userID, 1000)
		require.NoError(t, model.DB.Create(&model.Token{
			Id:             tokenID,
			UserId:         userID,
			Key:            tokenKey,
			Name:           "unlimited_rollback_test_token",
			Status:         common.TokenStatusEnabled,
			RemainQuota:    -50,
			UsedQuota:      10,
			UnlimitedQuota: true,
			ExpiredTime:    -1,
		}).Error)

		c := newTestGinContext()
		relayInfo := newQuotaStatusRelayInfo(userID, tokenID, tokenKey)
		relayInfo.TokenUnlimited = true
		relayInfo.ForcePreConsume = true
		session := &BillingSession{
			relayInfo: relayInfo,
			funding:   &billingStatusTestFunding{source: BillingSourceWallet, preConsumeErr: errors.New("wallet reserve failed")},
		}

		apiErr := session.preConsume(c, 80)

		require.NotNil(t, apiErr)
		var token model.Token
		require.NoError(t, model.DB.First(&token, "id = ?", tokenID).Error)
		require.Equal(t, -50, token.RemainQuota)
		require.Equal(t, 10, token.UsedQuota)
	})
}

func TestBillingSessionPreConsumeReturnsUpdateErrorWhenTokenRollbackFails(t *testing.T) {
	const (
		userID   = 10119
		tokenID  = 10219
		tokenKey = "billing-status-token-rollback-fails"
	)
	resetBillingStatusTables(t)
	seedUser(t, userID, 1000)
	seedToken(t, tokenID, userID, tokenKey, 1000)
	blockTokenCreditForTest(t, tokenID, "billing_session_token_rollback_blocked")

	c := newTestGinContext()
	relayInfo := newQuotaStatusRelayInfo(userID, tokenID, tokenKey)
	relayInfo.RequestId = "req-billing-rollback-fails"
	session := &BillingSession{
		relayInfo: relayInfo,
		funding:   &billingStatusTestFunding{source: BillingSourceWallet, preConsumeErr: ErrInsufficientWalletQuota},
	}

	apiErr := session.preConsume(c, 80)

	require.NotNil(t, apiErr)
	require.Equal(t, http.StatusInternalServerError, apiErr.StatusCode)
	require.Equal(t, types.ErrorCodeUpdateDataError, apiErr.GetErrorCode())
	require.Contains(t, apiErr.Error(), "billing_session_token_rollback_blocked")
	require.Equal(t, 80, session.tokenConsumed, "failed rollback must keep token debt visible for compensation")
	require.Equal(t, 920, getTokenRemainQuota(t, tokenID))
	require.Equal(t, 80, getTokenUsedQuota(t, tokenID))
}

func TestPostConsumeQuotaTracksUnlimitedTokenQuota(t *testing.T) {
	const (
		userID   = 10114
		tokenID  = 10214
		tokenKey = "billing-status-token-unlimited-post"
	)
	resetBillingStatusTables(t)
	seedUser(t, userID, 1000)
	require.NoError(t, model.DB.Create(&model.Token{
		Id:             tokenID,
		UserId:         userID,
		Key:            tokenKey,
		Name:           "unlimited_post_test_token",
		Status:         common.TokenStatusEnabled,
		RemainQuota:    -50,
		UsedQuota:      10,
		UnlimitedQuota: true,
		ExpiredTime:    -1,
	}).Error)

	relayInfo := newQuotaStatusRelayInfo(userID, tokenID, tokenKey)
	relayInfo.TokenUnlimited = true
	err := PostConsumeQuota(relayInfo, 80, 0, false)

	require.NoError(t, err)
	var token model.Token
	require.NoError(t, model.DB.First(&token, "id = ?", tokenID).Error)
	require.Equal(t, -130, token.RemainQuota)
	require.Equal(t, 90, token.UsedQuota)
	userQuota, err := model.GetUserQuota(userID, true)
	require.NoError(t, err)
	require.Equal(t, 920, userQuota)
}

func TestSettleBillingLegacyReportsCommittedWalletDebit(t *testing.T) {
	const (
		userID   = 10122
		tokenID  = 10222
		tokenKey = "billing-status-legacy-partial-settlement"
	)
	resetBillingStatusTables(t)
	seedUser(t, userID, 1000)
	seedToken(t, tokenID, userID, tokenKey, 1000)
	blockTokenDebitForTest(t, tokenID, "legacy_token_debit_blocked")

	relayInfo := newQuotaStatusRelayInfo(userID, tokenID, tokenKey)
	applied, err := settleBillingWithStatus(nil, relayInfo, 80)

	require.ErrorContains(t, err, "legacy_token_debit_blocked")
	require.True(t, applied)
	require.Equal(t, 920, getUserQuota(t, userID))
	require.Equal(t, 1000, getTokenRemainQuota(t, tokenID))
}

func TestBillingSessionSettleTracksUnlimitedTokenQuota(t *testing.T) {
	const (
		userID   = 10117
		tokenID  = 10217
		tokenKey = "billing-status-token-unlimited-settle"
	)
	resetBillingStatusTables(t)
	seedUser(t, userID, 1000)
	require.NoError(t, model.DB.Create(&model.Token{
		Id:             tokenID,
		UserId:         userID,
		Key:            tokenKey,
		Name:           "unlimited_settle_test_token",
		Status:         common.TokenStatusEnabled,
		RemainQuota:    -50,
		UsedQuota:      10,
		UnlimitedQuota: true,
		ExpiredTime:    -1,
	}).Error)

	newUnlimitedSession := func(preConsumed int) *BillingSession {
		relayInfo := newQuotaStatusRelayInfo(userID, tokenID, tokenKey)
		relayInfo.TokenUnlimited = true
		return &BillingSession{
			relayInfo:        relayInfo,
			funding:          &billingStatusTestFunding{source: BillingSourceWallet},
			preConsumedQuota: preConsumed,
		}
	}
	assertTokenQuota := func(t *testing.T, remain int, used int) {
		t.Helper()
		var token model.Token
		require.NoError(t, model.DB.First(&token, "id = ?", tokenID).Error)
		require.Equal(t, remain, token.RemainQuota)
		require.Equal(t, used, token.UsedQuota)
	}

	require.NoError(t, newUnlimitedSession(50).Settle(80))
	assertTokenQuota(t, -80, 40)

	require.NoError(t, newUnlimitedSession(50).Settle(20))
	assertTokenQuota(t, -50, 10)
}

func TestNewBillingSessionWalletErrorsIncludeTopUpHint(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalServerAddress := system_setting.ServerAddress
	originalTheme := common.GetTheme()
	originalAllowedHosts := append([]string(nil), system_setting.GetTopupHintSettings().AllowedHosts...)
	t.Cleanup(func() {
		resetBillingStatusTables(t)
	})
	t.Cleanup(func() {
		system_setting.ServerAddress = originalServerAddress
		common.SetTheme(originalTheme)
		system_setting.GetTopupHintSettings().AllowedHosts = originalAllowedHosts
	})

	common.SetTheme("default")
	system_setting.ServerAddress = "https://console.flatkey.ai"
	system_setting.GetTopupHintSettings().AllowedHosts = []string{"console.flatkey.ai"}

	t.Run("user quota exhausted", func(t *testing.T) {
		const userID = 10108
		resetBillingStatusTables(t)
		seedUser(t, userID, 0)

		c := newTestGinContext()
		relayInfo := newQuotaStatusRelayInfo(userID, 0, "")
		relayInfo.UserSetting.BillingPreference = "wallet_only"

		session, apiErr := NewBillingSession(c, relayInfo, 1)

		require.Nil(t, session)
		require.NotNil(t, apiErr)
		require.Equal(t, types.ErrorCodeInsufficientUserQuota, apiErr.GetErrorCode())
		require.Contains(t, apiErr.Error(), "https://console.flatkey.ai/wallet")
		require.Contains(t, apiErr.ToOpenAIError().Message, "https://console.flatkey.ai/wallet")
	})

	t.Run("pre consume exceeds remaining quota", func(t *testing.T) {
		const userID = 10109
		resetBillingStatusTables(t)
		seedUser(t, userID, 100)

		c := newTestGinContext()
		relayInfo := newQuotaStatusRelayInfo(userID, 0, "")
		relayInfo.UserSetting.BillingPreference = "wallet_only"

		session, apiErr := NewBillingSession(c, relayInfo, 200)

		require.Nil(t, session)
		require.NotNil(t, apiErr)
		require.Equal(t, types.ErrorCodeInsufficientUserQuota, apiErr.GetErrorCode())
		require.Contains(t, apiErr.Error(), "https://console.flatkey.ai/wallet")
		require.Contains(t, apiErr.ToOpenAIError().Message, "https://console.flatkey.ai/wallet")
	})

	t.Run("wallet first dual failure keeps wallet hint", func(t *testing.T) {
		const (
			userID   = 10110
			tokenID  = 10210
			tokenKey = "billing-status-wallet-first-token"
		)
		resetBillingStatusTables(t)
		seedUser(t, userID, 0)
		seedToken(t, tokenID, userID, tokenKey, 1000)

		c := newTestGinContext()
		relayInfo := newQuotaStatusRelayInfo(userID, tokenID, tokenKey)
		relayInfo.IsPlayground = true
		relayInfo.RequestId = "wallet-first-dual-failure"
		relayInfo.UserSetting.BillingPreference = "wallet_first"

		session, apiErr := NewBillingSession(c, relayInfo, 1)

		require.Nil(t, session)
		require.NotNil(t, apiErr)
		require.Equal(t, types.ErrorCodeInsufficientUserQuota, apiErr.GetErrorCode())
		require.Contains(t, apiErr.Error(), "https://console.flatkey.ai/wallet")
		require.Contains(t, apiErr.ToOpenAIError().Message, "https://console.flatkey.ai/wallet")
	})

	t.Run("allowlisted host without scheme still preserves client-facing hint", func(t *testing.T) {
		const userID = 10115
		resetBillingStatusTables(t)
		seedUser(t, userID, 0)
		system_setting.ServerAddress = "console.flatkey.ai"
		system_setting.GetTopupHintSettings().AllowedHosts = []string{"console.flatkey.ai"}

		c := newTestGinContext()
		relayInfo := newQuotaStatusRelayInfo(userID, 0, "")
		relayInfo.UserSetting.BillingPreference = "wallet_only"

		session, apiErr := NewBillingSession(c, relayInfo, 1)

		require.Nil(t, session)
		require.NotNil(t, apiErr)
		require.Equal(t, types.ErrorCodeInsufficientUserQuota, apiErr.GetErrorCode())
		require.Contains(t, apiErr.Error(), "console.flatkey.ai/wallet")
		require.Contains(t, apiErr.ToOpenAIError().Message, "console.flatkey.ai/wallet")
	})

	t.Run("console origin env overrides router server address for wallet hint", func(t *testing.T) {
		const userID = 10116
		resetBillingStatusTables(t)
		seedUser(t, userID, 0)
		t.Setenv("APP_CONSOLE_ORIGIN", "https://staging-console.flatkey.ai")
		system_setting.ServerAddress = "https://staging-router.flatkey.ai"
		system_setting.GetTopupHintSettings().AllowedHosts = []string{"staging-console.flatkey.ai"}

		c := newTestGinContext()
		relayInfo := newQuotaStatusRelayInfo(userID, 0, "")
		relayInfo.UserSetting.BillingPreference = "wallet_only"

		session, apiErr := NewBillingSession(c, relayInfo, 1)

		require.Nil(t, session)
		require.NotNil(t, apiErr)
		require.Equal(t, types.ErrorCodeInsufficientUserQuota, apiErr.GetErrorCode())
		require.Contains(t, apiErr.Error(), "https://staging-console.flatkey.ai/wallet")
		require.Contains(t, apiErr.ToOpenAIError().Message, "https://staging-console.flatkey.ai/wallet")
		require.NotContains(t, apiErr.ToOpenAIError().Message, "https://***.ai/***")
	})

	t.Run("loopback host omits hint", func(t *testing.T) {
		const userID = 10112
		resetBillingStatusTables(t)
		seedUser(t, userID, 0)
		system_setting.ServerAddress = "http://127.0.0.1:3000"

		c := newTestGinContext()
		relayInfo := newQuotaStatusRelayInfo(userID, 0, "")
		relayInfo.UserSetting.BillingPreference = "wallet_only"

		session, apiErr := NewBillingSession(c, relayInfo, 1)

		require.Nil(t, session)
		require.NotNil(t, apiErr)
		require.Equal(t, types.ErrorCodeInsufficientUserQuota, apiErr.GetErrorCode())
		require.NotContains(t, apiErr.Error(), "http://127.0.0.1:3000")
		require.NotContains(t, apiErr.Error(), "/wallet")
	})
}

func TestNewBillingSessionFallsBackToWalletWhenUnifiedSubscriptionQuotaIsInsufficient(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const (
		userID         = 10119
		subscriptionID = 10219
	)
	resetBillingStatusTables(t)
	t.Cleanup(func() { resetBillingStatusTables(t) })
	seedUser(t, userID, 100)
	seedSubscription(t, subscriptionID, userID, 100, 90)

	c := newTestGinContext()
	relayInfo := newQuotaStatusRelayInfo(userID, 0, "")
	relayInfo.IsPlayground = true
	relayInfo.RequestId = "unified-quota-wallet-fallback"

	session, apiErr := NewBillingSession(c, relayInfo, 20)

	require.Nil(t, apiErr)
	require.NotNil(t, session)
	require.Equal(t, BillingSourceWallet, relayInfo.BillingSource)
	require.Equal(t, 80, currentWalletQuota(userID))
	var subscription model.UserSubscription
	require.NoError(t, model.DB.Select("amount_used").First(&subscription, "id = ?", subscriptionID).Error)
	require.EqualValues(t, 90, subscription.AmountUsed)
}

func TestPreConsumeQuotaWalletErrorsIncludeTopUpHint(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalServerAddress := system_setting.ServerAddress
	originalTheme := common.GetTheme()
	originalAllowedHosts := append([]string(nil), system_setting.GetTopupHintSettings().AllowedHosts...)
	t.Cleanup(func() {
		resetBillingStatusTables(t)
	})
	t.Cleanup(func() {
		system_setting.ServerAddress = originalServerAddress
		common.SetTheme(originalTheme)
		system_setting.GetTopupHintSettings().AllowedHosts = originalAllowedHosts
	})

	common.SetTheme("default")
	system_setting.ServerAddress = "https://console.flatkey.ai"
	system_setting.GetTopupHintSettings().AllowedHosts = []string{"console.flatkey.ai"}

	t.Run("user quota exhausted", func(t *testing.T) {
		const userID = 10111
		resetBillingStatusTables(t)
		seedUser(t, userID, 0)

		c := newTestGinContext()
		relayInfo := newQuotaStatusRelayInfo(userID, 0, "")
		apiErr := PreConsumeQuota(c, 1, relayInfo)

		require.NotNil(t, apiErr)
		require.Equal(t, types.ErrorCodeInsufficientUserQuota, apiErr.GetErrorCode())
		require.Contains(t, apiErr.Error(), "https://console.flatkey.ai/wallet")
		require.Contains(t, apiErr.ToOpenAIError().Message, "https://console.flatkey.ai/wallet")
	})

	t.Run("pre consume exceeds remaining quota", func(t *testing.T) {
		const userID = 10113
		resetBillingStatusTables(t)
		seedUser(t, userID, 100)

		c := newTestGinContext()
		relayInfo := newQuotaStatusRelayInfo(userID, 0, "")
		apiErr := PreConsumeQuota(c, 200, relayInfo)

		require.NotNil(t, apiErr)
		require.Equal(t, types.ErrorCodeInsufficientUserQuota, apiErr.GetErrorCode())
		require.Contains(t, apiErr.Error(), "https://console.flatkey.ai/wallet")
		require.Contains(t, apiErr.ToOpenAIError().Message, "https://console.flatkey.ai/wallet")
	})

	t.Run("missing allowlist keeps client-facing url masked", func(t *testing.T) {
		const userID = 10114
		resetBillingStatusTables(t)
		seedUser(t, userID, 0)
		system_setting.GetTopupHintSettings().AllowedHosts = nil

		c := newTestGinContext()
		relayInfo := newQuotaStatusRelayInfo(userID, 0, "")
		apiErr := PreConsumeQuota(c, 1, relayInfo)

		require.NotNil(t, apiErr)
		require.Equal(t, types.ErrorCodeInsufficientUserQuota, apiErr.GetErrorCode())
		require.Contains(t, apiErr.Error(), "https://console.flatkey.ai/wallet")
		require.NotContains(t, apiErr.ToOpenAIError().Message, "https://console.flatkey.ai/wallet")
		require.Contains(t, apiErr.ToOpenAIError().Message, "https://***.ai/***")
	})

	t.Run("allowlisted host without scheme still preserves client-facing hint", func(t *testing.T) {
		const userID = 10116
		resetBillingStatusTables(t)
		seedUser(t, userID, 0)
		system_setting.ServerAddress = "console.flatkey.ai"
		system_setting.GetTopupHintSettings().AllowedHosts = []string{"console.flatkey.ai"}

		c := newTestGinContext()
		relayInfo := newQuotaStatusRelayInfo(userID, 0, "")
		apiErr := PreConsumeQuota(c, 1, relayInfo)

		require.NotNil(t, apiErr)
		require.Equal(t, types.ErrorCodeInsufficientUserQuota, apiErr.GetErrorCode())
		require.Contains(t, apiErr.Error(), "console.flatkey.ai/wallet")
		require.Contains(t, apiErr.ToOpenAIError().Message, "console.flatkey.ai/wallet")
	})
}

func TestPreConsumeQuotaReturnsUpdateErrorWhenTokenRollbackFails(t *testing.T) {
	const (
		userID   = 10120
		tokenID  = 10220
		tokenKey = "billing-status-legacy-token-rollback-fails"
	)
	resetBillingStatusTables(t)
	seedUser(t, userID, 100)
	seedToken(t, tokenID, userID, tokenKey, 200)
	drainWalletAfterTokenDebitForTest(t, userID, tokenID)
	blockTokenCreditForTest(t, tokenID, "legacy_token_rollback_blocked")

	c := newTestGinContext()
	c.Set("token_quota", 200)
	relayInfo := newQuotaStatusRelayInfo(userID, tokenID, tokenKey)
	relayInfo.RequestId = "req-legacy-rollback-fails"
	relayInfo.ForcePreConsume = true

	apiErr := PreConsumeQuota(c, 80, relayInfo)

	require.NotNil(t, apiErr)
	require.Equal(t, http.StatusInternalServerError, apiErr.StatusCode)
	require.Equal(t, types.ErrorCodeUpdateDataError, apiErr.GetErrorCode())
	require.Contains(t, apiErr.Error(), "legacy_token_rollback_blocked")
	require.Zero(t, relayInfo.FinalPreConsumedQuota)
	require.Equal(t, 120, getTokenRemainQuota(t, tokenID))
	require.Equal(t, 80, getTokenUsedQuota(t, tokenID))
}

func TestPreConsumeQuotaPlaygroundWalletReserveFailureDoesNotCreditToken(t *testing.T) {
	const (
		userID   = 10121
		tokenID  = 10221
		tokenKey = "billing-status-playground-wallet-fails"
	)
	resetBillingStatusTables(t)
	seedUser(t, userID, 100)
	seedToken(t, tokenID, userID, tokenKey, 200)
	blockWalletDebitForTest(t, userID, "playground_wallet_reserve_blocked")

	c := newTestGinContext()
	c.Set("token_quota", 200)
	relayInfo := newQuotaStatusRelayInfo(userID, tokenID, tokenKey)
	relayInfo.IsPlayground = true
	relayInfo.ForcePreConsume = true

	apiErr := PreConsumeQuota(c, 80, relayInfo)

	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeUpdateDataError, apiErr.GetErrorCode())
	require.Contains(t, apiErr.Error(), "playground_wallet_reserve_blocked")
	require.Equal(t, 200, getTokenRemainQuota(t, tokenID))
	require.Equal(t, 0, getTokenUsedQuota(t, tokenID))
}

func TestBillingSessionReserveMethodsReturnForbiddenForQuotaErrors(t *testing.T) {
	t.Run("reserve token quota exhausted", func(t *testing.T) {
		const (
			userID   = 10106
			tokenID  = 10206
			tokenKey = "billing-status-token-reserve"
		)
		resetBillingStatusTables(t)
		seedUser(t, userID, 1000)
		seedToken(t, tokenID, userID, tokenKey, 10)

		session := &BillingSession{
			relayInfo: newQuotaStatusRelayInfo(userID, tokenID, tokenKey),
		}

		err := session.reserveToken(20)

		requireAPIStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("reserve subscription exceeds total", func(t *testing.T) {
		const (
			userID         = 10107
			subscriptionID = 10307
		)
		resetBillingStatusTables(t)
		seedUser(t, userID, 1000)
		seedSubscription(t, subscriptionID, userID, 10, 9)

		session := &BillingSession{
			relayInfo: &relaycommon.RelayInfo{},
			funding: &SubscriptionFunding{
				subscriptionId: subscriptionID,
			},
		}

		err := session.reserveFunding(2)

		requireAPIStatusCode(t, err, http.StatusForbidden)
	})
}

func blockTokenCreditForTest(t *testing.T, tokenID int, message string) {
	t.Helper()
	triggerName := "test_block_token_credit_" + strings.ReplaceAll(message, "-", "_")
	require.NoError(t, model.DB.Exec("DROP TRIGGER IF EXISTS "+triggerName).Error)
	require.NoError(t, model.DB.Exec(fmt.Sprintf(
		"CREATE TRIGGER %s BEFORE UPDATE OF remain_quota ON tokens "+
			"WHEN OLD.id = %d AND NEW.remain_quota > OLD.remain_quota "+
			"BEGIN SELECT RAISE(ABORT, '%s'); END",
		triggerName, tokenID, message,
	)).Error)
	t.Cleanup(func() {
		require.NoError(t, model.DB.Exec("DROP TRIGGER IF EXISTS "+triggerName).Error)
	})
}

func blockTokenDebitForTest(t *testing.T, tokenID int, message string) {
	t.Helper()
	triggerName := "test_block_token_debit_" + strings.ReplaceAll(message, "-", "_")
	require.NoError(t, model.DB.Exec("DROP TRIGGER IF EXISTS "+triggerName).Error)
	require.NoError(t, model.DB.Exec(fmt.Sprintf(
		"CREATE TRIGGER %s BEFORE UPDATE OF remain_quota ON tokens "+
			"WHEN OLD.id = %d AND NEW.remain_quota < OLD.remain_quota "+
			"BEGIN SELECT RAISE(ABORT, '%s'); END",
		triggerName, tokenID, message,
	)).Error)
	t.Cleanup(func() {
		require.NoError(t, model.DB.Exec("DROP TRIGGER IF EXISTS "+triggerName).Error)
	})
}

func drainWalletAfterTokenDebitForTest(t *testing.T, userID int, tokenID int) {
	t.Helper()
	const triggerName = "test_drain_wallet_after_token_debit"
	require.NoError(t, model.DB.Exec("DROP TRIGGER IF EXISTS "+triggerName).Error)
	require.NoError(t, model.DB.Exec(fmt.Sprintf(
		"CREATE TRIGGER %s AFTER UPDATE OF remain_quota ON tokens "+
			"WHEN OLD.id = %d AND NEW.remain_quota < OLD.remain_quota "+
			"BEGIN UPDATE users SET quota = 0 WHERE id = %d; END",
		triggerName, tokenID, userID,
	)).Error)
	t.Cleanup(func() {
		require.NoError(t, model.DB.Exec("DROP TRIGGER IF EXISTS "+triggerName).Error)
	})
}

func blockWalletDebitForTest(t *testing.T, userID int, message string) {
	t.Helper()
	triggerName := "test_block_wallet_debit_" + strings.ReplaceAll(message, "-", "_")
	require.NoError(t, model.DB.Exec("DROP TRIGGER IF EXISTS "+triggerName).Error)
	require.NoError(t, model.DB.Exec(fmt.Sprintf(
		"CREATE TRIGGER %s BEFORE UPDATE OF quota ON users "+
			"WHEN OLD.id = %d AND NEW.quota < OLD.quota "+
			"BEGIN SELECT RAISE(ABORT, '%s'); END",
		triggerName, userID, message,
	)).Error)
	t.Cleanup(func() {
		require.NoError(t, model.DB.Exec("DROP TRIGGER IF EXISTS "+triggerName).Error)
	})
}
