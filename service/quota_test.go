package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"

	"github.com/gin-gonic/gin"
)

func TestCalculateAudioQuotaIncludesImageTokens(t *testing.T) {
	quota, clamp := calculateAudioQuota(QuotaInfo{
		InputDetails:         TokenDetails{TextTokens: 100, ImageTokens: 10},
		OutputDetails:        TokenDetails{TextTokens: 20, ImageTokens: 5},
		ModelRatio:           2,
		GroupRatio:           3,
		CompletionRatio:      1,
		ImageRatio:           7,
		AudioRatio:           1,
		AudioCompletionRatio: 1,
	})

	require.Nil(t, clamp)
	require.Equal(t, 1170, quota)
}

func TestCalculateAudioQuotaSeparatesCachedTokens(t *testing.T) {
	quota, clamp := calculateAudioQuota(QuotaInfo{
		InputDetails: TokenDetails{
			TextTokens:       100,
			CachedTextTokens: 20,
		},
		ModelRatio:           1,
		GroupRatio:           1,
		CompletionRatio:      1,
		CacheRatio:           0.25,
		AudioRatio:           1,
		AudioCompletionRatio: 1,
	})

	require.Nil(t, clamp)
	require.Equal(t, 85, quota)
}

func TestCalculateAudioQuotaUsesConfiguredModalities(t *testing.T) {
	quota, clamp := calculateAudioQuota(QuotaInfo{
		InputDetails: TokenDetails{
			TextTokens:       100,
			CachedTextTokens: 20,
			ImageTokens:      10,
			AudioTokens:      15,
		},
		OutputDetails: TokenDetails{
			TextTokens:  40,
			ImageTokens: 5,
			AudioTokens: 20,
		},
		ModelRatio:           2,
		GroupRatio:           3,
		CompletionRatio:      4,
		CacheRatio:           0.25,
		ImageRatio:           3,
		AudioRatio:           2,
		AudioCompletionRatio: 5,
	})

	require.Nil(t, clamp)
	// (100 - 20) + 20*0.25 + 10*3 + (40 + 5)*4 + 15*2 + 20*2*5, then * 2 * 3.
	require.Equal(t, 3150, quota)
}

func TestCalculateAudioQuotaSeparatesCachedAudioAndImageTokens(t *testing.T) {
	quota, clamp := calculateAudioQuota(QuotaInfo{
		InputDetails: TokenDetails{
			TextTokens:        100,
			AudioTokens:       80,
			ImageTokens:       60,
			CachedTextTokens:  10,
			CachedAudioTokens: 20,
			CachedImageTokens: 30,
		},
		ModelRatio:      1,
		GroupRatio:      1,
		CompletionRatio: 1,
		CacheRatio:      0.1,
		AudioCacheRatio: 0.2,
		ImageCacheRatio: 0.3,
		ImageRatio:      3,
		AudioRatio:      4,
	})

	require.Nil(t, clamp)
	// (100-10) + (80-20)*4 + (60-30)*3 + 10*.1 + 20*.2 + 30*.3.
	require.Equal(t, 434, quota)
}

func TestNewRealtimeQuotaInfoTreatsLegacyUncategorizedCacheAsText(t *testing.T) {
	info := newRealtimeQuotaInfo(&relaycommon.RelayInfo{PriceData: types.PriceData{}}, &dto.RealtimeUsage{
		InputTokenDetails: dto.InputTokenDetails{CachedTokens: 12},
	})

	require.Equal(t, 12, info.InputDetails.CachedTextTokens)
	require.Zero(t, info.InputDetails.CachedAudioTokens)
	require.Zero(t, info.InputDetails.CachedImageTokens)
}

func TestPreWssConsumeQuotaReservesCumulativeUsage(t *testing.T) {
	truncate(t)
	const (
		userID  = 9001
		tokenID = 9001
	)
	seedUser(t, userID, 1_000)
	seedToken(t, tokenID, userID, "realtime-reserve", 1_000)

	c, _ := gin.CreateTestContext(nil)
	info := &relaycommon.RelayInfo{
		UserId:         userID,
		TokenId:        tokenID,
		TokenKey:       "sk-realtime-reserve",
		TokenUnlimited: false,
		UserSetting:    dto.UserSetting{BillingPreference: "wallet_only"},
		PriceData: types.PriceData{
			ModelRatio:      1,
			CompletionRatio: 1,
			AudioRatio:      1,
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 1},
		},
	}
	require.Nil(t, PreConsumeBilling(c, 5, info))

	first := &dto.RealtimeUsage{
		InputTokens: 10,
		InputTokenDetails: dto.InputTokenDetails{
			TextTokens: 10,
		},
	}
	require.NoError(t, PreWssConsumeQuota(c, info, first, first))
	require.Equal(t, 10, info.Billing.GetPreConsumedQuota())

	total := &dto.RealtimeUsage{
		InputTokens: 20,
		InputTokenDetails: dto.InputTokenDetails{
			TextTokens: 20,
		},
	}
	require.NoError(t, PreWssConsumeQuota(c, info, first, total))
	require.Equal(t, 20, info.Billing.GetPreConsumedQuota())

	require.NoError(t, SettleBilling(c, info, 20))
	userQuota, err := model.GetUserQuota(userID, false)
	require.NoError(t, err)
	require.Equal(t, 980, userQuota)

	var token model.Token
	require.NoError(t, model.DB.First(&token, tokenID).Error)
	require.Equal(t, 980, token.RemainQuota)
}

func TestPreWssConsumeQuotaUsesTieredExpression(t *testing.T) {
	truncate(t)
	const (
		userID  = 9002
		tokenID = 9002
	)
	seedUser(t, userID, 1_000)
	seedToken(t, tokenID, userID, "realtime-tiered", 1_000)

	c, _ := gin.CreateTestContext(nil)
	info := &relaycommon.RelayInfo{
		UserId:                userID,
		TokenId:               tokenID,
		TokenKey:              "sk-realtime-tiered",
		TokenUnlimited:        false,
		UserSetting:           dto.UserSetting{BillingPreference: "wallet_only"},
		PriceData:             types.PriceData{GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1}},
		TieredBillingSnapshot: makeSnapshot(flatExpr, 1, 0, 0),
	}
	require.Nil(t, PreConsumeBilling(c, 0, info))

	usage := &dto.RealtimeUsage{
		InputTokens: 10,
		InputTokenDetails: dto.InputTokenDetails{
			TextTokens: 10,
		},
	}
	require.NoError(t, PreWssConsumeQuota(c, info, usage, usage))
	require.Equal(t, 10, info.Billing.GetPreConsumedQuota())
}
