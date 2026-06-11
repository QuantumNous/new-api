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

// TestCalculateTextQuotaSummaryBillthroughPriceModeQuota locks the load-bearing
// billing chain behind the blockrun image bill-through guard
// (relay/image_handler.go):
//
//  1. adaptor.DoResponse fails AFTER upstream settlement was captured → the
//     guard swallows the error and injects usage = &dto.Usage{} (all zero).
//  2. image_handler then forces TotalTokens=1 / PromptTokens=1 on image usage
//     whose counters are zero.
//  3. PostTextConsumeQuota → calculateTextQuotaSummary computes
//     summary.TotalTokens = PromptTokens + CompletionTokens and ZEROES the
//     quota when that sum is 0 (`if summary.TotalTokens == 0 { summary.Quota
//     = 0 }`), regardless of price mode.
//
// The token=1 fallback in image_handler is therefore what keeps price-mode
// billing alive on the bill-through path. If that fallback is ever removed (or
// the zeroing rule starts firing for token-less price-mode usage), blockrun
// bill-through silently becomes bill-zero: the platform pays the upstream and
// charges the user nothing. These tests pin both sides of that behavior.
func TestCalculateTextQuotaSummaryBillthroughPriceModeQuota(t *testing.T) {
	gin.SetMode(gin.TestMode)

	newRelayInfo := func() *relaycommon.RelayInfo {
		return &relaycommon.RelayInfo{
			OriginModelName: "test-priced-image-model",
			PriceData: types.PriceData{
				UsePrice:   true,
				ModelPrice: 0.04,
				// Mirrors image_handler's AddOtherRatio("n", 1) on the price path.
				OtherRatios: map[string]float64{"n": 1},
				GroupRatioInfo: types.GroupRatioInfo{
					GroupRatio: 1,
				},
			},
			StartTime: time.Now(),
		}
	}

	t.Run("token fallback usage bills positive quota", func(t *testing.T) {
		w := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(w)

		// What image_handler's bill-through usage looks like after the
		// TotalTokens=1 / PromptTokens=1 fallback has been applied.
		usage := &dto.Usage{
			PromptTokens: 1,
			TotalTokens:  1,
		}

		summary := calculateTextQuotaSummary(ctx, newRelayInfo(), usage)

		require.Positive(t, summary.Quota,
			"price-mode usage with the token=1 fallback must yield a positive quota; "+
				"a zero here means blockrun bill-through bills nothing while the upstream was paid")
	})

	t.Run("zero token usage is zeroed, proving the fallback is load-bearing", func(t *testing.T) {
		w := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(w)

		// The raw usage the guard injects BEFORE image_handler's token
		// fallback runs. If this ever bills > 0, the fallback is redundant; as
		// long as it bills 0, removing the fallback breaks bill-through.
		usage := &dto.Usage{}

		summary := calculateTextQuotaSummary(ctx, newRelayInfo(), usage)

		require.Zero(t, summary.Quota,
			"documents the TotalTokens==0 zeroing rule that the image_handler token=1 fallback exists to avoid")
	})
}
