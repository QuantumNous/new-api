package service

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func walletOnlyRelayInfo(userID, tokenID int, tokenKey string) *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{
		UserId:          userID,
		TokenId:         tokenID,
		TokenKey:        tokenKey,
		OriginModelName: "concurrency-model",
		UserGroup:       "default",
		UsingGroup:      "default",
	}
	info.UserSetting.BillingPreference = "wallet_only"
	return info
}

// 每次请求都必须原子预留，不存在按缓存余额阈值跳过预扣的信任旁路：并发请求
// 要么各自成功预留，要么返回 402，余额永远不会被扣成负数。
func TestConcurrentPreConsumeNeverAdmitsDebtAndReservesExactlyOnce(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const (
		unitCost = 10
		balance  = 1000
		maxSpend = balance / unitCost
	)
	for _, tc := range []struct {
		name     string
		requests int
		wantOK   int
	}{
		{name: "exactly funded", requests: maxSpend, wantOK: maxSpend},
		{name: "oversubscribed", requests: 2 * maxSpend, wantOK: maxSpend},
	} {
		t.Run(tc.name, func(t *testing.T) {
			truncate(t)
			common.BatchUpdateEnabled = false
			common.RedisEnabled = false

			const initialTokenQuota = 1_000_000 * unitCost
			user := &model.User{Username: "concurrent-reserve-user", Quota: balance, Status: common.UserStatusEnabled}
			require.NoError(t, model.DB.Create(user).Error)
			token := &model.Token{UserId: user.Id, Key: "concurrent-reserve-token", Name: "concurrency", Status: common.TokenStatusEnabled, RemainQuota: initialTokenQuota}
			require.NoError(t, model.DB.Create(token).Error)

			var (
				wg           sync.WaitGroup
				mu           sync.Mutex
				okCount      int
				rejected     int
				unexpected   int
				unexpectedID types.ErrorCode
			)
			for range tc.requests {
				wg.Go(func() {
					ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
					ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
					apiErr := PreConsumeBilling(ctx, unitCost, walletOnlyRelayInfo(user.Id, token.Id, token.Key))

					mu.Lock()
					defer mu.Unlock()
					if apiErr == nil {
						okCount++
						return
					}
					if apiErr.GetErrorCode() == types.ErrorCodeInsufficientUserQuota {
						assert.Equal(t, http.StatusPaymentRequired, apiErr.StatusCode)
						rejected++
						return
					}
					unexpected++
					unexpectedID = apiErr.GetErrorCode()
				})
			}
			wg.Wait()

			assert.Equal(t, tc.wantOK, okCount)
			assert.Equal(t, tc.requests-tc.wantOK, rejected)
			assert.Zero(t, unexpected, "unexpected error code: %s", unexpectedID)

			var stored model.User
			require.NoError(t, model.DB.Select("quota").First(&stored, user.Id).Error)
			assert.Equal(t, balance-tc.wantOK*unitCost, stored.Quota, "only funded reservations may be deducted")
			assert.Zero(t, stored.Quota)

			var storedToken model.Token
			require.NoError(t, model.DB.Select("remain_quota", "used_quota").First(&storedToken, token.Id).Error)
			assert.Equal(t, initialTokenQuota-tc.wantOK*unitCost, storedToken.RemainQuota)
			assert.Equal(t, tc.wantOK*unitCost, storedToken.UsedQuota)
		})
	}
}

// 余额远高于历史 TrustQuotaUSD 阈值的用户也必须预扣，验证信任旁路已彻底移除。
func TestWalletPreConsumeReservesEvenForHighBalanceUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	truncate(t)
	common.BatchUpdateEnabled = false
	common.RedisEnabled = false

	const (
		held     = 500
		tokenCap = 1_000_000
	)
	start := 10*int(common.QuotaPerUnit) + 1000 // 默认阈值 $10 之上
	user := &model.User{Username: "high-balance-user", Quota: start, Status: common.UserStatusEnabled}
	require.NoError(t, model.DB.Create(user).Error)
	token := &model.Token{UserId: user.Id, Key: "high-balance-token", Name: "high-balance", Status: common.TokenStatusEnabled, RemainQuota: tokenCap}
	require.NoError(t, model.DB.Create(token).Error)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	info := walletOnlyRelayInfo(user.Id, token.Id, token.Key)
	require.Nil(t, PreConsumeBilling(ctx, held, info))

	assert.Equal(t, held, info.FinalPreConsumedQuota)
	var stored model.User
	require.NoError(t, model.DB.Select("quota").First(&stored, user.Id).Error)
	assert.Equal(t, start-held, stored.Quota, "a trusted-looking balance must still reserve before upstream submission")

	// 结算少于预留时退回差额。
	require.NoError(t, info.Billing.Settle(held-100))
	var settled model.User
	require.NoError(t, model.DB.Select("quota").First(&settled, user.Id).Error)
	assert.Equal(t, start-(held-100), settled.Quota)
}
