package types

import (
	"errors"
	"net/http"
	"testing"
)

func TestApplyDownstreamNewAPIErrorPolicyKeepsLocalError(t *testing.T) {
	err := NewErrorWithStatusCode(
		errors.New("Invalid token"),
		ErrorCodeInvalidRequest,
		http.StatusUnauthorized,
	)

	got := ApplyDownstreamNewAPIErrorPolicy(err, "req_local")
	if got.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", got.StatusCode, http.StatusUnauthorized)
	}
	if got.Error() != "Invalid token (request id: req_local)" {
		t.Fatalf("message = %q", got.Error())
	}
	if got.GetErrorCode() != ErrorCodeInvalidRequest {
		t.Fatalf("code = %q, want %q", got.GetErrorCode(), ErrorCodeInvalidRequest)
	}
}

func TestApplyDownstreamNewAPIErrorPolicyMapsUpstreamStatusesToServiceUnavailable(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
	}{
		{name: "upstream 401", statusCode: http.StatusUnauthorized},
		{name: "upstream 403", statusCode: http.StatusForbidden},
		{name: "upstream 429", statusCode: http.StatusTooManyRequests},
		{name: "upstream 502", statusCode: http.StatusBadGateway},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := NewOpenAIError(
				errors.New("unexpected status from upstream"),
				ErrorCodeBadResponseStatusCode,
				tt.statusCode,
			)

			got := ApplyDownstreamNewAPIErrorPolicy(err, "req_upstream")
			if got.StatusCode != http.StatusServiceUnavailable {
				t.Fatalf("status = %d, want %d", got.StatusCode, http.StatusServiceUnavailable)
			}
			if got.Error() != "Service temporarily unavailable. Please try again later. (request id: req_upstream)" {
				t.Fatalf("message = %q", got.Error())
			}
			if got.GetErrorCode() != ErrorCodeServiceUnavailable {
				t.Fatalf("code = %q, want %q", got.GetErrorCode(), ErrorCodeServiceUnavailable)
			}
		})
	}
}

func TestApplyDownstreamNewAPIErrorPolicyMapsMarkedProviderError(t *testing.T) {
	err := MarkAsUpstreamError(WithOpenAIError(OpenAIError{
		Message: "token quota is not enough, url: https://example.invalid/responses",
		Type:    "provider_error",
		Code:    "provider_quota_error",
	}, http.StatusOK))

	got := ApplyDownstreamNewAPIErrorPolicy(err, "req_provider")
	if got.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", got.StatusCode, http.StatusServiceUnavailable)
	}
	openAIError := got.ToOpenAIError()
	if openAIError.Message != "Service temporarily unavailable. Please try again later. (request id: req_provider)" {
		t.Fatalf("message = %q", openAIError.Message)
	}
	if openAIError.Type != string(ErrorTypeNewAPIError) {
		t.Fatalf("type = %q, want %q", openAIError.Type, ErrorTypeNewAPIError)
	}
	if openAIError.Code != ErrorCodeServiceUnavailable {
		t.Fatalf("code = %v, want %q", openAIError.Code, ErrorCodeServiceUnavailable)
	}
}
