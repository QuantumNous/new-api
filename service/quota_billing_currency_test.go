package service

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const fixedPriceBillingQuota = 182500 // $1 * 7.3 * 0.05 * 500000 quota/USD

func newFixedPriceBillingRelayInfo(userID, channelID int) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		UserId:                userID,
		ChannelMeta:           &relaycommon.ChannelMeta{ChannelId: channelID},
		OriginModelName:       "fixed-price-audio",
		UsingGroup:            "billing-sale",
		FinalPreConsumedQuota: fixedPriceBillingQuota,
		IsPlayground:          true,
		StartTime:             time.Now(),
		FirstResponseTime:     time.Now(),
		PriceData: types.PriceData{
			UsePrice:            true,
			ModelPrice:          1,
			BillingUSDToCNYRate: 7.3,
			GroupRatioInfo:      types.GroupRatioInfo{GroupRatio: 0.05},
		},
	}
}

func newBillingCurrencyTestContext() *gin.Context {
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/realtime", nil)
	return ctx
}

func TestPostWssConsumeQuotaFixedPriceUsesModelPriceAndBillingRateOnce(t *testing.T) {
	truncate(t)
	gin.SetMode(gin.TestMode)
	const userID, channelID, initialQuota = 51, 51, 1_000_000
	seedUser(t, userID, initialQuota)
	seedChannel(t, channelID)
	relayInfo := newFixedPriceBillingRelayInfo(userID, channelID)
	usage := &dto.RealtimeUsage{
		TotalTokens: 1,
		InputTokens: 1,
		InputTokenDetails: dto.InputTokenDetails{
			TextTokens: 1,
		},
	}

	PostWssConsumeQuota(newBillingCurrencyTestContext(), relayInfo, relayInfo.OriginModelName, usage, "")

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, fixedPriceBillingQuota, log.Quota)
	assert.Equal(t, initialQuota, getUserQuota(t, userID))
}

func TestPostAudioConsumeQuotaFixedPriceUsesModelPriceAndBillingRateOnce(t *testing.T) {
	truncate(t)
	gin.SetMode(gin.TestMode)
	const userID, channelID, initialQuota = 52, 52, 1_000_000
	seedUser(t, userID, initialQuota)
	seedChannel(t, channelID)
	relayInfo := newFixedPriceBillingRelayInfo(userID, channelID)
	usage := &dto.Usage{
		PromptTokens: 1,
		TotalTokens:  1,
		PromptTokensDetails: dto.InputTokenDetails{
			TextTokens: 1,
		},
	}

	PostAudioConsumeQuota(newBillingCurrencyTestContext(), relayInfo, usage, "")

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, fixedPriceBillingQuota, log.Quota)
	assert.Equal(t, initialQuota, getUserQuota(t, userID))
}

func TestCalcViolationFeeQuotaUsesBillingRateAndGroupRatio(t *testing.T) {
	quota, clamp := calcViolationFeeQuota(1, 7.3, 0.05)

	assert.Nil(t, clamp)
	assert.Equal(t, fixedPriceBillingQuota, quota)
}

func TestCalculateAudioQuotaUsesFrozenRequestRatios(t *testing.T) {
	quota, clamp := calculateAudioQuota(QuotaInfo{
		InputDetails: TokenDetails{
			TextTokens:  100,
			AudioTokens: 100,
		},
		OutputDetails: TokenDetails{
			TextTokens:  100,
			AudioTokens: 100,
		},
		ModelRatio:           2,
		CompletionRatio:      2,
		AudioRatio:           3,
		AudioCompletionRatio: 2,
		GroupRatio:           0.05,
		BillingUSDToCNYRate:  7.3,
	})

	assert.Nil(t, clamp)
	assert.Equal(t, 876, quota)
}
