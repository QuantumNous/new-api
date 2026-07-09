package service

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestClassifyChannelError_platformUserQuota(t *testing.T) {
	t.Parallel()
	err := types.NewErrorWithStatusCode(
		types.NewError(nil, types.ErrorCodeInsufficientUserQuota),
		types.ErrorCodeInsufficientUserQuota,
		403,
	)
	require.Equal(t, CategorySkip, ClassifyChannelError(err))
}

func TestClassifyChannelError_wrappedPlatformUserQuota(t *testing.T) {
	t.Parallel()
	err := types.NewErrorWithStatusCode(
		types.NewError(nil, types.ErrorCodeBadResponseStatusCode),
		types.ErrorCodeBadResponseStatusCode,
		403,
	)
	err.SetMessage("status_code=403, 用户额度不足, 剩余额度: ＄-0.009978")
	require.Equal(t, CategorySkip, ClassifyChannelError(err))
}

func TestClassifyChannelError_distributorSkip(t *testing.T) {
	t.Parallel()
	err := types.NewErrorWithStatusCode(
		types.NewError(nil, types.ErrorCodeBadResponseStatusCode),
		types.ErrorCodeBadResponseStatusCode,
		503,
	)
	err.SetMessage("No available channel for model gpt-5.4 under group A-Codex-Sale (distributor)")
	require.Equal(t, CategorySkip, ClassifyChannelError(err))
}

func TestClassifyChannelError_modelAccessForbidden(t *testing.T) {
	t.Parallel()
	err := types.NewErrorWithStatusCode(
		types.NewError(nil, types.ErrorCodeBadResponseStatusCode),
		types.ErrorCodeBadResponseStatusCode,
		403,
	)
	err.SetMessage("status_code=403, 该令牌无权访问模型 claude-opus-4-7")
	require.Equal(t, CategoryDisableImmediate, ClassifyChannelError(err))
}

func TestClassifyChannelError_imageGenerationTimeout(t *testing.T) {
	t.Parallel()
	err := types.WithOpenAIError(types.OpenAIError{
		Message: "Image generation timed out after 600 seconds. Retry with lower resolution or quality.",
		Type:    "server_error",
		Code:    string(types.ErrorCodeImageGenerationTimeout),
	}, http.StatusRequestTimeout, types.ErrOptionWithNoRecordErrorLog(), types.ErrOptionWithSkipRetry())
	require.Equal(t, CategorySkip, ClassifyChannelError(err))
	require.False(t, ShouldDisableChannel(err))
}

func TestClassifyChannelError_windowFault502(t *testing.T) {
	t.Parallel()
	err := types.NewErrorWithStatusCode(
		types.NewError(nil, types.ErrorCodeBadResponseStatusCode),
		types.ErrorCodeBadResponseStatusCode,
		502,
	)
	err.SetMessage("status_code=502, bad response status code 502")
	require.Equal(t, CategoryDisableWindow, ClassifyChannelError(err))
}

func TestEvaluateChannelHealth_consecutive502(t *testing.T) {
	resetChannelHealthForTest()
	ch := types.ChannelError{ChannelId: 99, ChannelName: "test", AutoBan: true}
	commonBackup := common.AutomaticDisableChannelEnabled
	common.AutomaticDisableChannelEnabled = true
	t.Cleanup(func() {
		common.AutomaticDisableChannelEnabled = commonBackup
		resetChannelHealthForTest()
	})

	make502 := func() *types.NewAPIError {
		e := types.NewErrorWithStatusCode(
			types.NewError(nil, types.ErrorCodeBadResponseStatusCode),
			types.ErrorCodeBadResponseStatusCode,
			502,
		)
		e.SetMessage("bad response status code 502")
		return e
	}

	for i := 0; i < 4; i++ {
		action, _ := EvaluateChannelHealth(ch, make502())
		require.Equal(t, HealthSkip, action, "attempt %d should skip", i+1)
	}
	action, reason := EvaluateChannelHealth(ch, make502())
	require.Equal(t, HealthProbeBeforeDisable, action)
	require.Contains(t, reason, "502")
}

func TestEvaluateChannelHealth_rechargeHighConfidence(t *testing.T) {
	resetChannelHealthForTest()
	ch := types.ChannelError{ChannelId: 25, ChannelName: "zxai", AutoBan: true}
	commonBackup := common.AutomaticDisableChannelEnabled
	common.AutomaticDisableChannelEnabled = true
	t.Cleanup(func() {
		common.AutomaticDisableChannelEnabled = commonBackup
		resetChannelHealthForTest()
	})

	err := types.NewErrorWithStatusCode(
		types.NewError(nil, types.ErrorCodeBadResponseStatusCode),
		types.ErrorCodeBadResponseStatusCode,
		403,
	)
	err.SetMessage("status_code=403, 余额不足")
	action, reason := EvaluateChannelHealth(ch, err)
	require.Equal(t, HealthNotifyRecharge, action)
	require.Contains(t, reason, "余额不足")
}

func TestEvaluateChannelHealth_wrappedPlatformUserQuotaNeverDisables(t *testing.T) {
	resetChannelHealthForTest()
	ch := types.ChannelError{ChannelId: 68, ChannelName: "Apimart_原价", AutoBan: true}
	commonBackup := common.AutomaticDisableChannelEnabled
	common.AutomaticDisableChannelEnabled = true
	t.Cleanup(func() {
		common.AutomaticDisableChannelEnabled = commonBackup
		resetChannelHealthForTest()
	})

	makeErr := func() *types.NewAPIError {
		err := types.NewErrorWithStatusCode(
			types.NewError(nil, types.ErrorCodeBadResponseStatusCode),
			types.ErrorCodeBadResponseStatusCode,
			403,
		)
		err.SetMessage("status_code=403, 用户额度不足, 剩余额度: ＄0.000000")
		return err
	}

	for i := 0; i < 5; i++ {
		action, reason := EvaluateChannelHealth(ch, makeErr())
		require.Equal(t, HealthSkip, action, "attempt %d should skip", i+1)
		require.Empty(t, reason)
	}
}
