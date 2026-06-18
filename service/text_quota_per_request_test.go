package service

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// 复现并锁住资损 BUG：分组设了 per-request（usePrice=true）却未填 model_price 时，
// 模型级 GetModelPrice 返回 -1 哨兵，修复前结算为 -1 × QuotaPerUnit = -500000（负扣费 = 给用户返钱）。
// 修复后：未配置按次价当 0（免费），quota 绝不为负。
func TestCalculateTextQuotaSummaryPerRequestUnconfiguredPriceIsZero(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	usage := &dto.Usage{
		PromptTokens:     13942,
		CompletionTokens: 3005,
		TotalTokens:      16947,
	}

	priceData := types.PriceData{
		UsePrice:   true, // 分组 per-request 强制按价计费
		ModelPrice: -1,   // 模型级未配置按次价的哨兵
		GroupRatioInfo: types.GroupRatioInfo{
			GroupRatio: 1,
		},
	}
	relayInfo := &relaycommon.RelayInfo{
		RelayFormat:             types.RelayFormatOpenAI,
		FinalRequestRelayFormat: types.RelayFormatOpenAI,
		OriginModelName:         "gpt-5.4-mini",
		PriceData:               priceData,
		StartTime:               time.Now(),
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	require.GreaterOrEqual(t, summary.Quota, 0, "按次计费未配置价格不得产生负 quota")
	require.Equal(t, 0, summary.Quota)
}

// 分组 override 填了 model_price 时，按次计费正常结算（哨兵兜底不影响有效价格）。
func TestCalculateTextQuotaSummaryPerRequestWithGroupPrice(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	usage := &dto.Usage{
		PromptTokens:     1000,
		CompletionTokens: 200,
		TotalTokens:      1200,
	}

	priceData := types.PriceData{
		UsePrice:   true,
		ModelPrice: -1, // 模型级哨兵
		GroupPriceOverride: &types.ModelGroupPricing{
			ModelPrice: testFloat64Ptr(0.01),
		},
		GroupRatioInfo: types.GroupRatioInfo{
			GroupRatio: 1,
		},
	}
	relayInfo := &relaycommon.RelayInfo{
		RelayFormat:             types.RelayFormatOpenAI,
		FinalRequestRelayFormat: types.RelayFormatOpenAI,
		OriginModelName:         "gpt-5.4-mini",
		PriceData:               priceData,
		StartTime:               time.Now(),
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	require.Equal(t, 5000, summary.Quota) // 0.01 × QuotaPerUnit(500000) = 5000
}
