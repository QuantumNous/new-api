package service

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newResponseBillingTestContext() *gin.Context {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	return ctx
}

func TestAttachResponseBillingUsesSettledRatioCharge(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx := newResponseBillingTestContext()
	info := &relaycommon.RelayInfo{
		ShouldIncludeBilling: true,
		OriginModelName:      "test-model",
		StartTime:            time.Now(),
		BillingSource:        BillingSourceWallet,
		PriceData: types.PriceData{
			ModelRatio:      1,
			CompletionRatio: 2,
			GroupRatioInfo: types.GroupRatioInfo{
				GroupRatio: 0.5,
			},
		},
	}
	usage := &dto.Usage{PromptTokens: 1000, CompletionTokens: 500, TotalTokens: 1500}

	AttachResponseBilling(ctx, info, usage)

	require.NotNil(t, usage.Billing)
	assert.Equal(t, "USD", usage.Billing.Currency)
	assert.Equal(t, "ratio", usage.Billing.BillingMode)
	assert.Equal(t, BillingSourceWallet, usage.Billing.BillingSource)
	assert.InDelta(t, 0.002, usage.Billing.TotalCost, 1e-12)
	require.NotNil(t, usage.Billing.InputUnitPricePerMillion)
	require.NotNil(t, usage.Billing.OutputUnitPricePerMillion)
	assert.InDelta(t, 1, *usage.Billing.InputUnitPricePerMillion, 1e-12)
	assert.InDelta(t, 2, *usage.Billing.OutputUnitPricePerMillion, 1e-12)
}

func TestAttachResponseBillingUsesTieredExpressionCharge(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx := newResponseBillingTestContext()
	expr := `tier("base", p * 2 + c * 4)`
	info := &relaycommon.RelayInfo{
		ShouldIncludeBilling: true,
		OriginModelName:      "tiered-model",
		StartTime:            time.Now(),
		PriceData: types.PriceData{
			GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 0.5},
		},
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode:  "tiered_expr",
			ModelName:    "tiered-model",
			ExprString:   expr,
			ExprHash:     billingexpr.ExprHashString(expr),
			GroupRatio:   0.5,
			QuotaPerUnit: 500_000,
		},
	}
	usage := &dto.Usage{PromptTokens: 1000, CompletionTokens: 500, TotalTokens: 1500}

	AttachResponseBilling(ctx, info, usage)

	require.NotNil(t, usage.Billing)
	assert.Equal(t, "tiered_expr", usage.Billing.BillingMode)
	assert.Equal(t, "base", usage.Billing.MatchedTier)
	assert.InDelta(t, 0.002, usage.Billing.TotalCost, 1e-12)
	assert.Nil(t, usage.Billing.InputUnitPricePerMillion)
	assert.Nil(t, usage.Billing.OutputUnitPricePerMillion)
}

func TestAttachResponseBillingIsOptIn(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx := newResponseBillingTestContext()
	info := &relaycommon.RelayInfo{}
	usage := &dto.Usage{PromptTokens: 1, TotalTokens: 1}

	AttachResponseBilling(ctx, info, usage)

	assert.Nil(t, usage.Billing)
}
