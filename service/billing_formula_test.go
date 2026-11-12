package service

import (
	"github.com/QuantumNous/new-api/model"
	"net/http/httptest"
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAppendBillingFormulaRecordsInputs(t *testing.T) {
	other := model.NewLogOther()
	info := &relaycommon.RelayInfo{
		BillingBaseGroupRatio: 1.25,
		PriceData: types.PriceData{
			GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1},
		},
	}

	appendBillingFormula(other, info, "per_token", 1200, 1.5, 25, 1825)

	formula, ok := other.Snapshot()["billing_formula"].(billingFormulaLog)
	require.True(t, ok)
	assert.Equal(t, "per_token", formula.Mode)
	assert.InDelta(t, 1200, formula.BaseQuota, 0.000001)
	assert.InDelta(t, 1.25, formula.BaseGroupRatio, 0.000001)
	assert.InDelta(t, 1.25, formula.EffectiveGroupRatio, 0.000001)
	assert.InDelta(t, 1.5, formula.OtherRatio, 0.000001)
	assert.InDelta(t, 25, formula.SurchargeQuota, 0.000001)
	assert.Equal(t, 1825, formula.FinalQuota)
}

func TestAppendBillingFormulaRejectsNegativeAuditValues(t *testing.T) {
	other := model.NewLogOther()
	info := &relaycommon.RelayInfo{
		PriceData: types.PriceData{
			GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1},
		},
	}

	appendBillingFormula(other, info, "per_token", -1, 1, 0, 10)

	assert.NotContains(t, other.Snapshot(), "billing_formula")
}

func TestTextBillingFormulaRecomposesQuota(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		OriginModelName:       "formula-model",
		StartTime:             time.Now(),
		BillingBaseGroupRatio: 1,
		PriceData: types.PriceData{
			ModelRatio:      2,
			CompletionRatio: 2,
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 1},
		},
	}
	info.PriceData.AddOtherRatio("request", 1.5)

	summary := calculateTextQuotaSummary(ctx, info, &dto.Usage{
		PromptTokens:     100,
		CompletionTokens: 50,
		TotalTokens:      150,
	})
	other := model.NewLogOther()
	appendBillingFormula(other, info, "per_token", summary.BaseQuotaBeforeGroup.InexactFloat64(), summary.OtherRatioMultiplier, summary.ToolCallSurchargeQuota.InexactFloat64(), summary.Quota)

	formula, ok := other.Snapshot()["billing_formula"].(billingFormulaLog)
	require.True(t, ok)
	assert.Equal(t, 600, summary.Quota)
	assert.Equal(t, summary.Quota, formula.FinalQuota)
	assert.InDelta(t, 400, formula.BaseQuota, 0.000001)
	assert.InDelta(t, 600, formula.BaseQuota*formula.BaseGroupRatio*formula.OtherRatio+formula.SurchargeQuota, 0.000001)
}
