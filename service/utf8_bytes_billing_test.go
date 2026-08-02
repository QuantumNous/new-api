package service

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func useUTF8BytesBilling(t *testing.T, model string) {
	t.Helper()

	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		if key == "billing_setting.billing_mode" {
			saved[key] = value
		}
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	modes, err := common.Marshal(map[string]string{
		model: billing_setting.BillingModeUTF8Bytes,
	})
	require.NoError(t, err)
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": string(modes),
	}))
}

func TestEstimateRequestTokenUsesUTF8BytesBillingUnit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const model = "utf8-bytes-model"
	useUTF8BytesBilling(t, model)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		OriginModelName: model,
		RelayFormat:     types.RelayFormatOpenAI,
	}
	meta := &types.TokenCountMeta{
		TokenType:     types.TokenTypeTokenizer,
		CombineText:   "你好A",
		ToolsCount:    2,
		MessagesCount: 3,
		NameCount:     1,
	}

	count, err := EstimateRequestToken(ctx, meta, info)

	require.NoError(t, err)
	require.Equal(t, 7, count)
	require.Equal(t, billing_setting.BillingModeUTF8Bytes, info.BillingMode)
}

func TestCalculateTextQuotaSummaryUsesLocalUTF8ByteCount(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const model = "utf8-bytes-settlement-model"
	useUTF8BytesBilling(t, model)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		OriginModelName: model,
		BillingMode:     billing_setting.BillingModeUTF8Bytes,
		PriceData: hosttypes.PriceData{
			ModelRatio:      7.5,
			CompletionRatio: 2,
			GroupRatioInfo: hosttypes.GroupRatioInfo{
				GroupRatio: 1,
			},
		},
		StartTime: time.Now(),
	}
	info.SetEstimatePromptTokens(7)
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{}`,
	}))
	usage := &dto.Usage{
		PromptTokens:     100,
		CompletionTokens: 20,
		TotalTokens:      120,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 50,
		},
	}

	summary := calculateTextQuotaSummary(ctx, info, usage)

	require.Equal(t, 7, summary.PromptTokens)
	require.Zero(t, summary.CompletionTokens)
	require.Equal(t, 7, summary.TotalTokens)
	require.Zero(t, summary.CacheTokens)
	require.Equal(t, 53, summary.Quota)
}

func TestCalculateTextQuotaSummaryUTF8BytesSkipsOpenRouterClaudeTokenAdjustments(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		OriginModelName:         "anthropic/claude-3.7-sonnet",
		BillingMode:             billing_setting.BillingModeUTF8Bytes,
		FinalRequestRelayFormat: types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenRouter,
		},
		PriceData: hosttypes.PriceData{
			ModelRatio:         1,
			CompletionRatio:    2,
			CacheRatio:         0.1,
			CacheCreationRatio: 1.25,
			GroupRatioInfo:     hosttypes.GroupRatioInfo{GroupRatio: 1},
		},
		StartTime: time.Now(),
	}
	info.SetEstimatePromptTokens(7)
	usage := &dto.Usage{
		PromptTokens:     1000,
		CompletionTokens: 100,
		Cost:             0.01,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 900,
		},
	}

	summary := calculateTextQuotaSummary(ctx, info, usage)

	require.Equal(t, 7, summary.PromptTokens)
	require.Zero(t, summary.CompletionTokens)
	require.Zero(t, summary.CacheTokens)
	require.Zero(t, summary.CacheCreationTokens)
	require.Equal(t, 7, summary.TotalTokens)
	require.Equal(t, 7, summary.Quota)
}

func TestAppendTextUsageBillingPathForLogUsesLocalPathForUTF8Bytes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	other := map[string]interface{}{}
	usage := &dto.Usage{
		BillingUsage: dto.NewClaudeMessagesBillingUsage(&dto.ClaudeUsage{InputTokens: 100}),
	}

	appendTextUsageBillingPathForLog(ctx, other, &relaycommon.RelayInfo{
		BillingMode: billing_setting.BillingModeUTF8Bytes,
	}, usage)

	adminInfo, ok := other["admin_info"].(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, usageBillingPathLocal, adminInfo["usage_billing_path"])
}
