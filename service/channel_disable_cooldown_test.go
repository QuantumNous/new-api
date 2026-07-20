package service

import (
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
)

func TestShouldDisableChannelIgnoresCooldownBalanceError(t *testing.T) {
	oldAutomaticDisableChannelEnabled := common.AutomaticDisableChannelEnabled
	common.AutomaticDisableChannelEnabled = true
	t.Cleanup(func() {
		common.AutomaticDisableChannelEnabled = oldAutomaticDisableChannelEnabled
	})

	err := types.NewErrorWithStatusCode(errors.New("Insufficient account balance"), types.ErrorCodeBadResponseStatusCode, http.StatusForbidden)

	if ShouldDisableChannel(err) {
		t.Fatalf("expected balance error to cooldown without permanent auto-disable")
	}
}

func TestShouldCooldownChannelForUpstreamErrorCoolsMalformedResponses(t *testing.T) {
	err := types.NewErrorWithStatusCode(errors.New("API returned an empty or malformed response (HTTP 200)"), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)

	if !ShouldCooldownChannelForUpstreamError(err) {
		t.Fatalf("expected malformed upstream response to cooldown")
	}
}

func TestShouldCooldownChannelForUpstreamErrorCoolsSkipRetryMalformedResponses(t *testing.T) {
	err := types.NewErrorWithStatusCode(errors.New("API returned an empty or malformed response (HTTP 200)"), types.ErrorCodeBadResponseBody, http.StatusInternalServerError, types.ErrOptionWithSkipRetry())

	if !ShouldCooldownChannelForUpstreamError(err) {
		t.Fatalf("expected malformed upstream response to cooldown even when retry is skipped")
	}
}

func TestShouldCooldownChannelForUpstreamErrorCoolsBadGateway(t *testing.T) {
	err := types.WithOpenAIError(types.OpenAIError{Message: "openai_error", Type: "openai_error", Code: "openai_error"}, http.StatusBadGateway)

	if !ShouldCooldownChannelForUpstreamError(err) {
		t.Fatalf("expected upstream 502 to cooldown")
	}
}

func TestShouldCooldownChannelForUpstreamErrorUsesUnmappedUpstreamStatus(t *testing.T) {
	err := types.NewErrorWithStatusCode(errors.New("provider overloaded"), types.ErrorCodeBadResponseStatusCode, http.StatusBadRequest)
	err.UpstreamStatusCode = http.StatusServiceUnavailable

	assert.True(t, ShouldCooldownChannelForUpstreamError(err), "expected an upstream 503 to cooldown after the client status is remapped")
}

func TestShouldCooldownChannelForUpstreamErrorCoolsImageGenerationCapabilityGap(t *testing.T) {
	err := types.NewErrorWithStatusCode(errors.New("Image generation is not enabled for this group"), types.ErrorCodeBadResponseStatusCode, http.StatusForbidden)

	if !ShouldCooldownChannelForUpstreamError(err) {
		t.Fatalf("expected per-channel capability gap (image generation disabled) to cooldown despite being 4xx")
	}
}

func TestShouldCooldownChannelForUpstreamErrorIgnoresClientErrors(t *testing.T) {
	err := types.NewErrorWithStatusCode(errors.New("invalid request"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())

	if ShouldCooldownChannelForUpstreamError(err) {
		t.Fatalf("expected client validation error to avoid cooldown")
	}
}

func TestShouldCooldownChannelForUpstreamErrorIgnoresAuthErrors(t *testing.T) {
	err := types.NewErrorWithStatusCode(errors.New("invalid token"), types.ErrorCodeAccessDenied, http.StatusUnauthorized)

	if ShouldCooldownChannelForUpstreamError(err) {
		t.Fatalf("expected auth error to avoid cooldown")
	}
}
