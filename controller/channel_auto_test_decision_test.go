package controller

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
)

func TestAutoTestStreamOrderPrefersCodexStreamFirst(t *testing.T) {
	tests := []struct {
		name        string
		channelType int
		expected    []bool
	}{
		{
			name:        "codex prefers stream then non-stream",
			channelType: constant.ChannelTypeCodex,
			expected:    []bool{true, false},
		},
		{
			name:        "openai prefers non-stream then stream",
			channelType: constant.ChannelTypeOpenAI,
			expected:    []bool{false, true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := getAutoTestStreamOrder(&model.Channel{Type: tt.channelType})
			if len(actual) != len(tt.expected) {
				t.Fatalf("unexpected stream order length: got=%d want=%d", len(actual), len(tt.expected))
			}
			for i := range tt.expected {
				if actual[i] != tt.expected[i] {
					t.Fatalf("unexpected stream order at %d: got=%v want=%v", i, actual[i], tt.expected[i])
				}
			}
		})
	}
}

func TestEvaluateAutoTestAttemptsUsesFallbackSuccessToAvoidDisableAndEnableAutoDisabled(t *testing.T) {
	restore := setAutoChannelSwitchesForTest(t, true, true)
	defer restore()

	channel := &model.Channel{
		Type:   constant.ChannelTypeCodex,
		Status: common.ChannelStatusAutoDisabled,
	}
	attempts := []autoTestAttempt{
		{
			isStream: true,
			result: testResult{
				localErr:    errors.New("stream failed"),
				newAPIError: types.NewOpenAIError(errors.New("stream failed"), types.ErrorCodeBadResponse, 404),
			},
			durationMs: 200,
		},
		{
			isStream: false,
			result: testResult{
				localErr: nil,
			},
			durationMs: 180,
		},
	}

	decision := evaluateAutoTestAttempts(channel, attempts, 5000)
	if !decision.passed {
		t.Fatalf("expected fallback success to pass")
	}
	if decision.shouldDisable {
		t.Fatalf("expected fallback success to avoid disable")
	}
	if !decision.shouldEnable {
		t.Fatalf("expected auto-disabled channel to be re-enabled after fallback success")
	}
	if decision.responseTimeMs != 180 {
		t.Fatalf("expected response time to use successful fallback attempt, got %d", decision.responseTimeMs)
	}
}

func TestEvaluateAutoTestAttemptsDisablesWhenAllAttemptsFailWithDisableError(t *testing.T) {
	restore := setAutoChannelSwitchesForTest(t, true, true)
	defer restore()

	channel := &model.Channel{
		Type:   constant.ChannelTypeCodex,
		Status: common.ChannelStatusEnabled,
	}
	preferredErr := types.NewOpenAIError(errors.New("auth failed"), types.ErrorCodeBadResponse, 401)
	attempts := []autoTestAttempt{
		{
			isStream: true,
			result: testResult{
				localErr:    errors.New("auth failed"),
				newAPIError: preferredErr,
			},
			durationMs: 100,
		},
		{
			isStream: false,
			result: testResult{
				localErr:    errors.New("fallback also failed"),
				newAPIError: types.NewOpenAIError(errors.New("fallback also failed"), types.ErrorCodeBadResponse, 404),
			},
			durationMs: 120,
		},
	}

	decision := evaluateAutoTestAttempts(channel, attempts, 5000)
	if decision.passed {
		t.Fatalf("expected all-failed attempts to not pass")
	}
	if !decision.shouldDisable {
		t.Fatalf("expected disable decision after all attempts failed with disable-worthy error")
	}
	if decision.newAPIError != preferredErr {
		t.Fatalf("expected preferred attempt error to be kept")
	}
	if decision.responseTimeMs != 100 {
		t.Fatalf("expected response time to use preferred disable-worthy attempt, got %d", decision.responseTimeMs)
	}
}

func TestEvaluateAutoTestAttemptsPrefersLaterDisableWorthyError(t *testing.T) {
	restore := setAutoChannelSwitchesForTest(t, true, true)
	defer restore()

	channel := &model.Channel{
		Type:   constant.ChannelTypeOpenAI,
		Status: common.ChannelStatusEnabled,
	}
	disableWorthyErr := types.NewOpenAIError(errors.New("unauthorized"), types.ErrorCodeBadResponse, 401)
	attempts := []autoTestAttempt{
		{
			isStream: false,
			result: testResult{
				localErr:    errors.New("not found"),
				newAPIError: types.NewOpenAIError(errors.New("not found"), types.ErrorCodeBadResponse, 404),
			},
			durationMs: 90,
		},
		{
			isStream: true,
			result: testResult{
				localErr:    errors.New("unauthorized"),
				newAPIError: disableWorthyErr,
			},
			durationMs: 210,
		},
	}

	decision := evaluateAutoTestAttempts(channel, attempts, 5000)
	if !decision.shouldDisable {
		t.Fatalf("expected later disable-worthy error to trigger auto disable")
	}
	if decision.newAPIError != disableWorthyErr {
		t.Fatalf("expected disable-worthy fallback error to be selected")
	}
	if decision.responseTimeMs != 210 {
		t.Fatalf("expected response time to follow the selected disable-worthy attempt, got %d", decision.responseTimeMs)
	}
}

func TestEvaluateAutoTestAttemptsDoesNotDisableForNonDisableError(t *testing.T) {
	restore := setAutoChannelSwitchesForTest(t, true, true)
	defer restore()

	channel := &model.Channel{
		Type:   constant.ChannelTypeOpenAI,
		Status: common.ChannelStatusEnabled,
	}
	attempts := []autoTestAttempt{
		{
			isStream: false,
			result: testResult{
				localErr:    errors.New("not found"),
				newAPIError: types.NewOpenAIError(errors.New("not found"), types.ErrorCodeBadResponse, 404),
			},
			durationMs: 120,
		},
		{
			isStream: true,
			result: testResult{
				localErr:    errors.New("still not found"),
				newAPIError: types.NewOpenAIError(errors.New("still not found"), types.ErrorCodeBadResponse, 404),
			},
			durationMs: 140,
		},
	}

	decision := evaluateAutoTestAttempts(channel, attempts, 5000)
	if decision.shouldDisable {
		t.Fatalf("expected non-disable errors to avoid auto disable")
	}
	if decision.shouldEnable {
		t.Fatalf("did not expect enable on failed attempts")
	}
}

func TestEvaluateAutoTestAttemptsStillDisablesOnSlowSuccessfulAttempt(t *testing.T) {
	restore := setAutoChannelSwitchesForTest(t, true, true)
	defer restore()

	channel := &model.Channel{
		Type:   constant.ChannelTypeOpenAI,
		Status: common.ChannelStatusEnabled,
	}
	attempts := []autoTestAttempt{
		{
			isStream:   false,
			result:     testResult{},
			durationMs: 6001,
		},
	}

	decision := evaluateAutoTestAttempts(channel, attempts, 5000)
	if !decision.passed {
		t.Fatalf("expected successful attempt to count as passed before timeout check")
	}
	if !decision.shouldDisable {
		t.Fatalf("expected slow successful attempt to still trigger disable")
	}
	if decision.newAPIError == nil {
		t.Fatalf("expected timeout disable to set newAPIError")
	}
	if decision.newAPIError.GetErrorCode() != types.ErrorCodeChannelResponseTimeExceeded {
		t.Fatalf("expected timeout error code, got %v", decision.newAPIError.GetErrorCode())
	}
}

func TestEvaluateAutoTestAttemptsReplacesEarlierErrorWhenSuccessIsSlow(t *testing.T) {
	restore := setAutoChannelSwitchesForTest(t, true, true)
	defer restore()

	channel := &model.Channel{
		Type:   constant.ChannelTypeCodex,
		Status: common.ChannelStatusEnabled,
	}
	attempts := []autoTestAttempt{
		{
			isStream: true,
			result: testResult{
				localErr:    errors.New("not found"),
				newAPIError: types.NewOpenAIError(errors.New("not found"), types.ErrorCodeBadResponse, 404),
			},
			durationMs: 120,
		},
		{
			isStream:   false,
			result:     testResult{},
			durationMs: 6001,
		},
	}

	decision := evaluateAutoTestAttempts(channel, attempts, 5000)
	if !decision.shouldDisable {
		t.Fatalf("expected slow successful fallback to trigger disable")
	}
	if decision.newAPIError == nil {
		t.Fatalf("expected timeout error to replace earlier non-disable error")
	}
	if decision.newAPIError.GetErrorCode() != types.ErrorCodeChannelResponseTimeExceeded {
		t.Fatalf("expected timeout error code, got %v", decision.newAPIError.GetErrorCode())
	}
	if !service.ShouldDisableChannel(channel.Type, decision.newAPIError) {
		t.Fatalf("expected selected timeout error to be disable-worthy")
	}
}

func setAutoChannelSwitchesForTest(t *testing.T, autoDisable bool, autoEnable bool) func() {
	t.Helper()
	oldDisable := common.AutomaticDisableChannelEnabled
	oldEnable := common.AutomaticEnableChannelEnabled
	common.AutomaticDisableChannelEnabled = autoDisable
	common.AutomaticEnableChannelEnabled = autoEnable
	return func() {
		common.AutomaticDisableChannelEnabled = oldDisable
		common.AutomaticEnableChannelEnabled = oldEnable
	}
}
