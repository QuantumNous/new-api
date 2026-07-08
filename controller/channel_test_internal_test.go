package controller

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
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

func TestTestAllChannelsRejectsExistingActiveTask(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.SystemTask{}, &model.SystemTaskLock{}))

	existing, err := model.CreateSystemTask(model.SystemTaskTypeChannelTest, nil, nil)
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/test", nil)

	TestAllChannels(ctx)

	require.Equal(t, http.StatusConflict, recorder.Code)
	require.Contains(t, recorder.Body.String(), existing.TaskID)
	require.Contains(t, recorder.Body.String(), "已有通道测试任务正在运行或等待中")
}

func TestPerformTestAllKeysRecoversAutoDisabledChannel(t *testing.T) {
	channel := &model.Channel{
		Id:     42,
		Key:    "key-1\nkey-2\nkey-3",
		Status: common.ChannelStatusAutoDisabled,
		ChannelInfo: model.ChannelInfo{
			IsMultiKey: true,
			MultiKeyStatusList: map[int]int{
				1: common.ChannelStatusAutoDisabled,
				2: common.ChannelStatusManuallyDisabled,
			},
		},
	}

	calls := make([]int, 0, 1)
	options := testAllKeysOptions{includeDisabled: false, autoEnableSuccess: true, autoDisableFailed: false, concurrency: 1}
	exec, err := performTestAllKeys(context.Background(), channel, 1, options, func(_ context.Context, _ *model.Channel, _ int, _ string, _ string, _ bool, keyIndex int) testResult {
		calls = append(calls, keyIndex)
		return testResult{}
	})

	require.NoError(t, err)
	require.Len(t, calls, 1)
	assert.Equal(t, 0, calls[0])
	require.Len(t, exec.response.Results, 3)
	assert.Equal(t, "Kept", exec.response.Results[0].Action)
	assert.Equal(t, "Skipped", exec.response.Results[1].Action)
	assert.Equal(t, "Skipped", exec.response.Results[2].Action)
	assert.Equal(t, common.ChannelStatusEnabled, channel.Status)
	assert.Equal(t, 1, exec.response.Summary.Tested)
	assert.Equal(t, 2, exec.response.Summary.Skipped)
	assert.Equal(t, 1, exec.response.Summary.Success)
}

func TestPerformTestAllKeysAutoDisablesFailedEnabledKey(t *testing.T) {
	channel := &model.Channel{
		Id:     7,
		Key:    "key-1",
		Status: common.ChannelStatusEnabled,
		ChannelInfo: model.ChannelInfo{
			IsMultiKey: true,
		},
	}

	options := testAllKeysOptions{includeDisabled: true, autoEnableSuccess: true, autoDisableFailed: true, concurrency: 1}
	exec, err := performTestAllKeys(context.Background(), channel, 1, options, func(_ context.Context, _ *model.Channel, _ int, _ string, _ string, _ bool, _ int) testResult {
		return testResult{localErr: errors.New("401 invalid api key")}
	})

	require.NoError(t, err)
	require.Len(t, exec.response.Results, 1)
	assert.Equal(t, "Auto Disabled", exec.response.Results[0].Action)
	assert.Equal(t, common.ChannelStatusAutoDisabled, channel.Status)
	assert.Equal(t, common.ChannelStatusAutoDisabled, channel.ChannelInfo.MultiKeyStatusList[0])
	assert.Equal(t, 1, exec.response.Summary.Failed)
	assert.Equal(t, 1, exec.response.Summary.AutoDisabled)
}

func TestPerformTestAllKeysKeepsManualDisabledKey(t *testing.T) {
	channel := &model.Channel{
		Id:     8,
		Key:    "key-1",
		Status: common.ChannelStatusEnabled,
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:         true,
			MultiKeyStatusList: map[int]int{0: common.ChannelStatusManuallyDisabled},
		},
	}

	options := testAllKeysOptions{includeDisabled: true, autoEnableSuccess: true, autoDisableFailed: false, concurrency: 1}
	exec, err := performTestAllKeys(context.Background(), channel, 1, options, func(_ context.Context, _ *model.Channel, _ int, _ string, _ string, _ bool, _ int) testResult {
		return testResult{}
	})

	require.NoError(t, err)
	require.Len(t, exec.response.Results, 1)
	assert.Equal(t, "Kept Manual Disabled", exec.response.Results[0].Action)
	assert.Equal(t, common.ChannelStatusEnabled, channel.Status)
	assert.Equal(t, common.ChannelStatusManuallyDisabled, channel.ChannelInfo.MultiKeyStatusList[0])
	assert.Equal(t, 1, exec.response.Summary.KeptManualDisabled)
}

func TestCloneChannelForSpecificKeyTestUsesRandomMode(t *testing.T) {
	channel := &model.Channel{
		Id:  9,
		Key: "key-1\nkey-2",
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:   true,
			MultiKeyMode: constant.MultiKeyModePolling,
		},
	}

	clone, err := cloneChannelForSpecificKeyTest(channel, 1)
	require.NoError(t, err)
	require.NotNil(t, clone)
	assert.True(t, clone.ChannelInfo.IsMultiKey)
	assert.Equal(t, constant.MultiKeyModeRandom, clone.ChannelInfo.MultiKeyMode)
	assert.Equal(t, []string{"key-2"}, clone.Keys)
	assert.Equal(t, "key-2", clone.Key)
}

func TestResolveTestAllKeysOptionsFollowsRoutingReliabilitySettings(t *testing.T) {
	originalDisable := common.AutomaticDisableChannelEnabled
	originalEnable := common.AutomaticEnableChannelEnabled
	t.Cleanup(func() {
		common.AutomaticDisableChannelEnabled = originalDisable
		common.AutomaticEnableChannelEnabled = originalEnable
	})

	common.AutomaticDisableChannelEnabled = true
	common.AutomaticEnableChannelEnabled = true

	options := resolveTestAllKeysOptions(TestAllKeysRequest{})

	assert.True(t, options.autoDisableFailed)
	assert.True(t, options.autoEnableSuccess)
}

func TestApplySingleKeyTestOutcomeAutoDisablesFailedKey(t *testing.T) {
	channel := &model.Channel{
		Id:     10,
		Key:    "key-1",
		Status: common.ChannelStatusEnabled,
		ChannelInfo: model.ChannelInfo{
			IsMultiKey: true,
		},
	}

	persist, statusChange, err := applySingleKeyTestOutcome(channel, 0, false, "401 invalid api key", testAllKeysOptions{autoDisableFailed: true})

	require.NoError(t, err)
	assert.True(t, persist)
	assert.True(t, statusChange)
	assert.Equal(t, common.ChannelStatusAutoDisabled, channel.ChannelInfo.MultiKeyStatusList[0])
	assert.Equal(t, common.ChannelStatusAutoDisabled, channel.Status)
	assert.Equal(t, "401 invalid api key", channel.ChannelInfo.MultiKeyDisabledReason[0])
	assert.NotZero(t, channel.ChannelInfo.MultiKeyDisabledTime[0])
}

func TestApplySingleKeyTestOutcomeAutoEnablesRecoveredKey(t *testing.T) {
	channel := &model.Channel{
		Id:     11,
		Key:    "key-1",
		Status: common.ChannelStatusAutoDisabled,
		ChannelInfo: model.ChannelInfo{
			IsMultiKey: true,
			MultiKeyStatusList: map[int]int{
				0: common.ChannelStatusAutoDisabled,
			},
			MultiKeyDisabledReason: map[int]string{
				0: "401 invalid api key",
			},
			MultiKeyDisabledTime: map[int]int64{
				0: common.GetTimestamp(),
			},
		},
	}

	persist, statusChange, err := applySingleKeyTestOutcome(channel, 0, true, "", testAllKeysOptions{autoEnableSuccess: true})

	require.NoError(t, err)
	assert.True(t, persist)
	assert.True(t, statusChange)
	assert.Equal(t, common.ChannelStatusEnabled, channel.Status)
	_, statusExists := channel.ChannelInfo.MultiKeyStatusList[0]
	_, reasonExists := channel.ChannelInfo.MultiKeyDisabledReason[0]
	_, timeExists := channel.ChannelInfo.MultiKeyDisabledTime[0]
	assert.False(t, statusExists)
	assert.False(t, reasonExists)
	assert.False(t, timeExists)
}
