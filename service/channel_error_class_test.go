package service

import (
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

func TestClassifyChannelError_upstreamRecharge_zxai(t *testing.T) {
	t.Parallel()
	err := types.NewErrorWithStatusCode(
		types.NewError(nil, types.ErrorCodeBadResponseStatusCode),
		types.ErrorCodeBadResponseStatusCode,
		403,
	)
	err.SetMessage("status_code=403, 用户额度不足, 剩余额度: ＄-0.009978")
	require.Equal(t, CategoryUpstreamRecharge, ClassifyChannelError(err))
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

	action, _ := EvaluateChannelHealth(ch, make502())
	require.Equal(t, HealthSkip, action)
	action, _ = EvaluateChannelHealth(ch, make502())
	require.Equal(t, HealthSkip, action)
	action, reason := EvaluateChannelHealth(ch, make502())
	require.Equal(t, HealthDisableWindow, action)
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
