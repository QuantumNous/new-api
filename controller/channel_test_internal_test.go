package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSettleTestQuotaUsesTieredBilling(t *testing.T) {
	info := &relaycommon.RelayInfo{
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode:   "tiered_expr",
			ExprString:    `param("stream") == true ? tier("stream", p * 3) : tier("base", p * 2)`,
			ExprHash:      billingexpr.ExprHashString(`param("stream") == true ? tier("stream", p * 3) : tier("base", p * 2)`),
			GroupRatio:    1,
			EstimatedTier: "stream",
			QuotaPerUnit:  common.QuotaPerUnit,
			ExprVersion:   1,
		},
		BillingRequestInput: &billingexpr.RequestInput{
			Body: []byte(`{"stream":true}`),
		},
	}

	quota, result := settleTestQuota(info, types.PriceData{
		ModelRatio:      1,
		CompletionRatio: 2,
	}, &dto.Usage{
		PromptTokens: 1000,
	})

	require.Equal(t, 1500, quota)
	require.NotNil(t, result)
	require.Equal(t, "stream", result.MatchedTier)
}

func TestBuildTestLogOtherInjectsTieredInfo(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	info := &relaycommon.RelayInfo{
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode: "tiered_expr",
			ExprString:  `tier("base", p * 2)`,
		},
		ChannelMeta: &relaycommon.ChannelMeta{},
	}
	priceData := types.PriceData{
		GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1},
	}
	usage := &dto.Usage{
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 12,
		},
	}

	other := buildTestLogOther(ctx, info, priceData, usage, &billingexpr.TieredResult{
		MatchedTier: "base",
	})

	require.Equal(t, "tiered_expr", other["billing_mode"])
	require.Equal(t, "base", other["matched_tier"])
	require.NotEmpty(t, other["expr_b64"])
}

func TestResolveChannelTestUserIDUsesRequestUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("id", 2)

	userID, err := resolveChannelTestUserID(ctx)

	require.NoError(t, err)
	require.Equal(t, 2, userID)
}

func TestBuildScheduledChannelTestAlertMarksAutoDisabled(t *testing.T) {
	autoBan := 1
	now := time.Date(2026, 6, 2, 13, 14, 15, 0, time.UTC)
	newAPIError := types.NewErrorWithStatusCode(
		errors.New("invalid credentials"),
		types.ErrorCodeBadResponse,
		http.StatusUnauthorized,
	)
	channel := &model.Channel{
		Id:      42,
		Name:    "codex-prod",
		Type:    constant.ChannelTypeCodex,
		Key:     "sk-controller-secret",
		AutoBan: &autoBan,
	}

	alert := buildScheduledChannelTestDingTalkAlert(channel, newAPIError, true, now)

	require.Equal(t, 42, alert.ChannelID)
	require.Equal(t, "codex-prod", alert.ChannelName)
	require.Equal(t, "Codex", alert.ChannelTypeName)
	require.Equal(t, newAPIError, alert.Error)
	require.True(t, alert.AutoDisabled)
	require.Equal(t, now, alert.Now)
}

func TestBuildScheduledChannelTestAlertDoesNotLeakChannelKey(t *testing.T) {
	now := time.Date(2026, 6, 2, 13, 14, 15, 0, time.UTC)
	newAPIError := types.NewErrorWithStatusCode(
		errors.New("upstream returned 401"),
		types.ErrorCodeBadResponse,
		http.StatusUnauthorized,
	)
	channel := &model.Channel{
		Id:   43,
		Name: "codex-backup",
		Type: constant.ChannelTypeCodex,
		Key:  "sk-controller-secret",
	}

	alert := buildScheduledChannelTestDingTalkAlert(channel, newAPIError, false, now)
	content := service.BuildDingTalkChannelAlertContent(alert)

	require.False(t, alert.AutoDisabled)
	require.NotContains(t, content, channel.Key)
	require.NotContains(t, content, "sk-controller-secret")
	require.Contains(t, content, "Auto Disabled: no")
}

func TestShouldSendScheduledChannelTestDingTalkAlertOnlyForScheduledFailures(t *testing.T) {
	newAPIError := types.NewErrorWithStatusCode(
		errors.New("upstream returned 401"),
		types.ErrorCodeBadResponse,
		http.StatusUnauthorized,
	)

	require.True(t, shouldSendScheduledChannelTestDingTalkAlert(false, newAPIError))
	require.False(t, shouldSendScheduledChannelTestDingTalkAlert(true, newAPIError))
	require.False(t, shouldSendScheduledChannelTestDingTalkAlert(false, nil))
}
