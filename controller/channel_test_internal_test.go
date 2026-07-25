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
	"github.com/QuantumNous/new-api/setting/operation_setting"
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

func TestSelectChannelsForAutomaticTestPassiveRecoveryOnlyUsesAutoDisabled(t *testing.T) {
	channels := []*model.Channel{
		{Id: 1, Status: common.ChannelStatusEnabled},
		{Id: 2, Status: common.ChannelStatusAutoDisabled},
		{Id: 3, Status: common.ChannelStatusManuallyDisabled},
	}
	selected := selectChannelsForAutomaticTest(channels, operation_setting.ChannelTestModePassiveRecovery)
	require.Len(t, selected, 1)
	require.Equal(t, 2, selected[0].Id)
}

func TestSelectChannelsForAutomaticTestScheduledSkipsManualDisabled(t *testing.T) {
	channels := []*model.Channel{
		{Id: 1, Status: common.ChannelStatusEnabled},
		{Id: 2, Status: common.ChannelStatusAutoDisabled},
		{Id: 3, Status: common.ChannelStatusManuallyDisabled},
	}
	selected := selectChannelsForAutomaticTest(channels, operation_setting.ChannelTestModeScheduledAll)
	require.Len(t, selected, 2)
	require.Equal(t, 1, selected[0].Id)
	require.Equal(t, 2, selected[1].Id)
}

func TestTestChannelsDoesNotLoadBatchWhenRunAlreadyActive(t *testing.T) {
	testAllChannelsLock.Lock()
	previousRunning := testAllChannelsRunning
	testAllChannelsRunning = true
	testAllChannelsLock.Unlock()
	t.Cleanup(func() {
		testAllChannelsLock.Lock()
		testAllChannelsRunning = previousRunning
		testAllChannelsLock.Unlock()
	})

	loaderCalled := false
	err := testChannels(func() (int, []*model.Channel, error) {
		loaderCalled = true
		return 1, nil, nil
	}, false, true)

	require.EqualError(t, err, "测试已在运行中")
	require.False(t, loaderCalled, "the channel query must not run before acquiring the run state")
}

func TestTestChannelsReleasesRunStateWhenBatchLoadFails(t *testing.T) {
	testAllChannelsLock.Lock()
	previousRunning := testAllChannelsRunning
	testAllChannelsRunning = false
	testAllChannelsLock.Unlock()
	t.Cleanup(func() {
		testAllChannelsLock.Lock()
		testAllChannelsRunning = previousRunning
		testAllChannelsLock.Unlock()
	})

	err := testChannels(func() (int, []*model.Channel, error) {
		return 0, nil, errors.New("load failed")
	}, false, true)

	require.EqualError(t, err, "load failed")
	testAllChannelsLock.Lock()
	running := testAllChannelsRunning
	testAllChannelsLock.Unlock()
	require.False(t, running)
}

func TestTestChannelsReleasesRunStateWhenBatchLoaderPanics(t *testing.T) {
	testAllChannelsLock.Lock()
	previousRunning := testAllChannelsRunning
	testAllChannelsRunning = false
	testAllChannelsLock.Unlock()
	t.Cleanup(func() {
		testAllChannelsLock.Lock()
		testAllChannelsRunning = previousRunning
		testAllChannelsLock.Unlock()
	})

	err := testChannels(func() (int, []*model.Channel, error) {
		panic("load panic")
	}, false, true)

	require.EqualError(t, err, "加载渠道测试批次失败: load panic")
	testAllChannelsLock.Lock()
	running := testAllChannelsRunning
	testAllChannelsLock.Unlock()
	require.False(t, running)
}

func TestNormalizeChannelTestEndpointCodexAnthropicUsesResponsesBridge(t *testing.T) {
	channel := &model.Channel{Type: constant.ChannelTypeCodex}

	endpoint := normalizeChannelTestEndpoint(
		channel,
		"gpt-5.5",
		string(constant.EndpointTypeAnthropic),
	)

	require.Equal(t, string(constant.EndpointTypeOpenAIResponse), endpoint)
}

func TestNormalizeChannelTestEndpointKeepsAnthropicForOtherChannels(t *testing.T) {
	channel := &model.Channel{Type: constant.ChannelTypeOpenAI}

	endpoint := normalizeChannelTestEndpoint(
		channel,
		"gpt-5.5",
		string(constant.EndpointTypeAnthropic),
	)

	require.Equal(t, string(constant.EndpointTypeAnthropic), endpoint)
}

func TestNormalizeChannelTestEndpointCodexKeepsNonAnthropicProtocols(t *testing.T) {
	channel := &model.Channel{Type: constant.ChannelTypeCodex}
	endpointTypes := []constant.EndpointType{
		constant.EndpointTypeOpenAI,
		constant.EndpointTypeOpenAIResponse,
		constant.EndpointTypeOpenAIResponseCompact,
		constant.EndpointTypeGemini,
		constant.EndpointTypeJinaRerank,
		constant.EndpointTypeImageGeneration,
		constant.EndpointTypeEmbeddings,
		constant.EndpointTypeOpenAIVideo,
	}

	for _, endpointType := range endpointTypes {
		t.Run(string(endpointType), func(t *testing.T) {
			endpoint := normalizeChannelTestEndpoint(channel, "gpt-5.5", string(endpointType))
			require.Equal(t, string(endpointType), endpoint)
		})
	}
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

func TestShouldSkipScheduledChannelTestByType(t *testing.T) {
	setting := &operation_setting.MonitorSetting{
		AutoTestChannelAllowedTypes: []int{constant.ChannelTypeCodex, constant.ChannelTypeGemini},
		AutoTestChannelIgnoredTypes: []int{constant.ChannelTypeGemini},
	}

	require.False(t, shouldSkipScheduledChannelTestByType(true, constant.ChannelTypeOpenAI, setting), "manual test all channels should ignore scheduled filters")
	require.True(t, shouldSkipScheduledChannelTestByType(false, constant.ChannelTypeGemini, setting), "ignored channel types should win over allowed channel types")
	require.False(t, shouldSkipScheduledChannelTestByType(false, constant.ChannelTypeCodex, setting))
	require.True(t, shouldSkipScheduledChannelTestByType(false, constant.ChannelTypeOpenAI, setting))
}

func TestShouldSkipScheduledChannelTestByTypeWithEmptyFilters(t *testing.T) {
	setting := &operation_setting.MonitorSetting{}

	require.False(t, shouldSkipScheduledChannelTestByType(false, constant.ChannelTypeOpenAI, setting))
}

func TestAppendScheduledDingTalkAlertFlushesAtBatchSize(t *testing.T) {
	var sentBatches [][]service.DingTalkChannelAlert
	sender := func(alerts []service.DingTalkChannelAlert) error {
		sentBatches = append(sentBatches, append([]service.DingTalkChannelAlert(nil), alerts...))
		return nil
	}

	queue := make([]service.DingTalkChannelAlert, 0)
	for i := 0; i < scheduledDingTalkAlertFlushSize; i++ {
		var err error
		queue, err = appendScheduledDingTalkAlert(queue, service.DingTalkChannelAlert{ChannelID: i + 1}, sender)
		require.NoError(t, err)
	}

	require.Empty(t, queue)
	require.Len(t, sentBatches, 1)
	require.Len(t, sentBatches[0], scheduledDingTalkAlertFlushSize)
	require.Equal(t, 1, sentBatches[0][0].ChannelID)
	require.Equal(t, scheduledDingTalkAlertFlushSize, sentBatches[0][scheduledDingTalkAlertFlushSize-1].ChannelID)
}

func TestFlushScheduledDingTalkAlertsSendsPartialBatch(t *testing.T) {
	var sent []service.DingTalkChannelAlert
	sender := func(alerts []service.DingTalkChannelAlert) error {
		sent = append(sent, alerts...)
		return nil
	}

	queue := []service.DingTalkChannelAlert{{ChannelID: 1}, {ChannelID: 2}}
	queue, err := flushScheduledDingTalkAlerts(queue, sender)

	require.NoError(t, err)
	require.Empty(t, queue)
	require.Equal(t, []service.DingTalkChannelAlert{{ChannelID: 1}, {ChannelID: 2}}, sent)
}
