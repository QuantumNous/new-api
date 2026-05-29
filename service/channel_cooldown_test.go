package service

import (
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
)

func TestCooldownChannelForRetryCoolsFullDuration(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	chErr := types.NewChannelError(9001, 1, "test", false, "", true)
	err := types.NewErrorWithStatusCode(errors.New("bad response status code 500"), types.ErrorCodeBadResponseStatusCode, http.StatusInternalServerError)

	CooldownChannelForRetry(*chErr, err)

	reason, expires, cooling := model.GetChannelCooldown(9001)
	if !cooling {
		t.Fatalf("expected retryable error to cool the channel")
	}
	if !strings.Contains(reason, "retryable_error") {
		t.Fatalf("expected retryable_error reason, got %q", reason)
	}
	if remaining := time.Until(time.Unix(expires, 0)); remaining < 29*time.Minute || remaining > 31*time.Minute {
		t.Fatalf("expected ~30m cooldown, got %s", remaining)
	}
}

func TestCooldownSlowChannelCoolsFullDuration(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	chErr := types.NewChannelError(9002, 1, "test", false, "", true)

	CooldownSlowChannel(*chErr, 42*time.Second)

	reason, expires, cooling := model.GetChannelCooldown(9002)
	if !cooling {
		t.Fatalf("expected slow channel to be cooled")
	}
	if !strings.Contains(reason, "slow_upstream") {
		t.Fatalf("expected slow_upstream reason, got %q", reason)
	}
	if remaining := time.Until(time.Unix(expires, 0)); remaining < 29*time.Minute || remaining > 31*time.Minute {
		t.Fatalf("expected ~30m cooldown, got %s", remaining)
	}
}

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
