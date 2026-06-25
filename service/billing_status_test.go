package service

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	_ "unsafe"

	i18n2 "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
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
