package service

import (
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/types"
)

func TestShouldCooldownChannelForBalanceError(t *testing.T) {
	err := types.NewErrorWithStatusCode(errors.New("Insufficient account balance"), types.ErrorCodeBadResponseStatusCode, http.StatusForbidden)

	if !ShouldCooldownChannel(err) {
		t.Fatalf("expected balance error to trigger channel cooldown")
	}
}

func TestShouldCooldownChannelForChineseBalanceError(t *testing.T) {
	err := types.NewErrorWithStatusCode(errors.New("账户余额不足"), types.ErrorCodeBadResponseStatusCode, http.StatusForbidden)

	if !ShouldCooldownChannel(err) {
		t.Fatalf("expected Chinese balance error to trigger channel cooldown")
	}
}

func TestShouldCooldownChannelForLowCreditBalanceError(t *testing.T) {
	err := types.NewErrorWithStatusCode(errors.New("Your credit balance is too low"), types.ErrorCodeBadResponseStatusCode, http.StatusForbidden)

	if !ShouldCooldownChannel(err) {
		t.Fatalf("expected low credit balance error to trigger channel cooldown")
	}
}

func TestShouldCooldownChannelForInsufficientQuotaCode(t *testing.T) {
	err := types.NewOpenAIError(errors.New("You exceeded your current quota"), types.ErrorCode("insufficient_quota"), http.StatusTooManyRequests)

	if !ShouldCooldownChannel(err) {
		t.Fatalf("expected insufficient_quota error code to trigger channel cooldown")
	}
}

func TestShouldCooldownChannelIgnoresUnrelatedError(t *testing.T) {
	err := types.NewErrorWithStatusCode(errors.New("unsupported parameter: max_output_tokens"), types.ErrorCodeBadResponseStatusCode, http.StatusBadRequest)

	if ShouldCooldownChannel(err) {
		t.Fatalf("expected unrelated bad request to skip channel cooldown")
	}
}
