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
		t.Fatal("expected non-retryable")
	}
	if !isNonRetryableFailReason("insufficient quota") {
		t.Fatal("expected non-retryable")
	}
}

func TestIsNonRetryableFailReason_Retryable(t *testing.T) {
	if isNonRetryableFailReason("internal server error") {
		t.Fatal("should be retryable")
	}
}

func TestRetryProgressLabel(t *testing.T) {
	// after 1st failure, about to run attempt 2 → retrying 2/3
	if got := retryProgressLabel(1); got != "retrying 2/3" {
		t.Fatalf("got=%q", got)
	}
	if got := retryProgressLabel(2); got != "retrying 3/3" {
		t.Fatalf("got=%q", got)
	}
}

func TestShouldAttemptResubmit(t *testing.T) {
	if shouldAttemptResubmit("", 0, "oops") {
		t.Fatal("empty body")
	}
	if shouldAttemptResubmit(`{}`, 3, "oops") {
		t.Fatal("max retries")
	}
	if shouldAttemptResubmit(`{}`, 2, "timeout") {
		t.Fatal("count=2 is 3rd failure: no resubmit")
	}
	if !shouldAttemptResubmit(`{}`, 1, "timeout") {
		t.Fatal("count=1 should still resubmit")
	}
	if shouldAttemptResubmit(`{}`, 0, "audit failed") {
		t.Fatal("audit")
	}
	if !shouldAttemptResubmit(`{}`, 0, "timeout") {
		t.Fatal("should retry")
	}
}
