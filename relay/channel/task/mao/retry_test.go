package mao

import "testing"

func TestIsNonRetryableFailReason_Audit(t *testing.T) {
	if !isNonRetryableFailReason("content audit rejected") {
		t.Fatal("expected non-retryable")
	}
	if !isNonRetryableFailReason("审核不通过") {
		t.Fatal("expected non-retryable")
	}
}

func TestIsNonRetryableFailReason_Balance(t *testing.T) {
	if !isNonRetryableFailReason("余额不足") {
		t.Fatal("expected non-retryable for same-channel")
	}
	if !isNonRetryableFailReason("insufficient quota") {
		t.Fatal("expected non-retryable for same-channel")
	}
}

func TestIsNonRetryableFailReason_Retryable(t *testing.T) {
	if isNonRetryableFailReason("internal server error") {
		t.Fatal("should be retryable")
	}
}

func TestRetryProgressLabel(t *testing.T) {
	if got := retryProgressLabel(1, 2); got != "retrying 1/2" {
		t.Fatalf("got=%q", got)
	}
	if got := retryProgressLabel(2, 2); got != "retrying 2/2" {
		t.Fatalf("got=%q", got)
	}
}

func TestShouldAttemptResubmit(t *testing.T) {
	const maxRetries = 2
	if shouldAttemptResubmit("", 0, maxRetries, "oops") {
		t.Fatal("empty body")
	}
	if shouldAttemptResubmit(`{}`, 2, maxRetries, "oops") {
		t.Fatal("max retries")
	}
	if shouldAttemptResubmit(`{}`, 2, maxRetries, "timeout") {
		t.Fatal("count=2 with max=2: no resubmit")
	}
	if !shouldAttemptResubmit(`{}`, 1, maxRetries, "timeout") {
		t.Fatal("count=1 should still resubmit")
	}
	if shouldAttemptResubmit(`{}`, 0, maxRetries, "audit failed") {
		t.Fatal("audit")
	}
	if !shouldAttemptResubmit(`{}`, 0, maxRetries, "timeout") {
		t.Fatal("should retry")
	}
}
