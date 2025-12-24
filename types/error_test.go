package types

import "testing"

func TestNewAPIError_Error_EmptyUnderlyingMessageFallsBackToErrorCode(t *testing.T) {
	err := InitOpenAIError(ErrorCodeBadResponseStatusCode, 400)
	if err == nil {
		t.Fatal("InitOpenAIError() returned nil")
	}
	if got, want := err.Error(), string(ErrorCodeBadResponseStatusCode); got != want {
		t.Fatalf("Error() = %q, want %q", got, want)
	}
}
