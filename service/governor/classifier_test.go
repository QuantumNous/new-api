package governor

import (
	"net/http"
	"testing"
	"time"
)

type fakeRelayError struct {
	status int
	hdr    http.Header
}

func (e *fakeRelayError) Error() string { return "relay error" }

func (e *fakeRelayError) StatusCode() int { return e.status }

func (e *fakeRelayError) Headers() http.Header { return e.hdr }

func TestClassifyRelayError_UsesRetryAfterForKeyCooldown(t *testing.T) {
	t.Parallel()

	err := &fakeRelayError{
		status: http.StatusTooManyRequests,
		hdr:    http.Header{"Retry-After": []string{"120"}},
	}

	classification := ClassifyRelayError(err)
	if classification.KeyCooldown != 120*time.Second {
		t.Fatalf("expected KeyCooldown=120s from Retry-After, got %v", classification.KeyCooldown)
	}
}

